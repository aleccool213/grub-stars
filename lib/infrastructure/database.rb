# frozen_string_literal: true

require "sequel"

module GrubStars
  module Database
    def self.connect(path)
      db = Sequel.sqlite(path)
      register_fuzzy_functions(db)
      db
    end

    # Register custom SQL functions for fuzzy matching
    def self.register_fuzzy_functions(db)
      # Access the underlying SQLite3::Database connection
      sqlite_db = db.synchronize { |conn| conn }

      # Levenshtein distance - number of single-character edits needed
      # to transform one string into another
      sqlite_db.create_function("levenshtein", 2) do |func, s1, s2|
        result = levenshtein_distance(s1.to_s.downcase, s2.to_s.downcase)
        func.result = result
      end

      # Simple similarity score (0.0 to 1.0) based on Levenshtein distance
      sqlite_db.create_function("similarity", 2) do |func, s1, s2|
        str1 = s1.to_s.downcase
        str2 = s2.to_s.downcase
        max_len = [str1.length, str2.length].max
        if max_len.zero?
          func.result = 1.0
        else
          distance = levenshtein_distance(str1, str2)
          func.result = 1.0 - (distance.to_f / max_len)
        end
      end

      # Word-based fuzzy match: handles both single and multi-word queries
      # Single word: "monkys" vs "Flying Monkeys Brewery" -> compares with each word
      # Multi-word: "test bakery" vs "Test Bakery" -> matches word-by-word
      sqlite_db.create_function("fuzzy_match", 2) do |func, text, query|
        text_str = text.to_s.downcase
        query_str = query.to_s.downcase

        text_words = text_str.split(/\s+/)
        query_words = query_str.split(/\s+/)

        if query_words.length == 1
          # Single word query: find best matching word in text
          best_score = 0.0
          text_words.each do |word|
            max_len = [word.length, query_str.length].max
            next if max_len.zero?

            distance = levenshtein_distance(word, query_str)
            score = 1.0 - (distance.to_f / max_len)
            best_score = score if score > best_score
          end
          func.result = best_score
        else
          # Multi-word query: average the best match for each query word
          total_score = 0.0
          query_words.each do |qword|
            best_word_score = 0.0
            text_words.each do |tword|
              max_len = [tword.length, qword.length].max
              next if max_len.zero?

              distance = levenshtein_distance(tword, qword)
              score = 1.0 - (distance.to_f / max_len)
              best_word_score = score if score > best_word_score
            end
            total_score += best_word_score
          end
          func.result = total_score / query_words.length
        end
      end
    end

    # Classic Levenshtein distance algorithm
    def self.levenshtein_distance(s1, s2)
      return s2.length if s1.empty?
      return s1.length if s2.empty?

      # Create matrix
      rows = s1.length + 1
      cols = s2.length + 1
      dist = Array.new(rows) { Array.new(cols, 0) }

      # Initialize first row and column
      (0...rows).each { |i| dist[i][0] = i }
      (0...cols).each { |j| dist[0][j] = j }

      # Fill in the rest
      (1...rows).each do |i|
        (1...cols).each do |j|
          cost = s1[i - 1] == s2[j - 1] ? 0 : 1
          dist[i][j] = [
            dist[i - 1][j] + 1,      # deletion
            dist[i][j - 1] + 1,      # insertion
            dist[i - 1][j - 1] + cost # substitution
          ].min
        end
      end

      dist[rows - 1][cols - 1]
    end

    def self.create_schema(db)
      db.create_table? :restaurants do
        primary_key :id
        String :name, null: false
        String :address
        Float :latitude
        Float :longitude
        String :phone
        String :location  # Location where this restaurant was indexed (e.g., "barrie, ontario")
        DateTime :created_at
        DateTime :updated_at
      end

      # Track external IDs from each source (allows multiple sources per restaurant)
      db.create_table? :external_ids do
        primary_key :id
        foreign_key :restaurant_id, :restaurants, on_delete: :cascade
        String :source, null: false      # yelp, google, tripadvisor
        String :external_id, null: false # the ID from that source
        unique [:source, :external_id]   # each source ID is unique
        index [:restaurant_id, :source]
      end

      db.create_table? :categories do
        primary_key :id
        String :name, null: false, unique: true
      end

      db.create_table? :restaurant_categories do
        foreign_key :restaurant_id, :restaurants, on_delete: :cascade
        foreign_key :category_id, :categories, on_delete: :cascade
        primary_key [:restaurant_id, :category_id]
      end

      db.create_table? :ratings do
        primary_key :id
        foreign_key :restaurant_id, :restaurants, on_delete: :cascade
        String :source, null: false  # yelp, google, tripadvisor
        Float :score
        Integer :review_count
        DateTime :fetched_at
      end

      db.create_table? :reviews do
        primary_key :id
        foreign_key :restaurant_id, :restaurants, on_delete: :cascade
        String :source, null: false
        String :snippet
        String :url
        DateTime :fetched_at
      end

      db.create_table? :media do
        primary_key :id
        foreign_key :restaurant_id, :restaurants, on_delete: :cascade
        String :source, null: false
        String :media_type, null: false  # photo, video
        String :url, null: false
        DateTime :fetched_at
      end

      db
    end
  end
end
