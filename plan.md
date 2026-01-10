# grub stars

A command line app which retrieves restaurant information like reviews and photos from multiple remote sources. Saves folks time so they dont need to search across multiple apps like 

## usage

```
❯ grst --help
Find and store aggregated restaurant information.

USAGE
  grst <command> <subcommand> [flags]

CORE COMMANDS
  search: find restaurants by name or category
  index: search and retrieve data for a specific 5km x 5km area
  info: show a single restaurants information from the indexer
  configure: add api keys for each adapter
```

## adapters

- google maps
  - [ ] star rating
  - [ ] reviews
  - [ ] photos
- yelp
  - [ ] star rating
  - [ ] reviews
  - [ ] photos
  - [ ] videos?
- trip advisor
  - [ ] rating
  - [ ] reviews
  - [ ] photos 
  - [ ] videos?
- instagram
  - [ ] photos
  - [ ] videos
- tiktok
  - [ ] vidoes

## design 

There is a lot of restaurant data and its consistently changing! Consider "restaurant" being a vague term emcompassing everything from bakeries to hotel lobby bars, a dense cities may have hundreds in a small 5 km area. Review and photo data may have material impacts to user choice (choice being going to one bakery over the other due to favourable recent reviews) but does not change extremely frequently. Impact could take months so having a local index of restaurant data for an area someone lives in is quite useful. Someone who goes out a lot may want to update their index more frequently (once a week). That being said the core flow of this application is:

1. The user has a Yelp and Trip Advisor API key, they configure the app is to use these two data sources with `grst configure --yelp [api-key] --trip-advisor [api-key]`. 
1. Before the user starts to use the app, they index their area with `grst index --city barrie, ontario`. The indexer lists the cities full location so that the user knows the correct one is being indexed. This command searches for all restaurants in a location, tries to pull as much data as possible for each using each configured adapter (photos and videos are just links, we dont want to store a lot of data) and stores it in the local sqlite database. Now when searches are made, it is only made the local database and retrieval is quick.
1. User wants to see all of the bakeries in their neighborhood.
1. `grst search --category bakery` lists a bunch of bakeries
1. `grst info --name "squares and circles"` pulls the restaurant information for that name, could use an internal id as well

```
# square and circles

id: 23juh324b34v
address: 123 made up street, barrie, ontario, canada

## star rating 

yelp: 4.5
trip advisor: 4.5

## review snippets

yelp:

- Blah blah blah (url)
- bleh bleh bleh (url)

trip advisor:

- Blah blah blah (url)
- bleh bleh bleh (url)

photos:

yelp:

- url
- url

trip advisor:

- url
- url

videos:

yelp:

- url
- url

trip advisor:

- url
- url
```

### indexer + aggregation

When pulling restaurant data across data sources, the hard part is merging restaurants which are the same into a single entry into our database. For example if "squares + circles" bakery is present in both yelp and trip advisor, the name might be slightly different or the exact gps coordinates might be slightly different. We need to:

1. Search for restaurant data in the first data source in the priority list, mostly likely google maps but lets use yelp for our example
2. Then when searching the same area in other adapters like trip advisor, we attempt to match these restaurants with existing ones in the database. We can use a basic confidence score system so similar names and address can get high scores like 30 and then any restaurants getting over a 50 score can be considered the same and merged. Other attributes like phone numbers being the same helps but will have a lower score attributed.
3. We also need to assign category tags to restaurants for easy search, hopefully adapters will provide these. 

### pulling data and exposing features

Adapters are first configured by the user so its a bring your own API key situation. Each adapter will have a feature set that support, for example yelp will support review snippets but instagram will not, instagram is simply used for photos and videos.

## impl plan

1. We need to research to see if we can get the data we want from 3rd party adapters and successfully make some API calls using our own keys. We need to take notes on which features each adapter can support.
2. We need to find a good ruby cli gem and create a basic CLI tool layer of our application which contains no business logic, just the logic the user needs to interact with the app.
3. Then we need to design a basic database schema and initialize the sqlite db on cli boot.
4. Then we should build our adapters. Existing ruby gems or sdks for these APIs would be great!
5. Build the indexer. Should work for a single adapter and error if more than 1 is configured.
6. Build the matcher which runs each time a subsequent adapter is used.
7. Build the search cli cmd which will look inside the sqlite db by catagory or name.
8. Build the info cli cmd which takes a single restaurant from the db and presents all of the info the user in a nice format.

## progress notes

### Completed
- [x] Step 2: CLI layer with Thor (search, index, info, config commands)
- [x] Step 3: Database schema + SQLite init on boot + configurable db path
- [x] Step 4: Yelp adapter (search, get_business, get_reviews, pagination)
- [x] Step 5: Indexer (single adapter, stores restaurants/categories/ratings/photos)
- [x] Step 6: Matcher (confidence scoring: name, address, GPS, phone)
- [x] Step 7: Search CLI command (fuzzy matching via Levenshtein, interactive selection)
- [x] Step 8: Info CLI command (full restaurant details: ratings, reviews, photos, videos, categories)

### TODO
- [ ] **Test matcher with real multi-adapter scenario** - Now that Google adapter is complete, test the matcher merging restaurants from Yelp and Google in a real-world scenario
- [x] Build Google Maps adapter (search_businesses, get_business, get_reviews, pagination)
- [ ] Build TripAdvisor adapter

