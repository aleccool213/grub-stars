#!/usr/bin/env ruby
# frozen_string_literal: true
# encoding: UTF-8

Encoding.default_external = Encoding::UTF_8
Encoding.default_internal = Encoding::UTF_8

require 'json'
require 'securerandom'

# Hawaiian restaurant data for Oahu
OAHU_RESTAURANTS = [
  {
    name: "Rainbow Drive-In",
    address: "3308 Kanaina Avenue",
    city: "Honolulu",
    state: "HI",
    zip: "96815",
    lat: 21.2831,
    lng: -157.8142,
    phone: "+18087377766",
    categories: ["hawaiian", "breakfast_brunch"],
    price: "$$",
    rating: 4.5,
    review_count: 850
  },
  {
    name: "Marukame Udon",
    address: "2310 Kuhio Avenue",
    city: "Honolulu",
    state: "HI",
    zip: "96815",
    lat: 21.2793,
    lng: -157.8266,
    phone: "+18089310200",
    categories: ["japanese", "udon", "ramen"],
    price: "$",
    rating: 4.6,
    review_count: 1200
  },
  {
    name: "Leonard's Bakery",
    address: "933 Kapahulu Avenue",
    city: "Honolulu",
    state: "HI",
    zip: "96816",
    lat: 21.2792,
    lng: -157.8150,
    phone: "+18087377865",
    categories: ["bakeries", "desserts", "portuguese"],
    price: "$$",
    rating: 4.7,
    review_count: 920
  },
  {
    name: "Ono Seafood",
    address: "747 Kapahulu Avenue #4",
    city: "Honolulu",
    state: "HI",
    zip: "96816",
    lat: 21.2780,
    lng: -157.8165,
    phone: "+18089559050",
    categories: ["poke", "seafood", "hawaiian"],
    price: "$$",
    rating: 4.8,
    review_count: 1450
  },
  {
    name: "Helena's Hawaiian Food",
    address: "1240 North School Street",
    city: "Honolulu",
    state: "HI",
    zip: "96817",
    lat: 21.3255,
    lng: -157.8598,
    phone: "+18088455044",
    categories: ["hawaiian", "traditional"],
    price: "$$",
    rating: 4.5,
    review_count: 680
  },
  {
    name: "Koko Head Cafe",
    address: "1145C 12th Avenue",
    city: "Honolulu",
    state: "HI",
    zip: "96816",
    lat: 21.2821,
    lng: -157.8021,
    phone: "+18087327486",
    categories: ["breakfast_brunch", "cafes", "hawaiian"],
    price: "$$",
    rating: 4.6,
    review_count: 780
  },
  {
    name: "Roy's Waikiki",
    address: "226 Lewers Street",
    city: "Honolulu",
    state: "HI",
    zip: "96815",
    lat: 21.2789,
    lng: -157.8287,
    phone: "+18089234321",
    categories: ["hawaiian", "seafood", "fusion"],
    price: "$$$$",
    rating: 4.4,
    review_count: 920
  },
  {
    name: "The Pig and The Lady",
    address: "83 North King Street",
    city: "Honolulu",
    state: "HI",
    zip: "96817",
    lat: 21.3078,
    lng: -157.8604,
    phone: "+18088854325",
    categories: ["vietnamese", "asian_fusion"],
    price: "$$",
    rating: 4.7,
    review_count: 1100
  },
  {
    name: "Haleiwa Joe's Seafood Grill",
    address: "66-011 Kamehameha Highway",
    city: "Haleiwa",
    state: "HI",
    zip: "96712",
    lat: 21.5943,
    lng: -158.1048,
    phone: "+18086377777",
    categories: ["seafood", "american", "hawaiian"],
    price: "$$$",
    rating: 4.5,
    review_count: 650
  },
  {
    name: "Giovanni's Shrimp Truck",
    address: "66-472 Kamehameha Highway",
    city: "Haleiwa",
    state: "HI",
    zip: "96712",
    lat: 21.5569,
    lng: -158.0292,
    phone: "+18082937838",
    categories: ["seafood", "food_trucks", "hawaiian"],
    price: "$$",
    rating: 4.3,
    review_count: 1850
  },
  {
    name: "Musubi Cafe Iyasume",
    address: "2427 Kuhio Avenue",
    city: "Honolulu",
    state: "HI",
    zip: "96815",
    lat: 21.2782,
    lng: -157.8276,
    phone: "+18089229868",
    categories: ["japanese", "hawaiian", "breakfast_brunch"],
    price: "$",
    rating: 4.5,
    review_count: 720
  },
  {
    name: "Cinnamon's Restaurant",
    address: "315 Uluniu Street",
    city: "Kailua",
    state: "HI",
    zip: "96734",
    lat: 21.3967,
    lng: -157.7401,
    phone: "+18082619724",
    categories: ["breakfast_brunch", "american"],
    price: "$$",
    rating: 4.6,
    review_count: 890
  },
  {
    name: "Ted's Bakery",
    address: "59-024 Kamehameha Highway",
    city: "Haleiwa",
    state: "HI",
    zip: "96712",
    lat: 21.6436,
    lng: -158.0525,
    phone: "+18086387333",
    categories: ["bakeries", "desserts", "cafes"],
    price: "$$",
    rating: 4.4,
    review_count: 1320
  },
  {
    name: "Nico's Pier 38",
    address: "1129 North Nimitz Highway",
    city: "Honolulu",
    state: "HI",
    zip: "96817",
    lat: 21.3093,
    lng: -157.8677,
    phone: "+18085404466",
    categories: ["seafood", "poke", "hawaiian"],
    price: "$$",
    rating: 4.6,
    review_count: 1180
  },
  {
    name: "Hula Grill Waikiki",
    address: "2335 Kalakaua Avenue",
    city: "Honolulu",
    state: "HI",
    zip: "96815",
    lat: 21.2755,
    lng: -157.8255,
    phone: "+18089234852",
    categories: ["hawaiian", "seafood", "american"],
    price: "$$$",
    rating: 4.3,
    review_count: 980
  }
]

def generate_yelp_id(name)
  name.downcase.gsub(/[^a-z0-9]+/, '-').gsub(/^-|-$/, '') + "-honolulu"
end

def generate_photo_urls(count = 7)
  colors = %w[f0e68c ffa07a 98fb98 87ceeb dda0dd f5deb3 ffc0cb e0ffff]
  count.times.map { |i| "https://placehold.co/400x400/#{colors[i % colors.length]}/333333?text=Photo+#{i+1}" }
end

def create_yelp_business(restaurant)
  id = generate_yelp_id(restaurant[:name])
  {
    "id" => id,
    "alias" => id,
    "name" => restaurant[:name],
    "image_url" => "https://placehold.co/400x400/e0ffff/333333?text=Main",
    "is_closed" => false,
    "url" => "https://www.yelp.com/biz/#{id}",
    "review_count" => restaurant[:review_count],
    "categories" => restaurant[:categories].map { |cat| { "alias" => cat, "title" => cat.split('_').map(&:capitalize).join(' ') } },
    "rating" => restaurant[:rating],
    "coordinates" => {
      "latitude" => restaurant[:lat],
      "longitude" => restaurant[:lng]
    },
    "transactions" => [],
    "price" => restaurant[:price],
    "location" => {
      "address1" => restaurant[:address],
      "address2" => "",
      "address3" => "",
      "city" => restaurant[:city],
      "zip_code" => restaurant[:zip],
      "country" => "US",
      "state" => restaurant[:state],
      "display_address" => [
        restaurant[:address],
        "#{restaurant[:city]}, #{restaurant[:state]} #{restaurant[:zip]}"
      ]
    },
    "phone" => restaurant[:phone],
    "display_phone" => format_phone(restaurant[:phone]),
    "distance" => rand(100..5000),
    "photos" => generate_photo_urls
  }
end

def create_google_place(restaurant, index)
  place_id = "ChIJ#{SecureRandom.hex(16)}"
  {
    "place_id" => place_id,
    "name" => restaurant[:name],
    "formatted_address" => "#{restaurant[:address]}, #{restaurant[:city]}, #{restaurant[:state]} #{restaurant[:zip]}, USA",
    "geometry" => {
      "location" => {
        "lat" => restaurant[:lat],
        "lng" => restaurant[:lng]
      }
    },
    "rating" => restaurant[:rating],
    "user_ratings_total" => restaurant[:review_count],
    "types" => restaurant[:categories] + ["restaurant", "food", "point_of_interest", "establishment"],
    "price_level" => restaurant[:price].length,
    "business_status" => "OPERATIONAL",
    "photos" => [
      { "photo_reference" => "photo_ref_#{index}_1", "height" => 400, "width" => 400 },
      { "photo_reference" => "photo_ref_#{index}_2", "height" => 400, "width" => 400 }
    ]
  }
end

def create_tripadvisor_location(restaurant, index)
  location_id = (1234567 + index).to_s
  {
    "location_id" => location_id,
    "name" => restaurant[:name],
    "address_obj" => {
      "street1" => restaurant[:address],
      "city" => restaurant[:city],
      "state" => restaurant[:state],
      "country" => "United States",
      "postalcode" => restaurant[:zip],
      "address_string" => "#{restaurant[:address]}, #{restaurant[:city]}, #{restaurant[:state]} #{restaurant[:zip]}"
    },
    "latitude" => restaurant[:lat].to_s,
    "longitude" => restaurant[:lng].to_s,
    "rating" => restaurant[:rating].to_s,
    "num_reviews" => restaurant[:review_count].to_s,
    "price_level" => restaurant[:price],
    "subcategory" => restaurant[:categories].map { |cat| { "name" => cat.split('_').map(&:capitalize).join(' ') } }
  }
end

def format_phone(phone)
  # +18087377766 -> (808) 737-7766
  digits = phone.gsub(/\D/, '')
  if digits.length == 11 && digits[0] == '1'
    digits = digits[1..-1]
  end
  "(#{digits[0..2]}) #{digits[3..5]}-#{digits[6..9]}"
end

def add_reviews(business_id, restaurant)
  reviews = rand(3..5).times.map do |i|
    {
      "id" => "#{business_id}_review_#{i+1}",
      "rating" => [3, 4, 4, 5, 5].sample,
      "text" => [
        "Great food and atmosphere! Highly recommend.",
        "One of my favorite spots on the island.",
        "Delicious authentic Hawaiian cuisine.",
        "The portions were generous and everything was fresh.",
        "A must-visit when you're on Oahu!"
      ].sample,
      "time_created" => (Time.now - rand(1..365) * 24 * 60 * 60).strftime("%Y-%m-%d %H:%M:%S"),
      "user" => {
        "name" => ["John D.", "Sarah M.", "Mike K.", "Emily R.", "David L."].sample,
        "image_url" => "https://placehold.co/100x100/87ceeb/333333?text=User"
      }
    }
  end

  {
    "reviews" => reviews,
    "total" => reviews.length,
    "possible_languages" => ["en"]
  }
end

# Load existing fixtures
puts "Loading existing fixtures..."
yelp_businesses = JSON.parse(File.read('dev/fixtures/yelp_businesses.json', encoding: 'UTF-8'))
google_businesses = JSON.parse(File.read('dev/fixtures/google_businesses.json', encoding: 'UTF-8'))
tripadvisor_locations = JSON.parse(File.read('dev/fixtures/tripadvisor_locations.json', encoding: 'UTF-8'))
yelp_reviews = JSON.parse(File.read('dev/fixtures/yelp_reviews.json', encoding: 'UTF-8'))

# Generate Oahu data
puts "Generating Oahu restaurant data..."
oahu_yelp_businesses = OAHU_RESTAURANTS.map { |r| create_yelp_business(r) }
oahu_google_places = OAHU_RESTAURANTS.each_with_index.map { |r, i| create_google_place(r, i) }
oahu_tripadvisor_locations = OAHU_RESTAURANTS.each_with_index.map { |r, i| create_tripadvisor_location(r, i) }

# Generate reviews for Yelp businesses
oahu_yelp_businesses.each do |business|
  restaurant = OAHU_RESTAURANTS.find { |r| generate_yelp_id(r[:name]) == business['id'] }
  yelp_reviews[business['id']] = add_reviews(business['id'], restaurant)
end

# Add to existing fixtures
yelp_businesses['businesses'].concat(oahu_yelp_businesses)
yelp_businesses['total'] = yelp_businesses['businesses'].length

google_businesses['results'].concat(oahu_google_places)

tripadvisor_locations['data'].concat(oahu_tripadvisor_locations)

# Write updated fixtures
puts "Writing updated fixtures..."
File.write('dev/fixtures/yelp_businesses.json', JSON.pretty_generate(yelp_businesses))
File.write('dev/fixtures/google_businesses.json', JSON.pretty_generate(google_businesses))
File.write('dev/fixtures/tripadvisor_locations.json', JSON.pretty_generate(tripadvisor_locations))
File.write('dev/fixtures/yelp_reviews.json', JSON.pretty_generate(yelp_reviews))

puts "Done! Added #{OAHU_RESTAURANTS.length} Oahu restaurants to fixtures."
puts "  - Yelp: #{oahu_yelp_businesses.length} businesses"
puts "  - Google: #{oahu_google_places.length} places"
puts "  - TripAdvisor: #{oahu_tripadvisor_locations.length} locations"
