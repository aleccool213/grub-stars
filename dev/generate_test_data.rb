#!/usr/bin/env ruby
# frozen_string_literal: true

# Test Data Generator for Mock Server
# Generates comprehensive, realistic restaurant data for Yelp, Google, and TripAdvisor APIs
#
# Usage:
#   ruby dev/generate_test_data.rb small    # 30 restaurants
#   ruby dev/generate_test_data.rb medium   # 150 restaurants
#   ruby dev/generate_test_data.rb large    # 1000 restaurants

require "json"
require "securerandom"

# Restaurant name components for generation
CUISINE_TYPES = {
  "bakeries" => {
    yelp: "bakeries",
    google: "bakery",
    names: ["Bakery", "Boulangerie", "Bread Co.", "Patisserie", "Artisan Bakery", "Daily Bread", "The Oven"],
    prefixes: ["Golden", "Rising", "Fresh", "Warm", "Sweet", "Rustic", "Urban", "Corner", "Village"]
  },
  "italian" => {
    yelp: "italian",
    google: "italian_restaurant",
    names: ["Ristorante", "Trattoria", "Osteria", "Pizzeria", "Cucina", "Bella", "Casa"],
    prefixes: ["Nonna's", "Luigi's", "Mario's", "Bella", "Casa", "Il", "La"]
  },
  "sushi" => {
    yelp: "sushi",
    google: "japanese_restaurant",
    names: ["Sushi", "Sushi Bar", "Japanese Restaurant", "Izakaya", "Ramen House"],
    prefixes: ["Tokyo", "Osaka", "Sakura", "Zen", "Koi", "Dragon", "Samurai"]
  },
  "coffee" => {
    yelp: "coffee",
    google: "cafe",
    names: ["Coffee", "Coffee Co.", "Cafe", "Espresso Bar", "Coffee House", "Roasters"],
    prefixes: ["Daily", "Morning", "Steaming", "Bean", "Brew", "Ground", "Java"]
  },
  "mexican" => {
    yelp: "mexican",
    google: "mexican_restaurant",
    names: ["Taqueria", "Cantina", "Mexican Grill", "Burrito Bar", "Tacos"],
    prefixes: ["El", "La", "Los", "Don", "Señor", "Casa"]
  },
  "vietnamese" => {
    yelp: "vietnamese",
    google: "vietnamese_restaurant",
    names: ["Pho", "Vietnamese Restaurant", "Banh Mi", "Pho House"],
    prefixes: ["Saigon", "Hanoi", "Golden", "Pho"]
  },
  "breweries" => {
    yelp: "breweries",
    google: "brewery",
    names: ["Brewery", "Brewing Co.", "Craft Brewery", "Brewhouse", "Taproom"],
    prefixes: ["Flying", "Barking", "Stone", "Iron", "Steam", "Hop", "Barrel"]
  },
  "thai" => {
    yelp: "thai",
    google: "thai_restaurant",
    names: ["Thai Restaurant", "Thai Cuisine", "Thai Kitchen", "Thai House"],
    prefixes: ["Bangkok", "Siam", "Golden", "Royal", "Spice"]
  },
  "indian" => {
    yelp: "indian",
    google: "indian_restaurant",
    names: ["Indian Restaurant", "Curry House", "Tandoori", "Masala"],
    prefixes: ["Taj", "Royal", "Spice", "Mumbai", "Delhi", "India"]
  },
  "burgers" => {
    yelp: "burgers",
    google: "hamburger_restaurant",
    names: ["Burger Joint", "Burgers", "Burger Bar", "Grill"],
    prefixes: ["Big", "Juicy", "Prime", "The", "Burger"]
  }
}

LOCATIONS = {
  "barrie" => {
    city: "Barrie",
    state: "ON",
    country: "CA",
    center_lat: 44.3894,
    center_lng: -79.6903,
    # Areas with different densities
    areas: [
      { name: "Downtown", lat: 44.3894, lng: -79.6903, density: :high },
      { name: "North End", lat: 44.4100, lng: -79.6800, density: :medium },
      { name: "South End", lat: 44.3700, lng: -79.7000, density: :medium },
      { name: "Waterfront", lat: 44.3850, lng: -79.6750, density: :high },
      { name: "West Side", lat: 44.3900, lng: -79.7200, density: :low }
    ]
  },
  "toronto" => {
    city: "Toronto",
    state: "ON",
    country: "CA",
    center_lat: 43.6532,
    center_lng: -79.3832,
    areas: [
      { name: "Downtown", lat: 43.6532, lng: -79.3832, density: :high },
      { name: "Midtown", lat: 43.6900, lng: -79.4000, density: :high },
      { name: "East End", lat: 43.6700, lng: -79.3000, density: :medium },
      { name: "West End", lat: 43.6500, lng: -79.4500, density: :medium },
      { name: "North York", lat: 43.7600, lng: -79.4100, density: :medium }
    ]
  },
  "vancouver" => {
    city: "Vancouver",
    state: "BC",
    country: "CA",
    center_lat: 49.2827,
    center_lng: -123.1207,
    areas: [
      { name: "Downtown", lat: 49.2827, lng: -123.1207, density: :high },
      { name: "Gastown", lat: 49.2835, lng: -123.1080, density: :high },
      { name: "Kitsilano", lat: 49.2700, lng: -123.1600, density: :medium },
      { name: "Commercial Drive", lat: 49.2700, lng: -123.0700, density: :medium },
      { name: "West End", lat: 49.2900, lng: -123.1400, density: :high }
    ]
  }
}

STREET_NAMES = ["Main", "Dunlop", "Maple", "Oak", "Pine", "King", "Queen", "Bay", "Yonge", "College", "Bloor", "Robson", "Granville"]
STREET_TYPES = ["Street", "Avenue", "Road", "Boulevard", "Drive", "Lane"]
DIRECTIONS = ["North", "South", "East", "West", ""]

REVIEW_TEMPLATES = {
  5 => [
    "Absolutely amazing! {specific}. Will definitely be back!",
    "Best {cuisine} in {city}! {specific}. Highly recommend!",
    "Outstanding experience from start to finish. {specific}. Five stars!",
    "Incredible! {specific}. This is now my go-to spot.",
    "Perfect in every way. {specific}. Can't wait to return!",
    "Exceeded all expectations! {specific}. A must-visit!"
  ],
  4 => [
    "Really good! {specific}. Would come back.",
    "Great experience overall. {specific}. Recommended.",
    "Solid choice. {specific}. Will return.",
    "Very good! {specific}. Happy with our visit.",
    "Enjoyable meal. {specific}. Good value.",
    "Nice spot. {specific}. Worth a visit."
  ],
  3 => [
    "It was okay. {specific}. Might give it another try.",
    "Decent but not spectacular. {specific}. Average experience.",
    "Middle of the road. {specific}. Could be better.",
    "Acceptable. {specific}. Nothing special.",
    "Fine for what it is. {specific}. Not sure if I'd return.",
    "Hit or miss. {specific}. Your mileage may vary."
  ],
  2 => [
    "Disappointing. {specific}. Expected more.",
    "Not impressed. {specific}. Wouldn't recommend.",
    "Below average. {specific}. Many better options.",
    "Underwhelming experience. {specific}. Skip it.",
    "Not worth it. {specific}. Try somewhere else.",
    "Unfortunate visit. {specific}. Won't be back."
  ],
  1 => [
    "Terrible experience. {specific}. Avoid at all costs.",
    "Absolutely awful. {specific}. Save your money.",
    "Worst meal I've had. {specific}. Stay away.",
    "Complete disaster. {specific}. Zero stars if I could.",
    "Horrible. {specific}. Don't waste your time.",
    "Extremely disappointed. {specific}. Never again."
  ]
}

REVIEW_SPECIFICS = {
  bakeries: ["The croissants were perfectly flaky", "Fresh bread daily", "Amazing pastries", "Great coffee too", "Cozy atmosphere", "Long lines but worth it"],
  italian: ["The pasta was homemade", "Authentic Italian flavors", "Great wine selection", "Generous portions", "Romantic ambiance", "Family-owned"],
  sushi: ["Fresh fish", "Creative rolls", "Skilled chefs", "Good sake selection", "Authentic Japanese", "Beautiful presentation"],
  coffee: ["Perfect latte", "Great beans", "Friendly baristas", "Cozy seating", "Good wifi", "Nice vibe for working"],
  mexican: ["Authentic flavors", "Great tacos", "Fresh guacamole", "Strong margaritas", "Generous portions", "Spicy salsa"],
  vietnamese: ["Perfect pho", "Fresh ingredients", "Big bowls", "Great value", "Authentic taste", "Quick service"],
  breweries: ["Great beer selection", "Nice flights", "Good food too", "Cool atmosphere", "Knowledgeable staff", "Rotating taps"],
  thai: ["Perfect spice level", "Authentic Thai", "Great curries", "Fresh ingredients", "Friendly service", "Good lunch specials"],
  indian: ["Amazing curry", "Fresh naan", "Great tandoori", "Spicy as requested", "Generous portions", "Good vegetarian options"],
  burgers: ["Juicy burgers", "Great fries", "Quality beef", "Creative toppings", "Cooked perfectly", "Good value"]
}

class TestDataGenerator
  attr_reader :size, :restaurants_per_location

  def initialize(size)
    @size = size
    @restaurants_per_location = case size
    when "small" then 10  # 30 total (10 per location × 3 locations)
    when "medium" then 50  # 150 total
    when "large" then 333  # ~1000 total
    else
      raise "Invalid size. Use: small, medium, or large"
    end
  end

  def generate!
    puts "Generating #{size} dataset..."
    puts "  - #{restaurants_per_location} restaurants per location"
    puts "  - #{LOCATIONS.size} locations"
    puts "  - ~#{restaurants_per_location * LOCATIONS.size} total restaurants"
    puts ""

    all_yelp_businesses = []
    all_google_places = []
    all_tripadvisor_locations = []
    all_yelp_reviews = {}
    all_google_reviews = {}
    all_tripadvisor_reviews = {}
    all_google_details = {}
    all_tripadvisor_details = {}
    all_tripadvisor_photos = {}

    LOCATIONS.each do |location_key, location_data|
      puts "Generating data for #{location_data[:city]}..."

      restaurants = generate_restaurants_for_location(location_key, location_data)

      restaurants.each do |restaurant|
        # Yelp data
        all_yelp_businesses << restaurant[:yelp_business]
        if restaurant[:yelp_reviews]
          all_yelp_reviews[restaurant[:yelp_business]["id"]] = restaurant[:yelp_reviews]
        end

        # Google data
        all_google_places << restaurant[:google_place]
        all_google_details[restaurant[:google_place]["place_id"]] = restaurant[:google_details]
        if restaurant[:google_reviews]
          all_google_reviews[restaurant[:google_place]["place_id"]] = restaurant[:google_reviews]
        end

        # TripAdvisor data
        all_tripadvisor_locations << restaurant[:tripadvisor_location]
        all_tripadvisor_details[restaurant[:tripadvisor_location]["location_id"]] = restaurant[:tripadvisor_details]
        if restaurant[:tripadvisor_reviews]
          all_tripadvisor_reviews[restaurant[:tripadvisor_location]["location_id"]] = restaurant[:tripadvisor_reviews]
        end
        if restaurant[:tripadvisor_photos]
          all_tripadvisor_photos[restaurant[:tripadvisor_location]["location_id"]] = restaurant[:tripadvisor_photos]
        end
      end
    end

    # Write fixture files
    write_fixture("yelp_businesses.json", { total: all_yelp_businesses.size, businesses: all_yelp_businesses, region: { center: { latitude: 44.3894, longitude: -79.6903 } } })
    write_fixture("yelp_reviews.json", all_yelp_reviews)

    write_fixture("google_businesses.json", { status: "OK", results: all_google_places })
    write_fixture("google_details.json", all_google_details)
    write_fixture("google_reviews.json", all_google_reviews)

    write_fixture("tripadvisor_locations.json", { data: all_tripadvisor_locations })
    write_fixture("tripadvisor_details.json", all_tripadvisor_details)
    write_fixture("tripadvisor_reviews.json", all_tripadvisor_reviews)
    write_fixture("tripadvisor_photos.json", all_tripadvisor_photos)

    puts ""
    puts "✓ Generated #{all_yelp_businesses.size} restaurants"
    puts "✓ Fixture files written to dev/fixtures/"
  end

  private

  def generate_restaurants_for_location(location_key, location_data)
    restaurants = []

    # Distribute restaurants across areas based on density
    area_counts = distribute_across_areas(location_data[:areas], restaurants_per_location)

    area_counts.each do |area, count|
      count.times do
        restaurants << generate_restaurant(location_key, location_data, area)
      end
    end

    restaurants
  end

  def distribute_across_areas(areas, total_count)
    # Calculate weights based on density
    weights = areas.map do |area|
      case area[:density]
      when :high then 3
      when :medium then 2
      when :low then 1
      end
    end

    total_weight = weights.sum
    distribution = {}

    areas.each_with_index do |area, index|
      proportion = weights[index].to_f / total_weight
      count = (total_count * proportion).round
      distribution[area] = count
    end

    # Adjust to ensure exact total
    difference = total_count - distribution.values.sum
    if difference != 0
      # Add/subtract from highest density area
      high_density_area = areas.find { |a| a[:density] == :high }
      distribution[high_density_area] += difference
    end

    distribution
  end

  def generate_restaurant(location_key, location_data, area)
    # Pick a random cuisine type
    cuisine_key, cuisine_data = CUISINE_TYPES.to_a.sample

    # Generate name with slight variations for Yelp vs Google vs TripAdvisor
    base_name = "#{cuisine_data[:prefixes].sample} #{cuisine_data[:names].sample}"
    yelp_name = add_name_variation(base_name, :yelp)
    google_name = add_name_variation(base_name, :google)
    tripadvisor_name = add_name_variation(base_name, :tripadvisor)

    # Generate coordinates near area center with some randomness
    lat, lng = generate_coordinates(area[:lat], area[:lng])

    # Generate address
    address = generate_address(location_data)

    # Generate ratings (slightly different across platforms)
    base_rating = weighted_random_rating
    yelp_rating = (base_rating + rand(-0.3..0.3)).round(1).clamp(1.0, 5.0)
    google_rating = (base_rating + rand(-0.3..0.3)).round(1).clamp(1.0, 5.0)
    tripadvisor_rating = (base_rating + rand(-0.3..0.3)).round(1).clamp(1.0, 5.0)

    # Generate review counts (varied distribution)
    review_count = weighted_random_review_count
    yelp_review_count = (review_count + rand(-20..20)).clamp(0, 10000)
    google_review_count = (review_count + rand(-30..30)).clamp(0, 10000)
    tripadvisor_review_count = (review_count + rand(-15..15)).clamp(0, 10000)

    # Generate photo counts (0 to many)
    photo_count = weighted_random_photo_count

    # Price level ($ to $$$$)
    price_level = rand(1..4)

    # Phone number
    phone = generate_phone_number(location_data[:state])

    # Generate IDs
    yelp_id = generate_id(yelp_name, location_key)
    google_place_id = "ChIJ#{SecureRandom.hex(12)}"
    tripadvisor_id = rand(100000..999999).to_s

    # Decide if this restaurant has reviews (80% chance)
    has_reviews = rand < 0.8

    # Decide if this restaurant has photos (70% chance, unless photo_count is 0)
    has_photos = photo_count > 0 && rand < 0.7

    {
      yelp_business: generate_yelp_business(yelp_id, yelp_name, cuisine_data, lat, lng, yelp_rating, yelp_review_count, address, location_data, phone, photo_count, price_level),
      yelp_reviews: has_reviews ? generate_yelp_reviews(yelp_id, cuisine_key, location_data[:city], [yelp_review_count, 10].min) : nil,

      google_place: generate_google_place(google_place_id, google_name, cuisine_data, lat, lng, google_rating, google_review_count, address, location_data, photo_count),
      google_details: generate_google_details(google_place_id, google_name, cuisine_data, lat, lng, google_rating, google_review_count, address, location_data, phone, photo_count, price_level),
      google_reviews: has_reviews ? generate_google_reviews(google_place_id, cuisine_key, location_data[:city], [google_review_count, 5].min) : nil,

      tripadvisor_location: generate_tripadvisor_location(tripadvisor_id, tripadvisor_name, cuisine_data, lat, lng, tripadvisor_rating, tripadvisor_review_count, address, location_data),
      tripadvisor_details: generate_tripadvisor_details(tripadvisor_id, tripadvisor_name, cuisine_data, lat, lng, tripadvisor_rating, tripadvisor_review_count, address, location_data, phone, price_level),
      tripadvisor_reviews: has_reviews ? generate_tripadvisor_reviews(tripadvisor_id, cuisine_key, location_data[:city], [tripadvisor_review_count, 10].min) : nil,
      tripadvisor_photos: has_photos ? generate_tripadvisor_photos(tripadvisor_id, photo_count) : nil
    }
  end

  def add_name_variation(name, platform)
    # Add slight variations to test matcher
    variations = {
      yelp: ["", " Restaurant", " & Grill", " Co."],
      google: ["", " - #{LOCATIONS.values.sample[:city]}", ""],
      tripadvisor: ["", " Restaurant", ""]
    }

    variation = variations[platform].sample
    name + variation
  end

  def generate_coordinates(center_lat, center_lng)
    # Add random offset (roughly within 1-2km radius)
    lat_offset = rand(-0.01..0.01)
    lng_offset = rand(-0.01..0.01)

    [(center_lat + lat_offset).round(6), (center_lng + lng_offset).round(6)]
  end

  def generate_address(location_data)
    number = rand(1..999)
    street = STREET_NAMES.sample
    street_type = STREET_TYPES.sample
    direction = DIRECTIONS.sample

    {
      street1: "#{number} #{street} #{street_type} #{direction}".strip,
      city: location_data[:city],
      state: location_data[:state],
      country: location_data[:country],
      postal_code: generate_postal_code(location_data[:state])
    }
  end

  def generate_postal_code(state)
    case state
    when "ON"
      "L#{rand(0..9)}#{('A'..'Z').to_a.sample} #{rand(0..9)}#{('A'..'Z').to_a.sample}#{rand(0..9)}"
    when "BC"
      "V#{rand(0..9)}#{('A'..'Z').to_a.sample} #{rand(0..9)}#{('A'..'Z').to_a.sample}#{rand(0..9)}"
    else
      "A1A 1A1"
    end
  end

  def generate_phone_number(state)
    area_code = case state
    when "ON" then ["705", "416", "647", "437"].sample
    when "BC" then ["604", "778", "236"].sample
    else "555"
    end

    "+1#{area_code}#{rand(1000000..9999999)}"
  end

  def generate_id(name, location)
    name.downcase.gsub(/[^a-z0-9]+/, "-") + "-" + location
  end

  def weighted_random_rating
    # Weight towards higher ratings (realistic distribution)
    rand_val = rand
    case rand_val
    when 0.0..0.05 then rand(1.0..2.0)  # 5% bad (1-2 stars)
    when 0.05..0.15 then rand(2.0..3.0) # 10% mediocre (2-3 stars)
    when 0.15..0.40 then rand(3.0..4.0) # 25% good (3-4 stars)
    when 0.40..1.0 then rand(4.0..5.0)  # 60% great (4-5 stars)
    end
  end

  def weighted_random_review_count
    # Realistic distribution: most have moderate reviews, some have many, few have tons
    rand_val = rand
    case rand_val
    when 0.0..0.20 then rand(0..20)      # 20% very few reviews
    when 0.20..0.60 then rand(20..100)   # 40% moderate reviews
    when 0.60..0.85 then rand(100..500)  # 25% many reviews
    when 0.85..0.95 then rand(500..1500) # 10% lots of reviews
    when 0.95..1.0 then rand(1500..5000) # 5% extremely popular
    end
  end

  def weighted_random_photo_count
    # 30% have no photos, others have varying amounts
    rand_val = rand
    case rand_val
    when 0.0..0.30 then 0              # 30% no photos
    when 0.30..0.60 then rand(1..3)    # 30% few photos
    when 0.60..0.85 then rand(3..10)   # 25% moderate photos
    when 0.85..1.0 then rand(10..30)   # 15% many photos
    end
  end

  # Yelp data generators
  def generate_yelp_business(id, name, cuisine_data, lat, lng, rating, review_count, address, location_data, phone, photo_count, price_level)
    {
      "id" => id,
      "alias" => id,
      "name" => name,
      "image_url" => photo_count > 0 ? "https://example.com/photos/#{id}-1.jpg" : "",
      "is_closed" => false,
      "url" => "https://www.yelp.com/biz/#{id}",
      "review_count" => review_count,
      "categories" => [
        { "alias" => cuisine_data[:yelp], "title" => cuisine_data[:yelp].capitalize }
      ],
      "rating" => rating,
      "coordinates" => {
        "latitude" => lat,
        "longitude" => lng
      },
      "transactions" => [],
      "price" => "$" * price_level,
      "location" => {
        "address1" => address[:street1],
        "address2" => "",
        "address3" => "",
        "city" => address[:city],
        "zip_code" => address[:postal_code],
        "country" => address[:country],
        "state" => address[:state],
        "display_address" => ["#{address[:street1]}", "#{address[:city]}, #{address[:state]} #{address[:postal_code]}"]
      },
      "phone" => phone,
      "display_phone" => format_phone_display(phone),
      "distance" => rand(100..5000).round(2),
      "photos" => photo_count > 0 ? (1..photo_count).map { |i| "https://example.com/photos/#{id}-#{i}.jpg" } : []
    }
  end

  def generate_yelp_reviews(business_id, cuisine_key, city, count)
    reviews = (1..count).map do |i|
      rating = weighted_random_rating.round
      {
        "id" => "#{business_id}-review-#{i}",
        "rating" => rating,
        "user" => {
          "id" => SecureRandom.hex(8),
          "profile_url" => "https://www.yelp.com/user_details?userid=#{SecureRandom.hex(8)}",
          "image_url" => "https://example.com/users/#{SecureRandom.hex(4)}.jpg",
          "name" => generate_reviewer_name
        },
        "text" => generate_review_text(rating, cuisine_key, city),
        "time_created" => generate_review_date,
        "url" => "https://www.yelp.com/biz/#{business_id}?hrid=#{SecureRandom.hex(8)}"
      }
    end

    {
      "reviews" => reviews,
      "total" => count,
      "possible_languages" => ["en"]
    }
  end

  # Google data generators
  def generate_google_place(place_id, name, cuisine_data, lat, lng, rating, review_count, address, location_data, photo_count)
    {
      "place_id" => place_id,
      "name" => name,
      "formatted_address" => "#{address[:street1]}, #{address[:city]}, #{address[:state]} #{address[:postal_code]}, Canada",
      "geometry" => {
        "location" => {
          "lat" => lat,
          "lng" => lng
        }
      },
      "rating" => rating,
      "user_ratings_total" => review_count,
      "types" => [cuisine_data[:google], "restaurant", "food", "point_of_interest", "establishment"],
      "photos" => photo_count > 0 ? (1..photo_count).map { |i| { "photo_reference" => "#{place_id}-photo-#{i}" } } : [],
      "opening_hours" => { "open_now" => [true, false].sample }
    }
  end

  def generate_google_details(place_id, name, cuisine_data, lat, lng, rating, review_count, address, location_data, phone, photo_count, price_level)
    {
      "status" => "OK",
      "result" => {
        "place_id" => place_id,
        "name" => name,
        "formatted_address" => "#{address[:street1]}, #{address[:city]}, #{address[:state]} #{address[:postal_code]}, Canada",
        "formatted_phone_number" => format_phone_display(phone),
        "geometry" => {
          "location" => {
            "lat" => lat,
            "lng" => lng
          }
        },
        "rating" => rating,
        "user_ratings_total" => review_count,
        "price_level" => price_level,
        "types" => [cuisine_data[:google], "restaurant", "food", "point_of_interest", "establishment"],
        "website" => "https://www.example-restaurant-#{place_id[0..8]}.com",
        "url" => "https://maps.google.com/?cid=#{rand(10**15..10**16)}",
        "photos" => photo_count > 0 ? (1..photo_count).map { |i| { "photo_reference" => "#{place_id}-photo-#{i}", "width" => 4032, "height" => 3024 } } : []
      }
    }
  end

  def generate_google_reviews(place_id, cuisine_key, city, count)
    reviews = (1..count).map do |i|
      rating = weighted_random_rating.round
      {
        "author_name" => generate_reviewer_name,
        "author_url" => "https://www.google.com/maps/contrib/#{rand(10**18..10**19)}",
        "language" => "en",
        "profile_photo_url" => "https://example.com/users/#{SecureRandom.hex(4)}.jpg",
        "rating" => rating,
        "relative_time_description" => generate_relative_time,
        "text" => generate_review_text(rating, cuisine_key, city),
        "time" => Time.now.to_i - rand(1..365) * 24 * 60 * 60
      }
    end

    {
      "status" => "OK",
      "result" => {
        "reviews" => reviews
      }
    }
  end

  # TripAdvisor data generators
  def generate_tripadvisor_location(location_id, name, cuisine_data, lat, lng, rating, review_count, address, location_data)
    {
      "location_id" => location_id,
      "name" => name,
      "address_obj" => {
        "street1" => address[:street1],
        "city" => address[:city],
        "state" => address[:state],
        "postalcode" => address[:postal_code],
        "country" => "Canada",
        "latitude" => lat.to_s,
        "longitude" => lng.to_s
      },
      "rating" => rating.to_s,
      "num_reviews" => review_count.to_s,
      "web_url" => "https://www.tripadvisor.com/Restaurant_Review-g154979-d#{location_id}-Reviews-#{name.gsub(/\s+/, '_')}-#{address[:city]}_#{address[:state]}.html",
      "subcategory" => [
        { "name" => cuisine_data[:yelp].capitalize, "localized_name" => cuisine_data[:yelp].capitalize }
      ]
    }
  end

  def generate_tripadvisor_details(location_id, name, cuisine_data, lat, lng, rating, review_count, address, location_data, phone, price_level)
    {
      "location_id" => location_id,
      "name" => name,
      "description" => "A #{cuisine_data[:yelp]} restaurant in #{address[:city]}.",
      "web_url" => "https://www.tripadvisor.com/Restaurant_Review-g154979-d#{location_id}",
      "address_obj" => {
        "street1" => address[:street1],
        "city" => address[:city],
        "state" => address[:state],
        "postalcode" => address[:postal_code],
        "country" => "Canada",
        "latitude" => lat.to_s,
        "longitude" => lng.to_s
      },
      "phone" => phone,
      "rating" => rating.to_s,
      "num_reviews" => review_count.to_s,
      "price_level" => "$" * price_level,
      "cuisine" => [
        { "name" => cuisine_data[:yelp].capitalize, "localized_name" => cuisine_data[:yelp].capitalize }
      ]
    }
  end

  def generate_tripadvisor_reviews(location_id, cuisine_key, city, count)
    reviews = (1..count).map do |i|
      rating = weighted_random_rating.round
      {
        "id" => rand(10**9..10**10),
        "lang" => "en",
        "rating" => rating,
        "title" => generate_review_title(rating),
        "text" => generate_review_text(rating, cuisine_key, city),
        "published_date" => generate_review_date,
        "user" => {
          "username" => generate_reviewer_name.gsub(/\s+/, '').downcase + rand(100..999).to_s
        }
      }
    end

    {
      "data" => reviews
    }
  end

  def generate_tripadvisor_photos(location_id, count)
    photos = (1..count).map do |i|
      {
        "id" => rand(10**8..10**9),
        "caption" => ["Interior", "Exterior", "Food", "Ambiance", "Dish"].sample,
        "published_date" => generate_review_date,
        "images" => {
          "small" => {
            "url" => "https://example.com/photos/#{location_id}-#{i}-small.jpg",
            "width" => 150,
            "height" => 150
          },
          "medium" => {
            "url" => "https://example.com/photos/#{location_id}-#{i}-medium.jpg",
            "width" => 550,
            "height" => 412
          },
          "large" => {
            "url" => "https://example.com/photos/#{location_id}-#{i}-large.jpg",
            "width" => 1024,
            "height" => 768
          }
        }
      }
    end

    {
      "data" => photos
    }
  end

  # Helper methods
  def generate_reviewer_name
    first_names = ["John", "Jane", "Michael", "Sarah", "David", "Emily", "James", "Emma", "Robert", "Olivia", "Chris", "Sophia", "Alex", "Ava", "Daniel", "Isabella"]
    last_initial = ("A".."Z").to_a.sample
    "#{first_names.sample} #{last_initial}."
  end

  def generate_review_text(rating, cuisine_key, city)
    template = REVIEW_TEMPLATES[rating].sample
    specific = REVIEW_SPECIFICS[cuisine_key.to_sym].sample
    cuisine = cuisine_key.to_s.capitalize

    template.gsub("{specific}", specific).gsub("{cuisine}", cuisine).gsub("{city}", city)
  end

  def generate_review_title(rating)
    titles = {
      5 => ["Excellent!", "Outstanding!", "Amazing experience", "Perfect!", "Highly recommend"],
      4 => ["Very good", "Great place", "Recommended", "Good experience", "Solid choice"],
      3 => ["Okay", "Average", "Decent", "Not bad", "Fine"],
      2 => ["Disappointing", "Below average", "Expected more", "Not impressed", "Underwhelming"],
      1 => ["Terrible", "Avoid", "Worst ever", "Awful", "Stay away"]
    }
    titles[rating].sample
  end

  def generate_review_date
    days_ago = rand(1..730)  # Up to 2 years ago
    (Time.now - days_ago * 24 * 60 * 60).strftime("%Y-%m-%d %H:%M:%S")
  end

  def generate_relative_time
    days_ago = rand(1..365)
    case days_ago
    when 1 then "a day ago"
    when 2..6 then "#{days_ago} days ago"
    when 7..13 then "a week ago"
    when 14..29 then "#{days_ago / 7} weeks ago"
    when 30..59 then "a month ago"
    when 60..364 then "#{days_ago / 30} months ago"
    else "a year ago"
    end
  end

  def format_phone_display(phone)
    # Convert +17055551234 to (705) 555-1234
    digits = phone.gsub(/\D/, '')
    if digits.length == 11 && digits[0] == '1'
      "(#{digits[1..3]}) #{digits[4..6]}-#{digits[7..10]}"
    else
      phone
    end
  end

  def write_fixture(filename, data)
    path = File.join(__dir__, "fixtures", filename)
    File.write(path, JSON.pretty_generate(data))
    puts "  ✓ #{filename}"
  end
end

# Run generator
if __FILE__ == $0
  size = ARGV[0] || "medium"
  generator = TestDataGenerator.new(size)
  generator.generate!
end
