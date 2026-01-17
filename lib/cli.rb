# frozen_string_literal: true

require "thor"
require "pastel"
require "tty-spinner"
require "tty-prompt"
require_relative "services/index_restaurants_service"
require_relative "services/search_restaurants_service"
require_relative "services/restaurant_details_service"
require_relative "services/list_categories_service"
require_relative "infrastructure/adapters/yelp"
require_relative "infrastructure/adapters/google"
require_relative "infrastructure/adapters/tripadvisor"

module GrubStars
  class CLI < Thor
    def self.pastel
      @pastel ||= Pastel.new
    end

    def self.prompt
      @prompt ||= TTY::Prompt.new
    end

    desc "config", "View or update configuration"
    option :db_path, type: :string, desc: "Set database file path"
    option :show, type: :boolean, default: false, desc: "Show current configuration"
    def config
      p = self.class.pastel

      if options[:db_path]
        old_path = Config.db_path
        Config.db_path = options[:db_path]
        puts p.green("✓ Database path updated:")
        puts "  Old: #{p.dim(old_path)}"
        puts "  New: #{p.cyan(Config.db_path)}"
      else
        puts p.bold("⚙️  Configuration")
        puts p.dim("   #{Config.config_path}")
        puts
        Config.to_h.each do |key, value|
          puts "  #{p.yellow(key)}: #{p.cyan(value)}"
        end
        puts
        puts p.dim("Use --db-path to change the database location")
      end
    end

    desc "search", "Find restaurants by name or category (fuzzy matching)"
    option :name, type: :string, desc: "Search by restaurant name"
    option :category, type: :string, desc: "Search by category (e.g., bakery, cafe)"
    option :location, type: :string, desc: "Filter by location (e.g., 'barrie, ontario')"
    option :list_categories, type: :boolean, desc: "List all available categories"
    def search
      p = self.class.pastel

      if options[:list_categories]
        list_categories_service = Services::ListCategoriesService.new
        categories = list_categories_service.all_category_names
        if categories.empty?
          puts p.yellow("📭 No categories found. Run 'grst index' first.")
        else
          puts p.bold("📂 Available categories:")
          puts
          categories.each { |c| puts "  #{p.cyan(c)}" }
        end
        return
      end

      search_service = Services::SearchRestaurantsService.new

      results = if options[:name]
                  search_service.search_by_name(options[:name], location: options[:location])
                elsif options[:category]
                  search_service.search_by_category(options[:category], location: options[:location])
                else
                  puts p.red("Please provide --name or --category (or --list-categories)")
                  exit 1
                end

      search_term = options[:name] || options[:category]
      handle_search_results(results, search_term)
    rescue Services::SearchRestaurantsService::LocationNotIndexedError => e
      puts p.red("❌ Error: #{e.message}")
      exit 1
    end

    desc "index", "Search and retrieve data for a specific area"
    option :location, type: :string, required: true, desc: "Location to index (e.g., 'barrie, ontario')"
    option :category, type: :string, desc: "Optional category filter (e.g., 'bakery', 'cafe')"
    def index
      p = self.class.pastel

      if options[:category]
        puts p.bold("🗺️  Indexing #{p.cyan(options[:category])} in #{p.cyan(options[:location])}")
      else
        puts p.bold("🗺️  Indexing restaurants in #{p.cyan(options[:location])}")
      end
      puts p.dim("   Database: #{Config.db_path}")
      puts

      index_service = Services::IndexRestaurantsService.new
      stats = index_service.index(location: options[:location], categories: options[:category])

      puts
      puts p.green("✅ Done! #{p.bold(stats[:total])} restaurants processed")
      puts "   #{p.green(stats[:created])} new | #{p.yellow(stats[:updated])} updated | #{p.cyan(stats[:merged])} merged"
    rescue Services::IndexRestaurantsService::NoAdaptersConfiguredError => e
      puts p.red("❌ Error: #{e.message}")
      exit 1
    rescue Adapters::Base::APIError => e
      puts p.red("❌ API Error: #{e.message}")
      exit 1
    end

    desc "info", "Show a single restaurant's information"
    option :name, type: :string, desc: "Restaurant name (fuzzy match)"
    option :id, type: :string, desc: "Restaurant ID"
    def info
      p = self.class.pastel
      details_service = Services::RestaurantDetailsService.new

      restaurant = if options[:id]
                     details_service.get_by_id(options[:id].to_i)
                   elsif options[:name]
                     details_service.get_by_name(options[:name])
                   else
                     puts p.red("Please provide --name or --id")
                     exit 1
                   end

      if restaurant.nil?
        identifier = options[:id] ? "ID #{options[:id]}" : "'#{options[:name]}'"
        puts p.yellow("🔍 No restaurant found matching #{identifier}")
        exit 1
      end

      show_restaurant_details(restaurant)
    end

    def self.exit_on_failure?
      true
    end

    private

    def handle_search_results(results, search_term)
      p = self.class.pastel
      prompt = self.class.prompt

      if results.empty?
        puts p.yellow("🔍 No restaurants found matching '#{search_term}' in local database")
        puts

        # Offer fallback search (only in interactive mode)
        if $stdin.tty? && prompt.yes?("Would you like to search for '#{search_term}' using an external API?")
          handle_fallback_search(search_term)
        end
        return
      end

      if results.length == 1
        # Single result - show detailed info directly
        # Load full details
        details_service = Services::RestaurantDetailsService.new
        restaurant = details_service.get_by_id(results.first.id)
        show_restaurant_details(restaurant)
      else
        # Multiple results - let user pick
        puts p.bold("🍽️  Found #{p.green(results.length)} matches for '#{search_term}':")
        puts

        choices = results.map.with_index do |r, idx|
          rating = r.ratings.first
          rating_str = rating ? " (#{rating.score}/5)" : ""
          { name: "#{r.name}#{rating_str}", value: idx }
        end

        selected = prompt.select("Which restaurant?", choices, per_page: 10)
        puts

        # Load full details for selected restaurant
        details_service = Services::RestaurantDetailsService.new
        restaurant = details_service.get_by_id(results[selected].id)
        show_restaurant_details(restaurant)
      end
    end

    def show_restaurant_details(restaurant)
      p = self.class.pastel

      puts p.bold("━" * 50)
      puts p.bold.cyan(restaurant.name)
      puts p.bold("━" * 50)
      puts

      # Basic info
      puts "🆔 #{p.bold("ID")}: #{restaurant.id}"
      puts

      if restaurant.location
        puts "📌 #{p.bold("Location")}"
        puts "   #{restaurant.location}"
        puts
      end

      if restaurant.address
        puts "📍 #{p.bold("Address")}"
        puts "   #{restaurant.address}"
        puts
      end

      if restaurant.phone
        puts "📞 #{p.bold("Phone")}"
        puts "   #{restaurant.phone}"
        puts
      end

      # Categories
      if restaurant.categories && !restaurant.categories.empty?
        puts "🏷️  #{p.bold("Categories")}"
        puts "   #{restaurant.category_names.join(", ")}"
        puts
      end

      # Ratings
      if restaurant.ratings && !restaurant.ratings.empty?
        puts "⭐ #{p.bold("Ratings")}"
        restaurant.ratings.each do |r|
          score = r.score
          color = score >= 4.0 ? :green : (score >= 3.0 ? :yellow : :red)
          review_count = r.review_count ? " (#{r.review_count} reviews)" : ""
          puts "   #{p.cyan(r.source)}: #{p.send(color, "#{score}/5")}#{p.dim(review_count)}"
        end
        puts
      end

      # Reviews
      if restaurant.reviews && !restaurant.reviews.empty?
        puts "💬 #{p.bold("Review Snippets")}"
        grouped_reviews = restaurant.reviews.group_by(&:source)
        grouped_reviews.each do |source, reviews|
          puts "   #{p.cyan(source)}:"
          reviews.each do |review|
            snippet = review.snippet || "(no snippet)"
            # Truncate long snippets
            snippet = "#{snippet[0..100]}..." if snippet.length > 100
            puts "   • #{p.dim(snippet)}"
            puts "     #{p.blue(review.url)}" if review.url
          end
        end
        puts
      end

      # Photos
      photos = restaurant.photos
      if photos && !photos.empty?
        puts "📸 #{p.bold("Photos")}"
        grouped_photos = photos.group_by(&:source)
        grouped_photos.each do |source, photo_list|
          puts "   #{p.cyan(source)}: #{photo_list.length} photo#{'s' if photo_list.length != 1}"
          photo_list.first(3).each do |photo|
            puts "   • #{p.blue(photo.url)}"
          end
          puts "   #{p.dim("... and #{photo_list.length - 3} more")}" if photo_list.length > 3
        end
        puts
      end

      # Videos
      videos = restaurant.videos
      if videos && !videos.empty?
        puts "🎬 #{p.bold("Videos")}"
        grouped_videos = videos.group_by(&:source)
        grouped_videos.each do |source, video_list|
          puts "   #{p.cyan(source)}: #{video_list.length} video#{'s' if video_list.length != 1}"
          video_list.first(3).each do |video|
            puts "   • #{p.blue(video.url)}"
          end
          puts "   #{p.dim("... and #{video_list.length - 3} more")}" if video_list.length > 3
        end
        puts
      end

      # Sources
      sources = restaurant.sources
      if sources && !sources.empty?
        puts "🔗 #{p.bold("Data Sources")}"
        puts "   #{sources.join(", ")}"
        puts
      end

      # Coordinates
      if restaurant.latitude && restaurant.longitude
        puts "🗺️  #{p.bold("Coordinates")}"
        puts "   #{restaurant.latitude}, #{restaurant.longitude}"
      end
    end

    def handle_fallback_search(search_term)
      p = self.class.pastel
      prompt = self.class.prompt

      # Get configured adapters
      adapters = [
        GrubStars::Adapters::Yelp.new,
        GrubStars::Adapters::Google.new,
        GrubStars::Adapters::TripAdvisor.new
      ].select(&:configured?)

      if adapters.empty?
        puts p.red("No external adapters configured. Set API keys in .env file.")
        return
      end

      # Let user choose adapter
      adapter_choices = adapters.map do |adapter|
        { name: adapter.source_name.capitalize, value: adapter }
      end

      puts
      selected_adapter = prompt.select("Which service would you like to search?", adapter_choices)
      puts
      puts p.dim("Searching #{selected_adapter.source_name} for '#{search_term}'...")

      # Search using adapter
      begin
        results = selected_adapter.search_by_name(name: search_term)

        if results.empty?
          puts p.yellow("No results found on #{selected_adapter.source_name}")
          return
        end

        puts p.green("✓ Found #{results.length} result#{'s' unless results.length == 1}")
        puts

        # Display and let user select
        handle_api_search_results(results, selected_adapter)
      rescue GrubStars::Adapters::Base::APIError => e
        puts p.red("API Error: #{e.message}")
      rescue GrubStars::Adapters::Base::ConfigurationError => e
        puts p.red("Configuration Error: #{e.message}")
      end
    end

    def handle_api_search_results(results, adapter)
      p = self.class.pastel
      prompt = self.class.prompt

      # Build choices
      choices = results.map.with_index do |biz, idx|
        name = biz[:name]
        rating = biz[:rating]
        rating_str = rating ? " (#{rating}/5)" : ""
        address = biz[:address] ? " - #{biz[:address][0..50]}..." : ""
        { name: "#{name}#{rating_str}#{p.dim(address)}", value: idx }
      end
      choices << { name: p.dim("Cancel"), value: :cancel }

      selected_idx = prompt.select("Select a restaurant to view and optionally index:", choices, per_page: 10)

      return if selected_idx == :cancel

      selected_business = results[selected_idx]
      display_api_business(selected_business, adapter)

      # Ask if they want to index
      puts
      if prompt.yes?("Would you like to index this restaurant for future local searches?")
        index_single_restaurant(selected_business, adapter)
      end
    end

    def display_api_business(business, adapter)
      p = self.class.pastel

      puts
      puts p.bold("━" * 50)
      puts p.bold.cyan(business[:name])
      puts p.bold("━" * 50)
      puts

      puts "🔗 #{p.bold("Source")}: #{adapter.source_name}"
      puts

      if business[:address]
        puts "📍 #{p.bold("Address")}"
        puts "   #{business[:address]}"
        puts
      end

      if business[:phone]
        puts "📞 #{p.bold("Phone")}"
        puts "   #{business[:phone]}"
        puts
      end

      if business[:rating]
        score = business[:rating]
        color = score >= 4.0 ? :green : (score >= 3.0 ? :yellow : :red)
        review_count = business[:review_count] ? " (#{business[:review_count]} reviews)" : ""
        puts "⭐ #{p.bold("Rating")}"
        puts "   #{p.send(color, "#{score}/5")}#{p.dim(review_count)}"
        puts
      end

      if business[:categories] && !business[:categories].empty?
        puts "🏷️  #{p.bold("Categories")}"
        puts "   #{business[:categories].join(", ")}"
        puts
      end

      if business[:latitude] && business[:longitude]
        puts "🗺️  #{p.bold("Coordinates")}"
        puts "   #{business[:latitude]}, #{business[:longitude]}"
        puts
      end
    end

    def index_single_restaurant(business_data, adapter)
      p = self.class.pastel

      puts
      puts p.dim("Indexing restaurant...")

      index_service = Services::IndexRestaurantsService.new
      result = index_service.index_restaurant(business_data: business_data, source: adapter.source_name)

      case result
      when :created
        puts p.green("✅ Restaurant added to local database")
      when :updated
        puts p.yellow("✅ Restaurant updated in local database")
      when :merged
        puts p.cyan("✅ Restaurant merged with existing entry in local database")
      end
    end

    def format_ratings(ratings)
      return "" if ratings.nil? || ratings.empty?
      p = self.class.pastel

      ratings.map do |r|
        score = r[:score]
        color = score >= 4.0 ? :green : (score >= 3.0 ? :yellow : :red)
        "#{r[:source]}: #{p.send(color, "#{score}/5")}"
      end.join(", ")
    end
  end
end
