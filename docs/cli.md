# CLI Architecture

## Entry Point

`bin/grst` is the executable entry point. It loads the library and delegates to Thor:

```ruby
require_relative "../lib/grub_stars"
GrubStars::CLI.start(ARGV)
```

Run with `./bin/grst <command>` or after install, just `grst <command>`.

## Thor Configuration

The CLI is defined in `lib/grub_stars/cli.rb` as a Thor subclass:

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

## Adding New Commands

1. Add a method to `GrubStars::CLI`
2. Add `desc "name", "description"` above it
3. Add `option` declarations for flags
4. Access options via `options[:flag_name]`
