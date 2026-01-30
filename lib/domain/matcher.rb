# frozen_string_literal: true

module Domain
  # Restaurant deduplication matcher - pure business logic with no database dependencies
  class Matcher
    # Scoring weights (total: 100 points possible)
    NAME_WEIGHT = 35
    ADDRESS_WEIGHT = 20
    GPS_WEIGHT = 25
    PHONE_WEIGHT = 20

    # Threshold for considering two restaurants the same
    MATCH_THRESHOLD = 50

    # Maximum distance in meters to consider for GPS matching
    MAX_GPS_DISTANCE = 200

    def initialize(logger: nil)
      @logger = logger
    end

    # Find the best matching restaurant from a list of candidates
    # @param business_data [Hash] Business data to match (with keys: name, address, latitude, longitude, phone)
    # @param candidates [Array<Domain::Models::Restaurant>] Candidate restaurants to match against
    # @return [Hash, nil] { restaurant: <Restaurant>, score: <Integer> } or nil if no match found
    def find_match(business_data, candidates)
      log_debug("Matcher: Looking for match for '#{business_data[:name]}'")
      log_debug("Matcher: #{candidates.length} candidate(s) to compare")

      if candidates.empty?
        log_debug("Matcher: No candidates available - will create new restaurant")
        return nil
      end

      best_match = nil
      best_score = 0

      candidates.each do |candidate|
        scores = calculate_component_scores(business_data, candidate)
        score = scores.values.sum

        log_debug("Matcher: Comparing '#{business_data[:name]}' with '#{candidate.name}' (ID: #{candidate.id})")
        log_debug("Matcher:   Scores - name: #{scores[:name]}/#{NAME_WEIGHT}, address: #{scores[:address]}/#{ADDRESS_WEIGHT}, gps: #{scores[:gps]}/#{GPS_WEIGHT}, phone: #{scores[:phone]}/#{PHONE_WEIGHT}")
        log_debug("Matcher:   Total: #{score}/100 (threshold: #{MATCH_THRESHOLD})")

        if score > best_score
          best_score = score
          best_match = candidate
        end
      end

      if best_score < MATCH_THRESHOLD
        log_debug("Matcher: No match found - best score #{best_score} is below threshold #{MATCH_THRESHOLD}")
        log_debug("Matcher: Will create new restaurant for '#{business_data[:name]}'")
        return nil
      end

      log_debug("Matcher: MATCH FOUND - '#{business_data[:name]}' matches '#{best_match.name}' (score: #{best_score})")
      { restaurant: best_match, score: best_score }
    end

    # Calculate match score between business data and a restaurant
    # @param business_data [Hash] Business data with keys: name, address, latitude, longitude, phone
    # @param restaurant [Domain::Models::Restaurant] Restaurant to compare against
    # @return [Integer] Score (0-100)
    def calculate_score(business_data, restaurant)
      calculate_component_scores(business_data, restaurant).values.sum
    end

    # Calculate individual component scores for debugging
    # @param business_data [Hash] Business data with keys: name, address, latitude, longitude, phone
    # @param restaurant [Domain::Models::Restaurant] Restaurant to compare against
    # @return [Hash] Individual scores { name:, address:, gps:, phone: }
    def calculate_component_scores(business_data, restaurant)
      {
        name: name_score(business_data[:name], restaurant.name),
        address: address_score(business_data[:address], restaurant.address),
        gps: gps_score(business_data, restaurant),
        phone: phone_score(business_data[:phone], restaurant.phone)
      }
    end

    private

    def log_debug(message)
      @logger&.debug(message)
    end

    # Score based on name similarity (0-35 points)
    def name_score(name1, name2)
      return 0 if name1.nil? || name2.nil?

      similarity = string_similarity(normalize_name(name1), normalize_name(name2))
      (similarity * NAME_WEIGHT).round
    end

    # Score based on address similarity (0-20 points)
    def address_score(addr1, addr2)
      return 0 if addr1.nil? || addr2.nil?

      similarity = string_similarity(normalize_address(addr1), normalize_address(addr2))
      (similarity * ADDRESS_WEIGHT).round
    end

    # Score based on GPS proximity (0-25 points)
    # @param business_data [Hash] Business data with latitude and longitude
    # @param restaurant [Domain::Models::Restaurant] Restaurant with latitude and longitude
    def gps_score(business_data, restaurant)
      return 0 if business_data[:latitude].nil? || business_data[:longitude].nil?
      return 0 if restaurant.latitude.nil? || restaurant.longitude.nil?

      distance = haversine_distance(
        business_data[:latitude], business_data[:longitude],
        restaurant.latitude, restaurant.longitude
      )

      return 0 if distance > MAX_GPS_DISTANCE

      # Linear scale: 0m = full points, MAX_GPS_DISTANCE = 0 points
      ratio = 1.0 - (distance / MAX_GPS_DISTANCE)
      (ratio * GPS_WEIGHT).round
    end

    # Score for phone match (0 or 20 points)
    def phone_score(phone1, phone2)
      return 0 if phone1.nil? || phone2.nil?

      normalized1 = normalize_phone(phone1)
      normalized2 = normalize_phone(phone2)

      return 0 if normalized1.empty? || normalized2.empty?

      normalized1 == normalized2 ? PHONE_WEIGHT : 0
    end

    # Normalize restaurant name for comparison
    def normalize_name(name)
      name.downcase
          .gsub(/[^a-z0-9\s]/, " ") # Replace punctuation with space
          .gsub(/\s+/, " ")         # Normalize whitespace
          .strip
    end

    # Normalize address for comparison
    def normalize_address(address)
      address.downcase
             .gsub(/[^a-z0-9\s]/, "")
             .gsub(/\b(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|lane|ln)\b/, "")
             .gsub(/\s+/, " ")
             .strip
    end

    # Normalize phone number (keep only digits)
    def normalize_phone(phone)
      phone.gsub(/\D/, "")
    end

    # Calculate string similarity using Levenshtein-like approach
    # Returns value between 0.0 and 1.0
    def string_similarity(str1, str2)
      return 1.0 if str1 == str2
      return 0.0 if str1.empty? || str2.empty?

      # Use longest common subsequence ratio
      lcs_length = longest_common_subsequence(str1, str2)
      max_length = [str1.length, str2.length].max

      lcs_length.to_f / max_length
    end

    # Calculate longest common subsequence length
    def longest_common_subsequence(str1, str2)
      m = str1.length
      n = str2.length

      # Use space-optimized approach with two rows
      prev = Array.new(n + 1, 0)
      curr = Array.new(n + 1, 0)

      (1..m).each do |i|
        (1..n).each do |j|
          curr[j] = if str1[i - 1] == str2[j - 1]
                      prev[j - 1] + 1
                    else
                      [prev[j], curr[j - 1]].max
                    end
        end
        prev, curr = curr, prev
      end

      prev[n]
    end

    # Calculate distance between two GPS coordinates in meters
    # Using Haversine formula
    def haversine_distance(lat1, lon1, lat2, lon2)
      earth_radius = 6_371_000 # meters

      lat1_rad = lat1 * Math::PI / 180
      lat2_rad = lat2 * Math::PI / 180
      delta_lat = (lat2 - lat1) * Math::PI / 180
      delta_lon = (lon2 - lon1) * Math::PI / 180

      a = Math.sin(delta_lat / 2)**2 +
          Math.cos(lat1_rad) * Math.cos(lat2_rad) * Math.sin(delta_lon / 2)**2

      c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

      earth_radius * c
    end
  end
end
