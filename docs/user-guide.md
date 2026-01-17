# User Guide

## Installation

```bash
git clone https://github.com/your-username/grub-stars.git
cd grub-stars
bundle install
```

## Configuration

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your API keys:
   ```
   YELP_API_KEY=your_yelp_key_here
   GOOGLE_API_KEY=your_google_key_here
   ```

   At minimum, configure one adapter to start indexing restaurants.

## Usage

### Index an area

Before searching, index restaurants in your area:

```bash
./bin/grst index --location "barrie, ontario"
```

This fetches restaurant data from all configured adapters and stores it locally.

### Search restaurants

Search by category:
```bash
./bin/grst search --category bakery
./bin/grst search --category "italian restaurant"
```

Search by name:
```bash
./bin/grst search --name "corner cafe"
```

### View restaurant details

Get full details for a specific restaurant:

```bash
./bin/grst info --name "squares and circles"
./bin/grst info --id abc123
```

## Getting API Keys

- **Yelp**: https://www.yelp.com/developers/v3/manage_app
- **Google Places**: https://console.cloud.google.com/apis/credentials
- **TripAdvisor**: https://www.tripadvisor.com/developers
