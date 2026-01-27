# Long-Running Indexing Implementation Plan

This document outlines the architecture and implementation plan for supporting long-running index requests with browser progress tracking, scaling to 100+ restaurants, and preventing duplicate API calls.

## Current State Analysis

### Adapter Limits (Combined Maximum: ~310 restaurants)
| Adapter | Max Results | Page Size | Notes |
|---------|-------------|-----------|-------|
| Yelp | 240 | 50 | Offset-based pagination |
| Google | 60 | 20 | Token-based, requires 2s delay between pages |
| TripAdvisor | ~10 | N/A | Single API call |

### Current Problems

1. **No progress visibility** - Browser shows generic spinner, no % complete or restaurant names
2. **Timeout risk** - Long operations (especially Google with 2s delays) may timeout
3. **Duplicate API calls** - Re-indexing same location hits external APIs unnecessarily
4. **Blocking requests** - Browser waits synchronously for completion
5. **No resume capability** - Failures require starting over

---

## Proposed Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           BROWSER                                       │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────┐ │
│  │ Index Form  │───▶│ Start Job   │───▶│ SSE Progress Stream         │ │
│  └─────────────┘    │ POST /index │    │ GET /index/jobs/:id/progress│ │
│                     └─────────────┘    └─────────────────────────────┘ │
└────────────────────────────┬───────────────────────┬───────────────────┘
                             │                       │
                             ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         API SERVER                                      │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────────────┐ │
│  │ POST /index    │───▶│ Job Queue      │───▶│ Background Worker      │ │
│  │ Returns job_id │    │ (SQLite-based) │    │ (Threaded processor)   │ │
│  └────────────────┘    └────────────────┘    └────────────────────────┘ │
│                                                        │                │
│  ┌────────────────────────────────────────────────────▼──────────────┐ │
│  │ GET /index/jobs/:id/progress                                      │ │
│  │ Server-Sent Events stream with real-time progress updates         │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component 1: Job Queue System

### Database Schema Addition

```ruby
# lib/infrastructure/database.rb

db.create_table? :index_jobs do
  primary_key :id
  String :job_id, null: false, unique: true  # UUID for external reference
  String :location, null: false
  String :category                            # Optional category filter
  String :status, null: false, default: "pending"  # pending, running, completed, failed
  Integer :progress_current, default: 0
  Integer :progress_total, default: 0
  String :current_restaurant                   # Name of restaurant being processed
  String :current_adapter                      # Which adapter is active
  Text :result_json                            # Final stats as JSON
  Text :error_message                          # Error details if failed
  DateTime :created_at
  DateTime :started_at
  DateTime :completed_at
  index :job_id
  index :status
end
```

### Job States

```
pending → running → completed
    │         │
    └─────────┴──────→ failed
```

### Job Repository

```ruby
# lib/infrastructure/repositories/index_job_repository.rb

module Infrastructure
  module Repositories
    class IndexJobRepository
      def initialize(db = Infrastructure::Database.connection)
        @db = db
      end

      def create(location:, category: nil)
        job_id = SecureRandom.uuid
        @db[:index_jobs].insert(
          job_id: job_id,
          location: location,
          category: category,
          status: "pending",
          created_at: Time.now
        )
        job_id
      end

      def find_by_job_id(job_id)
        @db[:index_jobs].where(job_id: job_id).first
      end

      def update_progress(job_id, current:, total:, restaurant: nil, adapter: nil)
        @db[:index_jobs].where(job_id: job_id).update(
          progress_current: current,
          progress_total: total,
          current_restaurant: restaurant,
          current_adapter: adapter
        )
      end

      def mark_running(job_id)
        @db[:index_jobs].where(job_id: job_id).update(
          status: "running",
          started_at: Time.now
        )
      end

      def mark_completed(job_id, result:)
        @db[:index_jobs].where(job_id: job_id).update(
          status: "completed",
          result_json: result.to_json,
          completed_at: Time.now
        )
      end

      def mark_failed(job_id, error:)
        @db[:index_jobs].where(job_id: job_id).update(
          status: "failed",
          error_message: error,
          completed_at: Time.now
        )
      end

      # Find recent job for same location+category (within 24 hours)
      def find_recent_job(location:, category: nil)
        query = @db[:index_jobs]
          .where(Sequel.function(:lower, :location) => location.downcase)
          .where(status: "completed")
          .where { created_at > Time.now - (24 * 60 * 60) }

        query = category ? query.where(category: category) : query.where(category: nil)
        query.order(Sequel.desc(:created_at)).first
      end
    end
  end
end
```

---

## Component 2: Background Worker

### Thread-based Worker

```ruby
# lib/infrastructure/background_worker.rb

module Infrastructure
  class BackgroundWorker
    def initialize
      @job_repo = Repositories::IndexJobRepository.new
      @running = false
      @thread = nil
    end

    def start
      return if @running
      @running = true
      @thread = Thread.new { process_loop }
    end

    def stop
      @running = false
      @thread&.join(5)
    end

    private

    def process_loop
      while @running
        job = fetch_pending_job
        if job
          process_job(job)
        else
          sleep(1)  # Poll interval
        end
      end
    end

    def fetch_pending_job
      # Atomically claim a pending job
      db = Infrastructure::Database.connection
      db.transaction do
        job = db[:index_jobs]
          .where(status: "pending")
          .order(:created_at)
          .for_update
          .first

        if job
          db[:index_jobs].where(id: job[:id]).update(status: "running", started_at: Time.now)
        end
        job
      end
    end

    def process_job(job)
      service = Services::IndexRestaurantsService.new

      # Create progress callback
      progress_callback = ->(current:, total:, restaurant:, adapter:) {
        @job_repo.update_progress(
          job[:job_id],
          current: current,
          total: total,
          restaurant: restaurant,
          adapter: adapter
        )
      }

      result = service.index(
        location: job[:location],
        categories: job[:category],
        progress_callback: progress_callback
      )

      @job_repo.mark_completed(job[:job_id], result: result)
    rescue => e
      @job_repo.mark_failed(job[:job_id], error: "#{e.class}: #{e.message}")
    end
  end
end
```

---

## Component 3: Updated Index Service

### Progress Callback Support

```ruby
# lib/services/index_restaurants_service.rb

def index(location:, categories: nil, progress_callback: nil)
  configured_adapters = @adapters.select(&:configured?)
  raise NoConfiguredAdaptersError if configured_adapters.empty?

  stats = { total: 0, created: 0, updated: 0, merged: 0 }

  # Phase 1: Estimate totals from all adapters
  estimated_total = estimate_total(configured_adapters, location, categories)
  progress_callback&.call(current: 0, total: estimated_total, restaurant: nil, adapter: nil)

  processed = 0

  configured_adapters.each do |adapter|
    adapter.search_all_businesses(location: location, categories: categories) do |business, _|
      processed += 1

      # Report progress
      progress_callback&.call(
        current: processed,
        total: estimated_total,
        restaurant: business[:name],
        adapter: adapter.source_name
      )

      result = index_single_restaurant(business, adapter.source_name, location)
      stats[result] += 1
      stats[:total] += 1
    end
  end

  stats
end

private

def estimate_total(adapters, location, categories)
  # Quick estimate without full pagination
  total = 0
  adapters.each do |adapter|
    # Use first-page response to estimate
    response = adapter.search_businesses(location: location, categories: categories, limit: 1)
    total += response[:total_estimate] || 50  # Default estimate
  end
  total
end
```

---

## Component 4: API Endpoints

### Updated Server Routes

```ruby
# lib/api/server.rb

# Start indexing job (async)
post "/index" do
  body = parse_json_body
  location = body["location"]
  category = body["category"]

  unless location
    halt 400, json_error("INVALID_REQUEST", "location is required")
  end

  # Check for recent duplicate request
  job_repo = Infrastructure::Repositories::IndexJobRepository.new
  recent_job = job_repo.find_recent_job(location: location, category: category)

  if recent_job && body["force"] != true
    # Return existing job results instead of re-indexing
    return json_response(
      JSON.parse(recent_job[:result_json]),
      job_id: recent_job[:job_id],
      cached: true,
      indexed_at: recent_job[:completed_at]
    )
  end

  # Create new job
  job_id = job_repo.create(location: location, category: category)

  json_response({ job_id: job_id }, status: "queued")
end

# Get job status/progress
get "/index/jobs/:job_id" do
  job_repo = Infrastructure::Repositories::IndexJobRepository.new
  job = job_repo.find_by_job_id(params[:job_id])

  halt 404, json_error("NOT_FOUND", "Job not found") unless job

  response = {
    job_id: job[:job_id],
    status: job[:status],
    progress: {
      current: job[:progress_current],
      total: job[:progress_total],
      percent: job[:progress_total] > 0 ?
        ((job[:progress_current].to_f / job[:progress_total]) * 100).round(1) : 0,
      current_restaurant: job[:current_restaurant],
      current_adapter: job[:current_adapter]
    }
  }

  if job[:status] == "completed"
    response[:result] = JSON.parse(job[:result_json])
  elsif job[:status] == "failed"
    response[:error] = job[:error_message]
  end

  json_response(response)
end

# Server-Sent Events stream for real-time progress
get "/index/jobs/:job_id/progress" do
  content_type "text/event-stream"
  headers "Cache-Control" => "no-cache"

  job_repo = Infrastructure::Repositories::IndexJobRepository.new
  job_id = params[:job_id]

  stream(:keep_open) do |out|
    loop do
      job = job_repo.find_by_job_id(job_id)
      break unless job

      event_data = {
        status: job[:status],
        current: job[:progress_current],
        total: job[:progress_total],
        percent: job[:progress_total] > 0 ?
          ((job[:progress_current].to_f / job[:progress_total]) * 100).round(1) : 0,
        restaurant: job[:current_restaurant],
        adapter: job[:current_adapter]
      }

      if job[:status] == "completed"
        event_data[:result] = JSON.parse(job[:result_json])
        out << "event: complete\ndata: #{event_data.to_json}\n\n"
        break
      elsif job[:status] == "failed"
        event_data[:error] = job[:error_message]
        out << "event: error\ndata: #{event_data.to_json}\n\n"
        break
      else
        out << "event: progress\ndata: #{event_data.to_json}\n\n"
      end

      sleep(0.5)  # Update interval
    end
  end
end
```

---

## Component 5: Browser Progress UI

### Updated API Client

```javascript
// web/js/api.js

/**
 * Start an indexing job (returns immediately with job_id)
 */
export async function startIndexJob(location, category = null, force = false) {
  const body = { location, force };
  if (category) body.category = category;

  return apiRequest('/index', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Get job status (polling)
 */
export async function getJobStatus(jobId) {
  return apiRequest(`/index/jobs/${jobId}`);
}

/**
 * Subscribe to job progress via Server-Sent Events
 * @param {string} jobId - The job ID to monitor
 * @param {object} callbacks - Event callbacks
 * @param {function} callbacks.onProgress - Called with progress updates
 * @param {function} callbacks.onComplete - Called when job completes
 * @param {function} callbacks.onError - Called on job failure
 * @returns {EventSource} - The event source (call .close() to stop)
 */
export function subscribeToJobProgress(jobId, { onProgress, onComplete, onError }) {
  const eventSource = new EventSource(`${API_BASE_URL}/index/jobs/${jobId}/progress`);

  eventSource.addEventListener('progress', (event) => {
    const data = JSON.parse(event.data);
    onProgress?.(data);
  });

  eventSource.addEventListener('complete', (event) => {
    const data = JSON.parse(event.data);
    onComplete?.(data);
    eventSource.close();
  });

  eventSource.addEventListener('error', (event) => {
    if (event.data) {
      const data = JSON.parse(event.data);
      onError?.(data);
    } else {
      onError?.({ error: 'Connection lost' });
    }
    eventSource.close();
  });

  eventSource.onerror = () => {
    onError?.({ error: 'Connection failed' });
    eventSource.close();
  };

  return eventSource;
}
```

### Progress Component

```javascript
// web/js/components/index-progress.js

/**
 * Render indexing progress UI
 */
export function renderIndexProgress(container, { current, total, percent, restaurant, adapter }) {
  container.innerHTML = `
    <div class="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto">
      <h3 class="text-lg font-display font-bold text-gray-800 mb-4">
        Indexing Restaurants...
      </h3>

      <!-- Progress bar -->
      <div class="w-full bg-gray-200 rounded-full h-4 mb-3 overflow-hidden">
        <div
          class="bg-gradient-to-r from-mango to-coral h-4 rounded-full transition-all duration-300"
          style="width: ${percent}%"
        ></div>
      </div>

      <!-- Stats -->
      <div class="flex justify-between text-sm text-gray-600 mb-4">
        <span>${current} of ${total} restaurants</span>
        <span class="font-semibold">${percent}%</span>
      </div>

      <!-- Current activity -->
      ${restaurant ? `
        <div class="text-sm text-gray-500 truncate">
          <span class="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></span>
          Processing: <span class="font-medium text-gray-700">${escapeHtml(restaurant)}</span>
        </div>
        <div class="text-xs text-gray-400 mt-1">
          via ${adapter}
        </div>
      ` : `
        <div class="text-sm text-gray-500">
          <span class="inline-block w-2 h-2 bg-yellow-500 rounded-full animate-pulse mr-2"></span>
          Preparing...
        </div>
      `}
    </div>
  `;
}

/**
 * Render completion state
 */
export function renderIndexComplete(container, { result, location }) {
  container.innerHTML = `
    <div class="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto text-center">
      <div class="text-5xl mb-4">✓</div>
      <h3 class="text-xl font-display font-bold text-gray-800 mb-2">
        Indexing Complete!
      </h3>

      <div class="grid grid-cols-2 gap-4 my-6 text-left">
        <div class="bg-gray-50 rounded-lg p-3">
          <div class="text-2xl font-bold text-mango">${result.total}</div>
          <div class="text-xs text-gray-500">Total Processed</div>
        </div>
        <div class="bg-gray-50 rounded-lg p-3">
          <div class="text-2xl font-bold text-green-600">${result.created}</div>
          <div class="text-xs text-gray-500">New Restaurants</div>
        </div>
        <div class="bg-gray-50 rounded-lg p-3">
          <div class="text-2xl font-bold text-blue-600">${result.updated}</div>
          <div class="text-xs text-gray-500">Updated</div>
        </div>
        <div class="bg-gray-50 rounded-lg p-3">
          <div class="text-2xl font-bold text-purple-600">${result.merged}</div>
          <div class="text-xs text-gray-500">Merged (Duplicates)</div>
        </div>
      </div>

      <div class="flex gap-3">
        <a href="/index.html?location=${encodeURIComponent(location)}"
           class="flex-1 bg-mango text-white py-2 px-4 rounded-lg font-semibold hover:bg-orange-500 transition">
          Search ${escapeHtml(location)}
        </a>
        <button onclick="location.reload()"
                class="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-semibold hover:bg-gray-200 transition">
          Index Another
        </button>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

### Updated Index Form Controller

```javascript
// web/js/index-form.js (updated performIndexing function)

import { startIndexJob, subscribeToJobProgress } from './api.js';
import { renderIndexProgress, renderIndexComplete } from './components/index-progress.js';

async function performIndexing(location, category) {
  const form = document.getElementById('index-form');
  const resultContainer = document.getElementById('result-container');

  // Disable form
  form.querySelectorAll('input, button').forEach(el => el.disabled = true);

  try {
    // Start the job
    const response = await startIndexJob(location, category);

    // Check if we got cached results
    if (response.meta?.cached) {
      renderIndexComplete(resultContainer, {
        result: response.data,
        location: location
      });
      showCacheNotice(resultContainer, response.meta.indexed_at);
      return;
    }

    const jobId = response.data.job_id;

    // Subscribe to progress updates
    subscribeToJobProgress(jobId, {
      onProgress: (data) => {
        renderIndexProgress(resultContainer, data);
      },
      onComplete: (data) => {
        renderIndexComplete(resultContainer, {
          result: data.result,
          location: location
        });
      },
      onError: (data) => {
        showError(resultContainer, data.error || 'Indexing failed');
      }
    });

    // Show initial progress state
    renderIndexProgress(resultContainer, {
      current: 0,
      total: 0,
      percent: 0,
      restaurant: null,
      adapter: null
    });

  } catch (error) {
    showError(resultContainer, error.message);
  } finally {
    // Re-enable form after completion or error
    form.querySelectorAll('input, button').forEach(el => el.disabled = false);
  }
}

function showCacheNotice(container, indexedAt) {
  const notice = document.createElement('div');
  notice.className = 'text-sm text-gray-500 text-center mt-4';
  notice.innerHTML = `
    <p>Using cached results from ${new Date(indexedAt).toLocaleDateString()}</p>
    <button onclick="forceReindex()" class="text-mango hover:underline">
      Force re-index
    </button>
  `;
  container.appendChild(notice);
}
```

---

## Component 6: Duplicate Prevention

### Location Indexing Tracker

Add tracking of what's been indexed and when:

```ruby
# lib/infrastructure/database.rb

db.create_table? :indexed_locations do
  primary_key :id
  String :location_normalized, null: false  # lowercased, trimmed
  String :category                          # null = all categories
  DateTime :last_indexed_at, null: false
  Integer :restaurant_count, default: 0
  unique [:location_normalized, :category]
end
```

### Deduplication Logic

```ruby
# lib/services/index_restaurants_service.rb

def should_skip_indexing?(location:, category:)
  db = Infrastructure::Database.connection

  recent_index = db[:indexed_locations]
    .where(location_normalized: location.downcase.strip)
    .where(category: category)
    .where { last_indexed_at > Time.now - (24 * 60 * 60) }  # Within 24 hours
    .first

  recent_index != nil
end

def record_indexing(location:, category:, count:)
  db = Infrastructure::Database.connection

  db[:indexed_locations].insert_conflict(
    target: [:location_normalized, :category],
    update: { last_indexed_at: Time.now, restaurant_count: count }
  ).insert(
    location_normalized: location.downcase.strip,
    category: category,
    last_indexed_at: Time.now,
    restaurant_count: count
  )
end
```

### Skip Logic in API

```ruby
# In POST /index endpoint

# Check if recently indexed (unless force=true)
if !body["force"] && service.should_skip_indexing?(location: location, category: category)
  existing_count = restaurant_repo.count_by_location(location)

  return json_response({
    message: "Location recently indexed",
    restaurant_count: existing_count,
    action: "Use force=true to re-index"
  }, cached: true)
end
```

---

## Component 7: Scaling to 100+ Restaurants

### Current Capacity
Already supported: Yelp (240) + Google (60) + TripAdvisor (10) = ~310 max

### Performance Optimizations

1. **Parallel Adapter Calls** (with care for rate limits)
```ruby
def index_parallel(location:, categories: nil)
  threads = configured_adapters.map do |adapter|
    Thread.new { index_with_adapter(adapter, location, categories) }
  end

  threads.map(&:value).reduce({}) do |acc, result|
    acc.merge(result) { |key, old, new| old + new }
  end
end
```

2. **Batch Database Inserts**
```ruby
def batch_save_restaurants(restaurants)
  db.transaction do
    restaurants.each_slice(50) do |batch|
      # Use multi-insert for better performance
      db[:restaurants].multi_insert(batch)
    end
  end
end
```

3. **Connection Pooling**
```ruby
# lib/infrastructure/database.rb
DB = Sequel.connect(
  Config.db_path,
  max_connections: 5,
  pool_timeout: 10
)
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Foundation)
1. Add `index_jobs` table to database schema
2. Create `IndexJobRepository`
3. Create `BackgroundWorker` class
4. Update `IndexRestaurantsService` with progress callback support

### Phase 2: API Endpoints
1. Update `POST /index` to create jobs and return job_id
2. Add `GET /index/jobs/:job_id` for status polling
3. Add `GET /index/jobs/:job_id/progress` SSE endpoint
4. Add caching/duplicate detection logic

### Phase 3: Browser UI
1. Create `index-progress.js` component
2. Update `api.js` with SSE subscription helpers
3. Update `index-form.js` to use async job flow
4. Add progress bar and real-time updates

### Phase 4: Duplicate Prevention
1. Add `indexed_locations` table
2. Implement skip logic for recent indexes
3. Add "force re-index" option in UI
4. Show "cached results" indicator

### Phase 5: Polish & Testing
1. Add timeout/retry handling
2. Implement graceful shutdown for worker
3. Add job cleanup (delete old completed jobs)
4. Write integration tests for full flow

---

## Alternative Approaches Considered

### Option A: Polling (Simpler)
- Browser polls `GET /index/jobs/:id` every 1-2 seconds
- Pros: Works everywhere, simpler implementation
- Cons: More server load, less real-time feel

### Option B: WebSockets (More Complex)
- Full duplex communication
- Pros: Most real-time, efficient
- Cons: Requires WebSocket server setup, more complex

### Option C: Server-Sent Events (Recommended)
- One-way server-to-client stream
- Pros: Simple, native browser support, real-time
- Cons: One-directional only (fine for our use case)

**Recommendation: SSE with polling fallback** for browsers that don't support SSE.

---

## API Contract Summary

### Start Index Job
```
POST /index
Content-Type: application/json

{
  "location": "barrie, ontario",
  "category": "bakery",      // optional
  "force": false             // optional, skip cache check
}

Response (new job):
{
  "data": { "job_id": "abc-123-..." },
  "meta": { "status": "queued" }
}

Response (cached):
{
  "data": { "total": 42, "created": 30, ... },
  "meta": { "cached": true, "indexed_at": "2026-01-27T..." }
}
```

### Get Job Status
```
GET /index/jobs/:job_id

Response:
{
  "data": {
    "job_id": "abc-123",
    "status": "running",
    "progress": {
      "current": 25,
      "total": 100,
      "percent": 25.0,
      "current_restaurant": "Pizza Palace",
      "current_adapter": "yelp"
    }
  }
}
```

### Progress Stream (SSE)
```
GET /index/jobs/:job_id/progress
Accept: text/event-stream

event: progress
data: {"current":25,"total":100,"percent":25.0,"restaurant":"Pizza Palace","adapter":"yelp"}

event: progress
data: {"current":26,"total":100,"percent":26.0,"restaurant":"Burger Barn","adapter":"yelp"}

event: complete
data: {"status":"completed","result":{"total":100,"created":80,"updated":15,"merged":5}}
```

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `lib/infrastructure/database.rb` | Modify | Add `index_jobs` and `indexed_locations` tables |
| `lib/infrastructure/repositories/index_job_repository.rb` | Create | Job queue data access |
| `lib/infrastructure/background_worker.rb` | Create | Threaded job processor |
| `lib/services/index_restaurants_service.rb` | Modify | Add progress callback, duplicate check |
| `lib/api/server.rb` | Modify | Add job endpoints, SSE streaming |
| `web/js/api.js` | Modify | Add job API and SSE helpers |
| `web/js/components/index-progress.js` | Create | Progress bar component |
| `web/js/index-form.js` | Modify | Use async job flow |
| `tests/unit/repositories/index_job_repository_test.rb` | Create | Repository tests |
| `tests/integration/index_job_test.rb` | Create | Full flow tests |
