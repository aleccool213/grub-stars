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
      end

      before do
        content_type :json
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
      rescue Infrastructure::Adapters::Base::APIError => e
        halt 502, json_error("API_ERROR", e.message)
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
    end
  end
end
