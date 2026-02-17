# frozen_string_literal: true

require_relative "../../domain/models/media"

module Infrastructure
  module Repositories
    # Repository for Media (photos/videos) data access
    class MediaRepository
      def initialize(db = GrubStars.db)
        @db = db
      end

      def find_by_restaurant_id(restaurant_id, media_type: nil)
        query = @db[:media].where(restaurant_id: restaurant_id)
        query = query.where(media_type: media_type) if media_type
        query.all.map { |row| to_domain_model(row) }
      end

      def find_photos(restaurant_id)
        find_by_restaurant_id(restaurant_id, media_type: "photo")
      end

      def find_videos(restaurant_id)
        find_by_restaurant_id(restaurant_id, media_type: "video")
      end

      def save(media)
        if media.id
          update(media)
        else
          create(media)
        end
      end

      # Add media without deleting existing entries. Skips URLs already stored
      # for this restaurant+source+type combination (deduplication by URL).
      def add_media(restaurant_id, source, media_type, urls)
        return if urls.nil? || urls.empty?

        existing_urls = @db[:media].where(
          restaurant_id: restaurant_id,
          source: source,
          media_type: media_type
        ).select_map(:url)

        new_urls = urls - existing_urls
        new_urls.each do |url|
          @db[:media].insert(
            restaurant_id: restaurant_id,
            source: source,
            media_type: media_type,
            url: url,
            fetched_at: Time.now
          )
        end

        new_urls.length
      end

      def replace_media(restaurant_id, source, media_type, urls)
        # Delete existing media from this source and type
        @db[:media].where(
          restaurant_id: restaurant_id,
          source: source,
          media_type: media_type
        ).delete

        # Insert new media
        return if urls.nil? || urls.empty?

        urls.each do |url|
          @db[:media].insert(
            restaurant_id: restaurant_id,
            source: source,
            media_type: media_type,
            url: url,
            fetched_at: Time.now
          )
        end
      end

      private

      def create(media)
        media.id = @db[:media].insert(
          restaurant_id: media.restaurant_id,
          source: media.source,
          media_type: media.media_type,
          url: media.url,
          fetched_at: media.fetched_at || Time.now
        )
        media
      end

      def update(media)
        @db[:media].where(id: media.id).update(
          url: media.url,
          fetched_at: media.fetched_at || Time.now
        )
        media
      end

      def to_domain_model(row)
        Domain::Models::Media.new(
          id: row[:id],
          restaurant_id: row[:restaurant_id],
          source: row[:source],
          media_type: row[:media_type],
          url: row[:url],
          fetched_at: row[:fetched_at]
        )
      end
    end
  end
end
