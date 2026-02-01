# WIP: Admin Stats Page - Server Route Not Loading

## Status
**Branch:** `new-feature-branch`  
**Last Commit:** `d937826` - Add admin/stats page with API usage and restaurant coverage stats

## What Was Implemented

### Backend
1. **StatsService** (`lib/services/stats_service.rb`)
   - Service layer for gathering system statistics
   - Returns restaurant counts, API usage, provider coverage, and locations
   - Follows existing service pattern with dependency injection

2. **API Endpoint** (`lib/api/server.rb:197-200`)
   - Added `GET /stats` endpoint
   - Uses StatsService to fetch data
   - Returns JSON response

3. **Integration Tests** (`tests/integration/stats_test.rb`)
   - 7 comprehensive tests covering all stats scenarios
   - All tests pass: `7 runs, 64 assertions, 0 failures`

### Frontend
1. **Admin Page** (`web/admin.html`)
   - Stats dashboard with multiple sections
   - Restaurant overview cards
   - Provider coverage badges
   - API usage with progress bars
   - Indexed locations list

2. **JavaScript** (`web/js/admin.js`)
   - Fetches stats from API
   - Displays data with formatting
   - Auto-refresh every 5 minutes
   - Error handling with retry button

3. **API Client** (`web/js/api.js`)
   - Added `getStats()` function
   - Exported for use in admin.js

## Current Issue

### Problem
The server returns **404 Not Found** for the `/stats` endpoint:
```
<h2>Sinatra doesn't know this ditty.</h2>
```

### What We've Tried
1. ✅ Verified the route exists in `lib/api/server.rb` at line 197
2. ✅ Checked Ruby syntax - both files are valid
3. ✅ Restarted server multiple times using different methods
4. ✅ Checked that other routes work (e.g., `/health`, `/categories`)
5. ✅ Integration tests pass (they use the route directly)

### Possible Causes
1. **Server Caching**: The running server process may be caching old code
2. **Wrong Process**: There may be multiple server processes running, and we're not hitting the right one
3. **Load Path**: The server might be loading a different version of the file from a cached location
4. **Bundler Issue**: The bundler version might be causing code reload issues

### Investigation Notes
- Found a background process running `start-server.rb` (PID 26244)
- This process was started at 00:40 and may be the one serving requests
- The file `start-server.rb` doesn't exist in the repo - it may be a generated/temp file
- Killing and restarting with `rackup` doesn't seem to affect this background process

## Next Steps

### Immediate Actions
1. **Kill all Ruby processes** and start fresh:
   ```bash
   pkill -9 -f ruby
   pkill -9 -f rackup
   # Then start server manually
   ```

2. **Verify file timestamps** to ensure we're editing the right files:
   ```bash
   ls -la lib/api/server.rb
   stat lib/api/server.rb
   ```

3. **Check if there's a compiled/cached version**:
   ```bash
   find /tmp -name "*.rb" -mmin -60 2>/dev/null
   find ~/.cache -name "*grub*" 2>/dev/null
   ```

4. **Test with explicit file loading**:
   ```bash
   ruby -I lib -e "require_relative 'lib/api/server'; puts GrubStars::API::Server.routes"
   ```

### Code Verification
The route is definitely in the file:
```ruby
# lib/api/server.rb:197
get "/stats" do
  service = Services::StatsService.new
  stats = service.get_stats
  json_response(stats)
end
```

And the service is properly required in `lib/grub_stars.rb`.

## Files Modified
- `lib/api/server.rb` - Added /stats endpoint
- `lib/grub_stars.rb` - Added stats_service require
- `lib/services/stats_service.rb` - New service (NEW)
- `tests/integration/stats_test.rb` - Integration tests (NEW)
- `web/admin.html` - Stats dashboard page (NEW)
- `web/js/admin.js` - Stats page JavaScript (NEW)
- `web/js/api.js` - Added getStats() function
- `web/index.html` - Added footer link to stats

## Tests Status
- ✅ All Ruby integration tests pass
- ✅ All JavaScript tests pass (215/215)
- ❌ Server doesn't recognize /stats endpoint at runtime

## Commands to Test
```bash
# Test the endpoint
curl http://localhost:9292/stats

# Should return JSON like:
{
  "data": {
    "restaurants": { "total": 0, ... },
    "provider_coverage": {},
    "api_usage": [...],
    "locations": []
  },
  "meta": { "timestamp": "..." }
}
```
