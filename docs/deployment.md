# Deployment

## Docker

```bash
docker build -t grub-stars-api .
docker run -p 9292:9292 \
  -e YELP_API_KEY=xxx \
  -e GOOGLE_API_KEY=xxx \
  -v grub_stars_data:/data \
  grub-stars-api
```

## Fly.io Cloud Deployment

The project includes Fly.io configuration for two environments:

| Environment | Config File | Description |
|-------------|-------------|-------------|
| **Test** | `fly.test.toml` | Uses mock API server (no real keys needed) |
| **Prod** | `fly.prod.toml` | Uses real API keys (set as secrets) |

### Prerequisites

```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

### Deploy Test Environment

```bash
./scripts/deploy-test.sh
# Or manually:
fly deploy --config fly.test.toml
```

### Deploy Production Environment

```bash
# First, set your API secrets
fly secrets set YELP_API_KEY=your_key --config fly.prod.toml
fly secrets set GOOGLE_API_KEY=your_key --config fly.prod.toml
fly secrets set TRIPADVISOR_API_KEY=your_key --config fly.prod.toml

# Then deploy
./scripts/deploy-prod.sh
# Or manually:
fly deploy --config fly.prod.toml
```

### Useful Commands

```bash
fly logs --config fly.test.toml         # View logs
fly ssh console --config fly.test.toml  # SSH into container
fly status --config fly.test.toml       # Check status
fly apps open --config fly.test.toml    # Open in browser
```

**Cost:** Free tier includes 3 shared VMs (256MB RAM each) - enough for both test and prod.

## Production Debugging on Fly.io

### Viewing Production Logs

```bash
fly logs --config fly.prod.toml              # Stream logs in real-time
fly logs --config fly.prod.toml -n           # Recent logs without tailing
fly logs --config fly.prod.toml -n | grep "2026-02-02T00:"  # Filter by time
```

### Accessing the Production Database

The production database is stored in a persistent volume mounted at `/data`:

```bash
fly status --config fly.prod.toml
fly machine start <MACHINE_ID> --config fly.prod.toml

# Query the database
fly ssh console --config fly.prod.toml --command "sqlite3 /data/grub_stars.db 'SELECT * FROM restaurants WHERE name LIKE \"%search_term%\";'"

# Export database
fly ssh console --config fly.prod.toml --command "sqlite3 /data/grub_stars.db '.dump'" > /tmp/prod_dump.sql
fly ssh console --config fly.prod.toml --command "cat /data/grub_stars.db" > /tmp/grub_stars_prod.db
```

### Analyzing Production Data Locally

```bash
grep -v "^Connecting\|^Warning\|^Error" /tmp/prod_dump.sql > /tmp/clean.sql
sqlite3 /tmp/prod.db < /tmp/clean.sql
sqlite3 /tmp/prod.db "SELECT r.*, e.source, e.external_id
  FROM restaurants r
  JOIN external_ids e ON r.id = e.restaurant_id
  WHERE r.name LIKE '%search_term%';"
```

### Debugging Restaurant Merging Issues

1. **Check logs for matcher activity:**
   ```bash
   fly logs --config fly.prod.toml -n | grep -i "restaurant_name\|matcher"
   ```

2. **Key log patterns:**
   - `Matcher: Looking for match for 'Restaurant Name'` - When matching starts
   - `Matcher: X candidate(s) to compare` - How many nearby restaurants were found
   - `Matcher: Scores - name: X/35, address: X/20, gps: X/25, phone: X/20` - Scoring breakdown
   - `Matcher: Total: X/100 (threshold: 50)` - Final score vs threshold
   - `Matcher: MATCH FOUND` or `Matcher: No candidates available` - Result

3. **Common issues:**
   - `"0 candidate(s) to compare"` - GPS coordinates missing
   - Low GPS scores - Restaurants farther than 200m apart
   - Missing phone numbers - Can't use phone matching (20 points)

4. **Query for duplicates:**
   ```sql
   SELECT r1.id, r1.name, r1.address, r1.latitude, r1.longitude, r1.phone,
          r2.id, r2.name, r2.address, r2.latitude, r2.longitude, r2.phone
   FROM restaurants r1
   JOIN restaurants r2 ON r1.id < r2.id
   WHERE r1.name LIKE '%search_term%' OR r2.name LIKE '%search_term%';
   ```

**Known issue:** TripAdvisor search results don't include GPS coordinates, causing the matcher to find 0 candidates and create duplicate restaurants instead of merging.
