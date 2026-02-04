# frozen_string_literal: true

module Domain
  module Models
    # Restaurant domain model - pure Ruby object with no database dependencies
    class Restaurant
      attr_accessor :id, :name, :address, :latitude, :longitude, :phone, :location,
                    :description, :created_at, :updated_at

      # Associated collections (loaded separately by repositories)
      attr_accessor :ratings, :reviews, :media, :categories, :external_ids

      def initialize(attributes = {})
        @id = attributes[:id]
        @name = attributes[:name]
        @address = attributes[:address]
        @latitude = attributes[:latitude]
        @longitude = attributes[:longitude]
        @phone = attributes[:phone]
        @location = attributes[:location]
        @description = attributes[:description]
        @created_at = attributes[:created_at]
        @updated_at = attributes[:updated_at]

        # Initialize empty collections
        @ratings = attributes[:ratings] || []
        @reviews = attributes[:reviews] || []
        @media = attributes[:media] || []
        @categories = attributes[:categories] || []
        @external_ids = attributes[:external_ids] || []
      end

      # Business logic: Calculate distance to another restaurant (in km)
      def distance_to(other_restaurant)
        return nil unless latitude && longitude && other_restaurant.latitude && other_restaurant.longitude

        # Haversine formula for great-circle distance
        lat1_rad = latitude * Math::PI / 180
        lat2_rad = other_restaurant.latitude * Math::PI / 180
        delta_lat = (other_restaurant.latitude - latitude) * Math::PI / 180
        delta_lon = (other_restaurant.longitude - longitude) * Math::PI / 180

        a = Math.sin(delta_lat / 2)**2 +
            Math.cos(lat1_rad) * Math.cos(lat2_rad) *
            Math.sin(delta_lon / 2)**2

        c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

        6371.0 * c # Earth's radius in km
      end

      # Business logic: Get photos only
      def photos
        media.select { |m| m.media_type == "photo" }
      end

      # Business logic: Get videos only
      def videos
        media.select { |m| m.media_type == "video" }
      end

      # Business logic: Get category names
      def category_names
        categories.map(&:name)
      end

      # Business logic: Get sources this restaurant is indexed from
      def sources
        external_ids.map(&:source).uniq
      end

      # Convert to hash for presentation layer
      def to_h
        {
          id: id,
          name: name,
          address: address,
          latitude: latitude,
          longitude: longitude,
          phone: phone,
          location: location,
          description: description,
          created_at: created_at,
          updated_at: updated_at,
          ratings: ratings.map(&:to_h),
          reviews: reviews.map(&:to_h),
          photos: photos.map(&:to_h),
          videos: videos.map(&:to_h),
          categories: category_names,
          sources: sources,
          external_ids: external_ids.map(&:to_h)
        }
      end

      # Convert to simple hash (without associations)
      def to_simple_h
        {
          id: id,
          name: name,
          address: address,
          latitude: latitude,
          longitude: longitude,
          phone: phone,
          location: location,
          description: description
        }
      end
    end
  end
end
