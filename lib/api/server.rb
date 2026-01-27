# frozen_string_literal: true

require "sinatra/base"
require "json"
require_relative "../grub_stars"

module GrubStars
  module API
    class Server < Sinatra::Base
      configure do
        set :show_exceptions, false
        set :raise_errors, false
        # Serve static files from web directory
        set :public_folder, File.expand_path("../../../web", __FILE__)
      end

      before do
        # CORS headers for local development
        headers "Access-Control-Allow-Origin" => "*",
                "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers" => "Content-Type"

        # Only set JSON content type for API routes
        content_type :json unless request.path_info.start_with?("/js", "/css") || request.path_info.end_with?(".html")
      end

      # Handle CORS preflight requests
      options "*" do
        200
      end

      # Serve index.html at root
      get "/" do
        content_type :html
        send_file File.join(settings.public_folder, "index.html")
      end

      # Health check
      get "/health" do
        json_response({ status: "ok" })
      end

      # List all categories
      get "/categories" do
        service = Services::ListCategoriesService.new
        categories = service.all_category_names
        json_response(categories, count: categories.length)
      end

      # List all indexed locations
      get "/locations" do
        service = Services::SearchRestaurantsService.new
        locations = service.all_indexed_locations
        json_response(locations, count: locations.length)
      end

      # Autocomplete restaurant names
      get "/restaurants/autocomplete" do
        query = params[:q]&.strip
        limit = [(params[:limit] || 10).to_i, 20].min

        unless query && query.length >= 2
          halt 400, json_error("INVALID_REQUEST", "Query 'q' must be at least 2 characters")
        end

        repo = Infrastructure::Repositories::RestaurantRepository.new
        results = repo.autocomplete(query, limit: limit)

        json_response(results, count: results.length)
      end

      # Search restaurants
      get "/restaurants/search" do
        service = Services::SearchRestaurantsService.new
        location = params[:location]

        results = if params[:name]
                    service.search_by_name(params[:name], location: location)
                  elsif params[:category]
                    service.search_by_category(params[:category], location: location)
                  else
                    halt 400, json_error("INVALID_REQUEST", "Provide 'name' or 'category' parameter")
                  end

        json_response(
          results.map { |r| serialize_restaurant_summary(r) },
          count: results.length
        )
      rescue Services::SearchRestaurantsService::LocationNotIndexedError => e
        halt 400, json_error("LOCATION_NOT_INDEXED", e.message)
      end

      # Get restaurant by ID
      get "/restaurants/:id" do
        service = Services::RestaurantDetailsService.new
        restaurant = service.get_by_id(params[:id].to_i)

        if restaurant.nil?
          halt 404, json_error("NOT_FOUND", "Restaurant with ID #{params[:id]} not found")
        end

        json_response(restaurant.to_h)
      end

      # Index restaurants
      post "/index" do
        body = parse_json_body
        location = body["location"]
        category = body["category"]

        unless location
          halt 400, json_error("INVALID_REQUEST", "location is required")
        end

        service = Services::IndexRestaurantsService.new
        stats = service.index(location: location, categories: category)

        json_response(stats, location: location, category: category)
      rescue Services::IndexRestaurantsService::NoAdaptersConfiguredError => e
        halt 503, json_error("NO_ADAPTERS", e.message)
      rescue GrubStars::Adapters::Base::APIError => e
        halt 502, json_error("API_ERROR", e.message)
      end

      # List available adapters
      get "/adapters" do
        adapters = available_adapters.map do |adapter|
          {
            name: adapter.source_name,
            configured: adapter.configured?
          }
        end

        json_response(adapters, count: adapters.length)
      end

      # Search external APIs by restaurant name
      get "/restaurants/search-external" do
        name = params[:name]&.strip
        adapter_name = params[:adapter]&.strip&.downcase
        location = params[:location]&.strip
        limit = [(params[:limit] || 10).to_i, 20].min

        unless name && name.length >= 2
          halt 400, json_error("INVALID_REQUEST", "Parameter 'name' must be at least 2 characters")
        end

        unless adapter_name
          halt 400, json_error("INVALID_REQUEST", "Parameter 'adapter' is required (yelp, google, or tripadvisor)")
        end

        adapter = find_adapter(adapter_name)
        unless adapter
          halt 400, json_error("INVALID_ADAPTER", "Unknown adapter: #{adapter_name}. Use yelp, google, or tripadvisor")
        end

        unless adapter.configured?
          halt 503, json_error("ADAPTER_NOT_CONFIGURED", "Adapter '#{adapter_name}' is not configured. Set the API key in .env file")
        end

        results = adapter.search_by_name(name: name, location: location, limit: limit)

        json_response(
          results.map { |r| serialize_external_result(r, adapter_name) },
          count: results.length,
          adapter: adapter_name,
          query: name
        )
      rescue GrubStars::Adapters::Base::APIError => e
        halt 502, json_error("API_ERROR", e.message)
      end

      # Index a single restaurant from external search results
      post "/restaurants/index-single" do
        body = parse_json_body
        business_data = body["business_data"]
        source = body["source"]&.strip&.downcase
        location = body["location"]&.strip

        unless business_data
          halt 400, json_error("INVALID_REQUEST", "business_data is required")
        end

        unless source
          halt 400, json_error("INVALID_REQUEST", "source is required (yelp, google, or tripadvisor)")
        end

        # Normalize business_data keys to symbols
        normalized_data = normalize_business_data(business_data)

        service = Services::IndexRestaurantsService.new
        result = service.index_restaurant(
          business_data: normalized_data,
          source: source,
          location: location
        )

        # Find the newly indexed restaurant to return its ID
        repo = Infrastructure::Repositories::RestaurantRepository.new
        restaurant = repo.find_by_external_id(source, normalized_data[:external_id])

        json_response({
          result: result.to_s,
          restaurant_id: restaurant&.id,
          message: result_message(result)
        })
      end

      # Error handlers
      error JSON::ParserError do
        halt 400, json_error("INVALID_JSON", "Request body is not valid JSON")
      end

      error do
        halt 500, json_error("INTERNAL_ERROR", "An unexpected error occurred")
      end

      private

      def json_response(data, **meta_extras)
        {
          data: data,
          meta: { timestamp: Time.now.iso8601 }.merge(meta_extras)
        }.to_json
      end

      def json_error(code, message)
        {
          error: { code: code, message: message },
          meta: { timestamp: Time.now.iso8601 }
        }.to_json
      end

      def parse_json_body
        request.body.rewind
        JSON.parse(request.body.read)
      rescue JSON::ParserError
        halt 400, json_error("INVALID_JSON", "Request body is not valid JSON")
      end

      def serialize_restaurant_summary(restaurant)
        {
          id: restaurant.id,
          name: restaurant.name,
          address: restaurant.address,
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
          phone: restaurant.phone,
          location: restaurant.location,
          ratings: restaurant.ratings.map do |r|
            { source: r.source, score: r.score, review_count: r.review_count }
          end,
          categories: restaurant.category_names,
          sources: restaurant.sources
        }
      end

      def serialize_external_result(result, source)
        {
          external_id: result[:external_id],
          source: source,
          name: result[:name],
          address: result[:address],
          latitude: result[:latitude],
          longitude: result[:longitude],
          phone: result[:phone],
          rating: result[:rating],
          review_count: result[:review_count],
          categories: result[:categories] || [],
          photos: result[:photos] || [],
          url: result[:url]
        }
      end

      def available_adapters
        @available_adapters ||= [
          GrubStars::Adapters::Yelp.new,
          GrubStars::Adapters::Google.new,
          GrubStars::Adapters::TripAdvisor.new
        ]
      end

      def find_adapter(name)
        available_adapters.find { |a| a.source_name == name }
      end

      def normalize_business_data(data)
        {
          external_id: data["external_id"],
          name: data["name"],
          address: data["address"],
          latitude: data["latitude"]&.to_f,
          longitude: data["longitude"]&.to_f,
          phone: data["phone"],
          rating: data["rating"]&.to_f,
          review_count: data["review_count"]&.to_i,
          categories: data["categories"] || [],
          photos: data["photos"] || [],
          url: data["url"]
        }
      end

      def result_message(result)
        case result
        when :created then "Restaurant added to your local database"
        when :updated then "Restaurant information updated"
        when :merged then "Restaurant merged with existing entry"
        else "Restaurant processed"
        end
      end
    end
  end
end
