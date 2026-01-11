# frozen_string_literal: true

require "thor"
require "pastel"
require "tty-spinner"
require "tty-prompt"
require_relative "services/index_restaurants_service"
require_relative "services/search_restaurants_service"
require_relative "services/restaurant_details_service"
require_relative "services/list_categories_service"

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
                  search_service.search_by_name(options[:name])
                elsif options[:category]
                  search_service.search_by_category(options[:category])
                else
                  puts p.red("Please provide --name or --category (or --list-categories)")
                  exit 1
                end

      search_term = options[:name] || options[:category]
      handle_search_results(results, search_term)
    end

    desc "index", "Search and retrieve data for a specific area"
    option :city, type: :string, required: true, desc: "City to index (e.g., 'barrie, ontario')"
    def index
      p = self.class.pastel

      puts p.bold("🗺️  Indexing restaurants in #{p.cyan(options[:city])}")
      puts p.dim("   Database: #{Config.db_path}")
      puts

      index_service = Services::IndexRestaurantsService.new
      stats = index_service.index(location: options[:city])

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
        puts p.yellow("🔍 No restaurants found matching '#{search_term}'")
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
