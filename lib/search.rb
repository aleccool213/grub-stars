# frozen_string_literal: true

module GrubStars
  class Search
    # Minimum similarity score for fuzzy matches (0.0 to 1.0)
    # 0.6 catches typos and singular/plural variations
    FUZZY_THRESHOLD = 0.6

    def initialize(db:)
      @db = db
    end

    # Search restaurants by name using hybrid matching:
    # - Substring match (LIKE) for partial matches
    # - Fuzzy match for typos
    def by_name(query)
      @db[:restaurants]
        .select_all(:restaurants)
        .select_append(Sequel.function(:fuzzy_match, :name, query).as(:match_score))
        .where(
          Sequel.|(
            Sequel.ilike(:name, "%#{query}%"),
            Sequel.lit("fuzzy_match(name, ?) >= ?", query, FUZZY_THRESHOLD)
          )
        )
        .order(Sequel.desc(:match_score), :name)
        .all
        .map { |r| enrich_restaurant(r) }
    end

    # Search restaurants by category using hybrid matching
    def by_category(category)
      @db[:restaurants]
        .join(:restaurant_categories, restaurant_id: Sequel[:restaurants][:id])
        .join(:categories, id: Sequel[:restaurant_categories][:category_id])
        .select_all(:restaurants)
        .select_append(
          Sequel.function(:similarity, Sequel[:categories][:name], category).as(:match_score)
        )
        .where(
          Sequel.|(
            Sequel.ilike(Sequel[:categories][:name], "%#{category}%"),
            Sequel.lit("similarity(categories.name, ?) >= ?", category, FUZZY_THRESHOLD)
          )
        )
        .distinct
        .order(Sequel.desc(:match_score), Sequel[:restaurants][:name])
        .all
        .map { |r| enrich_restaurant(r) }
    end

    # Get all unique categories in the database
    def all_categories
      @db[:categories].order(:name).select_map(:name)
    end

    # Get a single restaurant by ID with all details
    def get_by_id(id)
      restaurant = @db[:restaurants].where(id: id).first
      return nil unless restaurant

      enrich_restaurant_full(restaurant)
    end

    # Get a single restaurant by name (fuzzy match, returns best match)
    def get_by_name(name)
      results = by_name(name)
      return nil if results.empty?

      # Return the best match with full details
      enrich_restaurant_full(results.first)
    end

    private

    # Full enrichment with all related data (reviews, media, categories)
    def enrich_restaurant_full(restaurant)
      restaurant.merge(
        ratings: fetch_ratings(restaurant[:id]),
        reviews: fetch_reviews(restaurant[:id]),
        photos: fetch_media(restaurant[:id], "photo"),
        videos: fetch_media(restaurant[:id], "video"),
        categories: fetch_categories(restaurant[:id]),
        sources: fetch_sources(restaurant[:id])
      )
    end

    def fetch_ratings(restaurant_id)
      @db[:ratings].where(restaurant_id: restaurant_id).all
    end

    def fetch_reviews(restaurant_id)
      @db[:reviews].where(restaurant_id: restaurant_id).all
    end

    def fetch_media(restaurant_id, media_type)
      @db[:media]
        .where(restaurant_id: restaurant_id, media_type: media_type)
        .all
    end

    def fetch_categories(restaurant_id)
      @db[:categories]
        .join(:restaurant_categories, category_id: :id)
        .where(Sequel[:restaurant_categories][:restaurant_id] => restaurant_id)
        .select_map(Sequel[:categories][:name])
    end

    def fetch_sources(restaurant_id)
      @db[:external_ids]
        .where(restaurant_id: restaurant_id)
        .select_map(:source)
    end

    # Add ratings and source info to a restaurant
    def enrich_restaurant(restaurant)
      ratings = @db[:ratings]
                .where(restaurant_id: restaurant[:id])
                .all

      sources = @db[:external_ids]
                .where(restaurant_id: restaurant[:id])
                .select_map(:source)

      restaurant.merge(
        ratings: ratings,
        sources: sources
      )
    end
  end
end
