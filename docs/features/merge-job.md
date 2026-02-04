# Nightly Index Cleanup Job

This document outlines the plan for a nightly cleanup job that uses LLM-based matching to identify and propose merges for duplicate restaurants, similar categories, and location variations.

## Overview

The system uses a **two-phase cleanup approach**:
1. **Nightly Job**: Runs automatically, identifies potential merges using LLM, stores proposals in a pending queue
2. **Admin Page**: Morning review interface where you approve/reject proposed merges

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Nightly Job (cron/systemd)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Restaurant   │  │ Category     │  │ Location     │               │
│  │ Deduplicator │  │ Normalizer   │  │ Standardizer │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         └──────────────────┼──────────────────┘                     │
│                            ▼                                        │
│                  ┌─────────────────┐                                │
│                  │ LLM Analyzer    │  (Ollama / Gemini / GPT-4o-mini)│
│                  │ (propose merges)│                                │
│                  └────────┬────────┘                                │
│                           ▼                                         │
│                  ┌─────────────────┐                                │
│                  │ Pending Merges  │  (SQLite: merge_proposals)     │
│                  │ Queue           │                                │
│                  └─────────────────┘                                │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Admin Page (web/admin.html)                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Pending Merge Proposals                                      │   │
│  │ ┌────────────────────────────────────────────────────────┐   │   │
│  │ │ "Mario's Pizza" ↔ "Marios Pizzeria"                    │   │   │
│  │ │ Confidence: 92%  Reason: Same address, similar name    │   │   │
│  │ │ [Approve] [Reject] [Preview]                           │   │   │
│  │ └────────────────────────────────────────────────────────┘   │   │
│  │ ┌────────────────────────────────────────────────────────┐   │   │
│  │ │ Category: "Cafe" → "Coffee Shop" (merge 12 items)      │   │   │
│  │ │ [Approve] [Reject]                                     │   │   │
│  │ └────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Problem Statement

The current matching logic in `lib/domain/matcher.rb` uses rule-based confidence scoring:

- **Scoring Weights (total 100 points):**
  - Name similarity: 35 points (using longest common subsequence)
  - Address match: 20 points (after normalizing street abbreviations)
  - GPS proximity: 25 points (linear scale, 0m = full, 200m = 0)
  - Phone match: 20 points (exact match only after digit extraction)

- **Threshold:** Score > 50 = merge restaurants

**Known Issues:**
- Conservative scoring tends to create duplicates rather than over-merge
- Minor name variations not handled well (e.g., "Homestead Artisan Bakery" vs "Homestead Bakery")
- Address format differences cause misses (St. vs Street vs Str)
- Categories from different adapters have spelling variations
- Location strings have no normalization ("barrie, ontario" vs "Barrie, ON")

## Phase 1: Database Schema Additions

New table for storing merge proposals:

```sql
CREATE TABLE merge_proposals (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,           -- 'restaurant', 'category', 'location'
  source_id INTEGER NOT NULL,   -- ID of item to merge FROM
  target_id INTEGER NOT NULL,   -- ID of item to merge INTO
  confidence REAL NOT NULL,     -- 0.0 to 1.0
  reason TEXT,                  -- LLM explanation
  llm_response TEXT,            -- Full LLM response (for debugging)
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  reviewed_by TEXT              -- For future multi-user support
);

-- For location normalization
CREATE TABLE location_aliases (
  id INTEGER PRIMARY KEY,
  raw_location TEXT NOT NULL,    -- Original user input
  canonical_location TEXT NOT NULL, -- Normalized form
  latitude REAL,
  longitude REAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Phase 2: LLM Integration Options

### Option A: Ollama (Free, Local) - Recommended for Privacy

```ruby
# lib/infrastructure/llm/ollama_client.rb
class OllamaClient
  def initialize(model: 'llama3.2:3b', host: 'http://localhost:11434')
    @model = model
    @host = host
  end

  def analyze_merge(item1, item2, type:)
    prompt = build_merge_prompt(item1, item2, type)
    response = Faraday.post("#{@host}/api/generate", {
      model: @model,
      prompt: prompt,
      stream: false
    }.to_json)
    parse_response(response)
  end
end
```

### Option B: Google Gemini Flash (Free Tier: 1M tokens/day)

```ruby
# lib/infrastructure/llm/gemini_client.rb
class GeminiClient
  API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

  def initialize(api_key: ENV['GEMINI_API_KEY'])
    @api_key = api_key
  end
end
```

### Option C: OpenAI GPT-4o-mini (~$0.15/1M tokens)

```ruby
# lib/infrastructure/llm/openai_client.rb
class OpenAIClient
  def initialize(api_key: ENV['OPENAI_API_KEY'], model: 'gpt-4o-mini')
    @client = Faraday.new('https://api.openai.com/v1')
    @model = model
  end
end
```

**Recommendation**: Start with **Gemini Flash** (free, high quality) with **Ollama** as offline fallback.

## Phase 3: Cleanup Services

### 3.1 Restaurant Deduplicator

```ruby
# lib/services/cleanup/restaurant_deduplicator_service.rb
class RestaurantDeduplicatorService
  def initialize(llm_client:, restaurant_repo:, proposal_repo:)
    @llm = llm_client
    @restaurant_repo = restaurant_repo
    @proposal_repo = proposal_repo
  end

  def find_duplicates
    # Step 1: Find candidate pairs using relaxed matching
    candidates = find_candidate_pairs

    # Step 2: Score each pair with LLM
    candidates.each do |pair|
      result = @llm.analyze_merge(pair[:a], pair[:b], type: :restaurant)

      if result[:should_merge] && result[:confidence] > 0.7
        @proposal_repo.create(
          type: 'restaurant',
          source_id: pair[:a].id,
          target_id: pair[:b].id,
          confidence: result[:confidence],
          reason: result[:reason],
          llm_response: result[:raw]
        )
      end
    end
  end

  private

  def find_candidate_pairs
    # Use SQL to find potential duplicates:
    # - Same location
    # - Similar names (Levenshtein distance)
    # - GPS within 500m
    # - Similar phone (partial match)
  end
end
```

**LLM Prompt for Restaurant Matching:**

```
You are a restaurant deduplication assistant. Analyze if these two restaurant entries refer to the same physical restaurant.

Restaurant A:
- Name: {{name_a}}
- Address: {{address_a}}
- Phone: {{phone_a}}
- Categories: {{categories_a}}
- Sources: {{sources_a}}

Restaurant B:
- Name: {{name_b}}
- Address: {{address_b}}
- Phone: {{phone_b}}
- Categories: {{categories_b}}
- Sources: {{sources_b}}

Respond in JSON format:
{
  "should_merge": true/false,
  "confidence": 0.0-1.0,
  "reason": "Brief explanation",
  "preferred_name": "Which name to keep",
  "preferred_address": "Which address to keep"
}
```

### 3.2 Category Normalizer

```ruby
# lib/services/cleanup/category_normalizer_service.rb
class CategoryNormalizerService
  KNOWN_ALIASES = {
    'cafe' => 'coffee shop',
    'pizzeria' => 'pizza',
    'pub' => 'bar',
    # ... more static mappings
  }

  def find_similar_categories
    categories = @category_repo.all

    # Group by similarity
    groups = categories.group_by { |c| normalize(c.name) }

    # For groups with multiple entries, propose merges
    groups.each do |canonical, items|
      next if items.size < 2

      # Use LLM to pick best canonical name
      result = @llm.analyze_categories(items.map(&:name))

      primary = items.find { |i| i.name == result[:canonical] }
      items.reject { |i| i == primary }.each do |item|
        @proposal_repo.create(
          type: 'category',
          source_id: item.id,
          target_id: primary.id,
          confidence: result[:confidence],
          reason: "Normalize '#{item.name}' to '#{primary.name}'"
        )
      end
    end
  end
end
```

### 3.3 Location Standardizer

```ruby
# lib/services/cleanup/location_standardizer_service.rb
class LocationStandardizerService
  def normalize_locations
    # Get all unique location strings
    locations = @restaurant_repo.all_indexed_locations

    # Group by similarity
    groups = cluster_similar_locations(locations)

    groups.each do |group|
      next if group.size < 2

      # Use LLM or geocoding API to find canonical form
      result = @llm.normalize_location(group)

      # Create alias mappings
      group.each do |raw_loc|
        @location_alias_repo.create(
          raw_location: raw_loc,
          canonical_location: result[:canonical],
          latitude: result[:lat],
          longitude: result[:lng]
        )
      end
    end
  end
end
```

## Phase 4: Nightly Job Runner

```ruby
# lib/jobs/nightly_cleanup_job.rb
class NightlyCleanupJob
  def initialize
    @llm = build_llm_client
    @logger = GrubStars::Logger.new
  end

  def run
    @logger.info("Starting nightly cleanup job")

    stats = {
      restaurant_proposals: 0,
      category_proposals: 0,
      location_normalizations: 0
    }

    # 1. Find duplicate restaurants
    deduplicator = RestaurantDeduplicatorService.new(llm_client: @llm, ...)
    stats[:restaurant_proposals] = deduplicator.find_duplicates

    # 2. Normalize categories
    normalizer = CategoryNormalizerService.new(llm_client: @llm, ...)
    stats[:category_proposals] = normalizer.find_similar_categories

    # 3. Standardize locations
    standardizer = LocationStandardizerService.new(llm_client: @llm, ...)
    stats[:location_normalizations] = standardizer.normalize_locations

    # 4. Clean up orphaned data
    cleanup_orphaned_data

    # 5. Send summary (optional email/notification)
    send_summary(stats)

    @logger.info("Nightly cleanup complete: #{stats}")
  end

  private

  def build_llm_client
    if ENV['GEMINI_API_KEY']
      GeminiClient.new
    elsif system('curl -s http://localhost:11434/api/tags > /dev/null 2>&1')
      OllamaClient.new
    else
      raise "No LLM configured. Set GEMINI_API_KEY or run Ollama locally."
    end
  end
end
```

**CLI Command:**

```ruby
# lib/cli.rb
desc "cleanup", "Run nightly cleanup job (find duplicate restaurants, normalize categories)"
def cleanup
  job = NightlyCleanupJob.new
  job.run
end
```

**Cron/Systemd Setup:**

```bash
# /etc/cron.d/grub-stars-cleanup
0 3 * * * cd /path/to/grub-stars && ruby -I lib bin/grst cleanup >> /var/log/grub-stars-cleanup.log 2>&1
```

## Phase 5: Admin Page

### 5.1 API Endpoints

```ruby
# lib/api/server.rb

# List pending proposals
get '/admin/proposals' do
  proposals = proposal_repo.pending
  json_response(proposals.map(&:to_h))
end

# Get proposal details with full restaurant/category data
get '/admin/proposals/:id' do
  proposal = proposal_repo.find(params[:id])
  details = build_proposal_details(proposal)
  json_response(details)
end

# Approve a proposal
post '/admin/proposals/:id/approve' do
  proposal = proposal_repo.find(params[:id])

  case proposal.type
  when 'restaurant'
    merge_restaurants(proposal.source_id, proposal.target_id)
  when 'category'
    merge_categories(proposal.source_id, proposal.target_id)
  end

  proposal_repo.mark_approved(proposal.id)
  json_response({ success: true })
end

# Reject a proposal
post '/admin/proposals/:id/reject' do
  proposal_repo.mark_rejected(params[:id])
  json_response({ success: true })
end

# Bulk approve/reject
post '/admin/proposals/bulk' do
  body = JSON.parse(request.body.read)
  body['approve'].each { |id| approve_proposal(id) }
  body['reject'].each { |id| reject_proposal(id) }
  json_response({ success: true })
end

# Get cleanup stats
get '/admin/stats' do
  json_response({
    pending_proposals: proposal_repo.count_pending,
    approved_today: proposal_repo.count_approved_since(Date.today),
    total_restaurants: restaurant_repo.count,
    total_categories: category_repo.count,
    duplicate_estimate: estimate_duplicates
  })
end
```

### 5.2 Admin Page UI

**Files to create:**

```
web/
├── admin.html              # Main admin dashboard
├── js/
│   ├── admin.js            # Admin page controller
│   └── components/
│       ├── proposal-card.js    # Proposal review card
│       └── merge-preview.js    # Side-by-side comparison
```

**Admin Dashboard Wireframe:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  grub stars admin                                    [← Back to App]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Dashboard                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │
│  │ 12 Pending   │ │ 847 Total    │ │ 23 Categories│                │
│  │ Proposals    │ │ Restaurants  │ │              │                │
│  └──────────────┘ └──────────────┘ └──────────────┘                │
│                                                                     │
│  Pending Merge Proposals                           [Approve All Safe]│
│  ───────────────────────────────────────────────────────────────── │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Restaurant Merge (95% confidence)                           │   │
│  │ ┌─────────────────────┐    ┌─────────────────────┐          │   │
│  │ │ Mario's Pizza       │ → │ Marios Pizzeria      │          │   │
│  │ │ 123 Main St        │    │ 123 Main Street      │          │   │
│  │ │ Yelp: 4.2★         │    │ Google: 4.3★         │          │   │
│  │ └─────────────────────┘    └─────────────────────┘          │   │
│  │ LLM Reason: "Same address, apostrophe variation in name"    │   │
│  │                                                              │   │
│  │ [Approve Merge] [Reject] [Full Details]                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Category Merge (88% confidence)                             │   │
│  │ Merge "Cafe" (8 restaurants) → "Coffee Shop" (15 restaurants)│   │
│  │ LLM Reason: "Common synonym, 'Coffee Shop' is more specific" │   │
│  │                                                              │   │
│  │ [Approve] [Reject]                                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Phase 6: Implementation Plan

| Step | Task | Files to Create/Modify | Priority |
|------|------|------------------------|----------|
| 1 | Add `merge_proposals` table | `lib/infrastructure/database.rb` | High |
| 2 | Create `MergeProposalRepository` | `lib/infrastructure/repositories/merge_proposal_repository.rb` | High |
| 3 | Create LLM client abstraction | `lib/infrastructure/llm/base.rb`, `gemini_client.rb`, `ollama_client.rb` | High |
| 4 | Build `RestaurantDeduplicatorService` | `lib/services/cleanup/restaurant_deduplicator_service.rb` | High |
| 5 | Build `CategoryNormalizerService` | `lib/services/cleanup/category_normalizer_service.rb` | Medium |
| 6 | Build `LocationStandardizerService` | `lib/services/cleanup/location_standardizer_service.rb` | Medium |
| 7 | Create `NightlyCleanupJob` | `lib/jobs/nightly_cleanup_job.rb` | High |
| 8 | Add `cleanup` CLI command | `lib/cli.rb` | High |
| 9 | Add admin API endpoints | `lib/api/server.rb` | High |
| 10 | Create admin UI page | `web/admin.html`, `web/js/admin.js` | High |
| 11 | Add merge execution logic | `lib/services/merge_service.rb` | High |
| 12 | Write tests | `tests/unit/services/cleanup/`, `tests/integration/admin_api_test.rb` | Medium |
| 13 | Add cron/systemd config | `scripts/setup-cron.sh` | Low |

## Cost Estimate (Monthly)

| LLM Option | Cost | Notes |
|------------|------|-------|
| **Ollama (local)** | $0 | Requires machine with 8GB+ RAM |
| **Gemini Flash** | $0 | 1M free tokens/day, ~500 merge analyses/day |
| **GPT-4o-mini** | ~$5-10 | ~$0.15/1M tokens, depends on DB size |
| **Claude Haiku** | ~$5-15 | $0.25/1M input, higher quality |

**Recommendation**: Use Gemini Flash (free) as primary, with fallback prompt batching to reduce API calls.

## Future Enhancements

1. **Email Notifications**: Send morning summary of pending proposals
2. **Auto-approve Threshold**: Automatically approve merges with >98% confidence
3. **Undo Merges**: Track merge history and allow rollback
4. **Category Hierarchy**: Build parent/child category relationships
5. **Geocoding Integration**: Use Photon/Nominatim for location normalization
6. **Merge History**: Audit log of all approved/rejected merges

## Environment Variables

Add to `.env.example`:

```bash
# LLM Configuration (choose one)
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

# Cleanup Job Settings
CLEANUP_AUTO_APPROVE_THRESHOLD=0.98
CLEANUP_MIN_CONFIDENCE=0.7
```
