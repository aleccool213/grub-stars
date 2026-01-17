# CLI Architecture

## Entry Point

`bin/grst` is the executable entry point. It loads the library and delegates to Thor:

```ruby
require_relative "../lib/grub_stars"
GrubStars::CLI.start(ARGV)
```

Run with `./bin/grst <command>` or after install, just `grst <command>`.

## Architecture

The CLI is the **Presentation Layer** in grub-stars' layered architecture. It follows these principles:

- **User I/O only** - Handles input/output and formatting
- **No business logic** - Delegates all operations to services
- **No database access** - Never touches the database directly

The CLI calls services, which orchestrate the business logic and data access.

## Thor Configuration

The CLI is defined in `lib/cli.rb` as a Thor subclass:

```ruby
class GrubStars::CLI < Thor
```

### Defining Commands

Each public method with a `desc` declaration becomes a command:

```ruby
desc "search", "Find restaurants by name or category"
option :name, type: :string, desc: "Search by restaurant name"
option :category, type: :string, desc: "Search by category"
def search
  # options[:name], options[:category] available here
end
```

### Command Options

- `option` - optional flag
- `option :foo, required: true` - required flag
- `option :foo, type: :string` - type coercion (`:string`, `:boolean`, `:numeric`, `:array`, `:hash`)

### Exit Behavior

```ruby
def self.exit_on_failure?
  true
end
```

This ensures non-zero exit codes on errors (Thor defaults to false).

## Command Examples

### Index Command

The index command delegates to `IndexRestaurantsService`:

```ruby
desc "index", "Index restaurants in a geographic area"
option :location, required: true, type: :string
def index
  # Create service instance
  service = Services::IndexRestaurantsService.new

  # Call service method
  stats = service.index(location: options[:location])

  # Format output for user
  puts "Indexed #{stats[:total]} restaurants"
  puts "  New: #{stats[:new]}"
  puts "  Merged: #{stats[:merged]}"
end
```

### Search Command

The search command delegates to `SearchRestaurantsService`:

```ruby
desc "search", "Find restaurants"
option :name, type: :string
option :category, type: :string
def search
  # Create service instance
  service = Services::SearchRestaurantsService.new

  # Call service method based on options
  results = if options[:name]
    service.search_by_name(options[:name])
  elsif options[:category]
    service.search_by_category(options[:category])
  else
    puts "Provide --name or --category"
    return
  end

  # Format output for user
  results.each do |restaurant|
    puts "#{restaurant.name} - #{restaurant.address}"
  end
end
```

### Info Command

The info command delegates to `RestaurantDetailsService`:

```ruby
desc "info", "Show restaurant details"
option :id, type: :numeric
option :name, type: :string
def info
  # Create service instance
  service = Services::RestaurantDetailsService.new

  # Get restaurant
  restaurant = if options[:id]
    service.get_by_id(options[:id])
  elsif options[:name]
    service.get_by_name(options[:name])
  end

  # Format output
  puts "# #{restaurant.name}"
  puts "\nRatings:"
  restaurant.ratings.each do |rating|
    puts "  #{rating.source}: #{rating.score}"
  end
  # ... more formatting
end
```

## Adding New Commands

1. Add a method to `GrubStars::CLI` in `lib/cli.rb`
2. Add `desc "name", "description"` above it
3. Add `option` declarations for flags
4. **Create or use a service** to handle the business logic
5. Call the service method with user input
6. Format the service response for display
7. Access options via `options[:flag_name]`

### Example: Adding a "favorites" command

```ruby
desc "favorites", "List your favorite restaurants"
def favorites
  # 1. Create service instance
  service = Services::FavoritesService.new

  # 2. Call service method
  favorites = service.list_favorites

  # 3. Format output
  if favorites.empty?
    puts "No favorites yet. Add one with 'grst add-favorite --id <id>'"
  else
    favorites.each do |restaurant|
      puts "⭐ #{restaurant.name}"
    end
  end
end
```

**Important:** Don't put business logic in the CLI. Always create or use a service class.

## Separation of Concerns

❌ **Bad - Business logic in CLI:**
```ruby
def search
  db = GrubStars.db
  restaurants = db[:restaurants].where(Sequel.ilike(:name, "%#{options[:name]}%")).all
  restaurants.each { |r| puts r[:name] }
end
```

✅ **Good - Delegate to service:**
```ruby
def search
  service = Services::SearchRestaurantsService.new
  restaurants = service.search_by_name(options[:name])
  restaurants.each { |r| puts r.name }
end
```

## Benefits of Service-Based Architecture

1. **Reusability** - Services can be used by CLI, API, web app, background jobs
2. **Testability** - Test business logic separately from CLI interface
3. **Maintainability** - Clear separation between presentation and business logic
4. **Flexibility** - Easy to add new interfaces (REST API, GraphQL, web UI) without duplicating logic
