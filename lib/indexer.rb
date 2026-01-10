# frozen_string_literal: true

module GrubStars
  class Indexer
    class NoAdaptersConfiguredError < StandardError; end

    def initialize(db:, adapters: nil, matcher: nil, logger: nil)
      @db = db
      @adapters = adapters || default_adapters
      @matcher = matcher || Matcher.new(db: db)
      @logger = logger || Logger.new
    end

    def index(location:)
      configured_adapters = @adapters.select(&:configured?)

      if configured_adapters.empty?
        raise NoAdaptersConfiguredError, "No adapters configured. Set API keys in .env file."
      end

      stats = { total: 0, created: 0, updated: 0, merged: 0 }

      configured_adapters.each do |adapter|
        adapter_stats = index_with_adapter(adapter, location)
        stats[:total] += adapter_stats[:total]
        stats[:created] += adapter_stats[:created]
        stats[:updated] += adapter_stats[:updated]
        stats[:merged] += adapter_stats[:merged]
      end

      @logger.clear_line
      stats
    end

    private

    def default_adapters
      [Adapters::Yelp.new, Adapters::Google.new]
    end

    def index_with_adapter(adapter, location)
      stats = { total: 0, created: 0, updated: 0, merged: 0 }
      source = adapter.source_name

      adapter.search_all_businesses(location: location) do |biz, progress|
        @logger.progress(
          name: biz[:name],
          current: progress[:current],
          total: progress[:total],
          percent: progress[:percent]
        )

        result = store_business(biz, source)
        stats[:total] += 1
        stats[:created] += 1 if result == :created
        stats[:updated] += 1 if result == :updated
        stats[:merged] += 1 if result == :merged
      end

      stats
    end

    def store_business(data, source)
      # First, check if we already have this exact external ID from this source
      existing_by_id = find_by_external_id(data[:external_id], source)

      if existing_by_id
        update_restaurant(existing_by_id, data, source)
        return :updated
      end

      # Try to find a match using the matcher (name, address, GPS, phone)
      match_result = @matcher.find_match(data)

      if match_result
        merge_restaurant(match_result[:restaurant], data, source)
        return :merged
      end

      # No match found, create new restaurant
      create_restaurant(data, source)
      :created
    end

    def find_by_external_id(external_id, source)
      ext_record = @db[:external_ids].where(source: source, external_id: external_id).first
      return nil unless ext_record

      @db[:restaurants].where(id: ext_record[:restaurant_id]).first
    end

    def create_restaurant(data, source)
      now = Time.now

      restaurant_id = @db[:restaurants].insert(
        name: data[:name],
        address: data[:address],
        latitude: data[:latitude],
        longitude: data[:longitude],
        phone: data[:phone],
        created_at: now,
        updated_at: now
      )

      store_external_id(restaurant_id, source, data[:external_id])
      store_categories(restaurant_id, data[:categories])
      store_rating(restaurant_id, source, data)
      store_photos(restaurant_id, source, data[:photos])

      restaurant_id
    end

    def update_restaurant(existing, data, source)
      now = Time.now

      @db[:restaurants].where(id: existing[:id]).update(
        name: data[:name],
        address: data[:address],
        latitude: data[:latitude],
        longitude: data[:longitude],
        phone: data[:phone],
        updated_at: now
      )

      store_categories(existing[:id], data[:categories])
      store_rating(existing[:id], source, data)
      store_photos(existing[:id], source, data[:photos])

      existing[:id]
    end

    def merge_restaurant(existing, data, source)
      updates = { updated_at: Time.now }

      # Fill in missing core data from new source
      updates[:phone] = data[:phone] if existing[:phone].nil? && data[:phone]
      updates[:address] = data[:address] if existing[:address].nil? && data[:address]
      updates[:latitude] = data[:latitude] if existing[:latitude].nil? && data[:latitude]
      updates[:longitude] = data[:longitude] if existing[:longitude].nil? && data[:longitude]

      @db[:restaurants].where(id: existing[:id]).update(updates)

      store_external_id(existing[:id], source, data[:external_id])
      store_categories(existing[:id], data[:categories])
      store_rating(existing[:id], source, data)
      store_photos(existing[:id], source, data[:photos])

      existing[:id]
    end

    def store_external_id(restaurant_id, source, external_id)
      return if external_id.nil?

      begin
        @db[:external_ids].insert(
          restaurant_id: restaurant_id,
          source: source,
          external_id: external_id
        )
      rescue Sequel::UniqueConstraintViolation
        # Already exists, ignore
      end
    end

    def store_categories(restaurant_id, categories)
      return if categories.nil? || categories.empty?

      categories.each do |category_name|
        category = @db[:categories].where(name: category_name).first
        unless category
          category_id = @db[:categories].insert(name: category_name)
          category = { id: category_id }
        end

        begin
          @db[:restaurant_categories].insert(
            restaurant_id: restaurant_id,
            category_id: category[:id]
          )
        rescue Sequel::UniqueConstraintViolation
          # Already linked, ignore
        end
      end
    end

    def store_rating(restaurant_id, source, data)
      return unless data[:rating]

      existing = @db[:ratings].where(restaurant_id: restaurant_id, source: source).first

      rating_data = {
        score: data[:rating],
        review_count: data[:review_count],
        fetched_at: Time.now
      }

      if existing
        @db[:ratings].where(id: existing[:id]).update(rating_data)
      else
        @db[:ratings].insert(rating_data.merge(
          restaurant_id: restaurant_id,
          source: source
        ))
      end
    end

    def store_photos(restaurant_id, source, photos)
      return if photos.nil? || photos.empty?

      @db[:media].where(restaurant_id: restaurant_id, source: source, media_type: "photo").delete

      photos.each do |url|
        @db[:media].insert(
          restaurant_id: restaurant_id,
          source: source,
          media_type: "photo",
          url: url,
          fetched_at: Time.now
        )
      end
    end
  end
end
