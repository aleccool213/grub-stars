# Implementation Plan: Restaurant Name Search with Autocomplete

## Overview

Add autocomplete/typeahead functionality to the search page that allows users to search for restaurants by name from the local database. This improves UX by providing instant feedback as users type and allows direct navigation to restaurant details.

## Current State

- **Search page** (`index.html`) has a "What are you craving?" text input for food type/category search
- **Address autocomplete** is already implemented using Photon API (`address-autocomplete.js`) - can use as a reference
- **Backend** already has `SearchRestaurantsService` with `search_by_name` capability
- **Repository** has `search_by_name(query)` method that does partial matching

## Goals

1. Add a dedicated restaurant name search input with autocomplete dropdown
2. Create new API endpoint for efficient autocomplete queries
3. Show restaurant metadata (rating, location, category) in dropdown for disambiguation
4. Allow clicking a result to navigate directly to restaurant details page

## Implementation Steps

### Phase 1: Backend API Endpoint

**1.1 Add autocomplete endpoint to Sinatra server**

File: `lib/api/server.rb`

```ruby
get '/restaurants/autocomplete' do
  query = params[:q]&.strip
  limit = (params[:limit] || 10).to_i.clamp(1, 20)

  halt 400, json_error("Query parameter 'q' is required") if query.nil? || query.empty?
  halt 400, json_error("Query must be at least 2 characters") if query.length < 2

  restaurants = restaurant_repository.autocomplete(query, limit: limit)

  json_response(restaurants.map { |r|
    {
      id: r.id,
      name: r.name,
      address: r.address,
      city: r.city,
      average_rating: r.average_rating,
      primary_category: r.categories.first&.name
    }
  })
end
```

**1.2 Add autocomplete method to RestaurantRepository**

File: `lib/infrastructure/repositories/restaurant_repository.rb`

```ruby
def autocomplete(query, limit: 10)
  # Use LIKE with prefix matching for better performance
  # Could add trigram search later for fuzzy matching
  dataset = db[:restaurants]
    .where(Sequel.ilike(:name, "#{query}%"))
    .or(Sequel.ilike(:name, "%#{query}%"))
    .order(Sequel.desc(:review_count))  # Prioritize popular restaurants
    .limit(limit)

  dataset.map { |row| build_restaurant_with_categories(row) }
end
```

### Phase 2: Frontend Autocomplete Component

**2.1 Create restaurant-autocomplete.js component**

File: `web/js/components/restaurant-autocomplete.js`

Based on the existing `address-autocomplete.js` pattern:

- Debounced input handler (300ms delay)
- Keyboard navigation (up/down arrows, enter, escape)
- ARIA attributes for accessibility
- Shows dropdown with restaurant cards
- Fires custom event when restaurant selected

```javascript
// Key features:
// - Minimum 2 characters before searching
// - Debounce 300ms
// - Show loading indicator while fetching
// - Display: name, rating stars, location, category
// - Click or Enter navigates to /details.html?id=<id>
// - Escape closes dropdown
// - Click outside closes dropdown
```

**2.2 Component API**

```javascript
import { createRestaurantAutocomplete } from './components/restaurant-autocomplete.js';

// Initialize on an input element
const autocomplete = createRestaurantAutocomplete(inputElement, {
  onSelect: (restaurant) => {
    // Navigate to details page
    window.location.href = `/details.html?id=${restaurant.id}`;
  },
  minChars: 2,
  debounceMs: 300,
  limit: 10
});
```

### Phase 3: Search Page Integration

**3.1 Update search.html with autocomplete input**

Option A: Replace "What are you craving?" with restaurant name autocomplete
Option B: Add separate "Search by restaurant name" input field

**Recommended: Option B** - Keep both search types

```html
<!-- New section above existing search -->
<div class="mb-6">
  <label class="block text-cocoa font-medium mb-2">
    Search by restaurant name
  </label>
  <div class="relative">
    <input
      type="text"
      id="restaurant-search"
      placeholder="Start typing a restaurant name..."
      class="w-full px-4 py-3 rounded-xl border-2 border-latte"
      autocomplete="off"
    />
    <!-- Dropdown renders here -->
  </div>
</div>

<div class="text-center text-cocoa/60 my-4">— or —</div>

<!-- Existing category/location search form -->
```

**3.2 Update search.js to initialize autocomplete**

```javascript
import { createRestaurantAutocomplete } from './components/restaurant-autocomplete.js';

document.addEventListener('DOMContentLoaded', () => {
  const restaurantInput = document.getElementById('restaurant-search');

  if (restaurantInput) {
    createRestaurantAutocomplete(restaurantInput, {
      onSelect: (restaurant) => {
        window.location.href = `/details.html?id=${restaurant.id}`;
      }
    });
  }

  // ... existing search form logic
});
```

### Phase 4: Styling

**4.1 Dropdown styling using Twind classes**

```html
<div class="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-lg border border-latte overflow-hidden">
  <!-- Each result item -->
  <div class="px-4 py-3 hover:bg-cream cursor-pointer border-b border-latte/30">
    <div class="font-semibold text-cocoa">Restaurant Name</div>
    <div class="text-sm text-cocoa/70 flex items-center gap-2">
      <span>★ 4.5</span>
      <span>•</span>
      <span>Italian</span>
      <span>•</span>
      <span>Downtown</span>
    </div>
  </div>
</div>
```

### Phase 5: Testing

**5.1 Backend tests**

File: `tests/integration/api_test.rb`

```ruby
def test_autocomplete_returns_matching_restaurants
  # Setup: create test restaurants
  # Test: GET /restaurants/autocomplete?q=pizza
  # Assert: returns matching restaurants with expected fields
end

def test_autocomplete_requires_query_param
  # GET /restaurants/autocomplete
  # Assert: 400 error
end

def test_autocomplete_requires_minimum_length
  # GET /restaurants/autocomplete?q=a
  # Assert: 400 error
end
```

**5.2 Frontend tests**

File: `web/js/components/restaurant-autocomplete.test.js`

- Test dropdown renders on input
- Test keyboard navigation
- Test selection fires callback
- Test debouncing works
- Test escape closes dropdown
- Test click outside closes dropdown

### Phase 6: Documentation

**6.1 Update CLAUDE.md**

- Move "Restaurant Name Search with Autocomplete" from Future Ideas to Completed
- Document the new API endpoint in the API Endpoints table

**6.2 Update API documentation**

Add to endpoint table:
| `/restaurants/autocomplete?q=X&limit=N` | GET | Autocomplete restaurant names |

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `lib/api/server.rb` | Modify | Add `/restaurants/autocomplete` endpoint |
| `lib/infrastructure/repositories/restaurant_repository.rb` | Modify | Add `autocomplete` method |
| `web/js/components/restaurant-autocomplete.js` | Create | New autocomplete component |
| `web/js/components/restaurant-autocomplete.test.js` | Create | Component tests |
| `web/index.html` | Modify | Add restaurant name search input |
| `web/js/search.js` | Modify | Initialize autocomplete component |
| `tests/integration/api_test.rb` | Modify | Add autocomplete endpoint tests |
| `CLAUDE.md` | Modify | Update documentation |

## Dependencies

- No new dependencies required
- Reuses patterns from existing `address-autocomplete.js`
- Uses existing `api.js` for HTTP requests

## Considerations

### Performance
- Prefix matching (`name LIKE 'query%'`) is faster than full substring matching
- Consider adding database index on `restaurants.name` if not present
- Limit results to 10 by default to keep responses fast

### UX
- Show "No restaurants found" message when query matches nothing
- Show "Keep typing..." hint for single character input
- Consider showing recent searches (future enhancement)

### Accessibility
- Use ARIA attributes (role="listbox", aria-activedescendant)
- Support keyboard navigation
- Announce results to screen readers

## Estimated Scope

- **Backend**: ~30 lines of code
- **Frontend component**: ~150 lines of code
- **Tests**: ~100 lines of code
- **Integration**: ~20 lines of code

## Success Criteria

1. Users can type a restaurant name and see matching results in real-time
2. Clicking a result navigates to the restaurant details page
3. Keyboard navigation works (up/down/enter/escape)
4. Works on mobile devices
5. Accessible to screen readers
6. Tests pass for both backend and frontend
