# frozen_string_literal: true

require "sinatra/base"
require "json"
require_relative "../grub_stars"
require_relative "job_manager"

module GrubStars
  module API
    class Server < Sinatra::Base
      MAX_CONCURRENT_JOBS = 3
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

      # Index restaurants (async)
      post "/index" do
        body = parse_json_body
        location = body["location"]
        category = body["category"]

        unless location
          halt 400, json_error("INVALID_REQUEST", "location is required")
        end

        if job_manager.active_count >= MAX_CONCURRENT_JOBS
          halt 429, json_error("TOO_MANY_JOBS", "Maximum #{MAX_CONCURRENT_JOBS} concurrent jobs allowed")
        end

        job_id = job_manager.enqueue do
          service = Services::IndexRestaurantsService.new
          service.index(location: location, categories: category)
        end

        status 202
        json_response({ job_id: job_id }, location: location, category: category)
      end

      # List all jobs
      get "/jobs" do
        jobs = job_manager.all.map { |j| serialize_job(j) }
        json_response(jobs, count: jobs.length)
      end

      # Get job status
      get "/jobs/:id" do
        job = job_manager.get(params[:id])

        if job.nil?
          halt 404, json_error("NOT_FOUND", "Job with ID #{params[:id]} not found")
        end

        json_response(serialize_job(job))
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

      def job_manager
        JobManager.instance
      end

      def serialize_job(job)
        {
          id: job.id,
          status: job.status.to_s,
          result: job.result,
          error: job.error,
          created_at: job.created_at&.iso8601,
          completed_at: job.completed_at&.iso8601
        }
      end
    end
  end
end
