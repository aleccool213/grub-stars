# grub stars Web Frontend

Zero-build, zero-framework web interface for grub stars.

## Quick Start

1. **Start the API server:**
   ```bash
   bundle _2.5.23_ exec rackup
   ```

2. **Open in browser:**
   ```
   http://localhost:9292/
   ```

That's it! No build step, no npm install, no webpack. Just edit and refresh.

## Pages

- **`/`** - Search restaurants
- **`/details.html`** - Restaurant details page
- **`/categories.html`** - Browse categories
- **`/index-location.html`** - Index new locations
- **`/test.html`** - Run automated tests

## Testing

### Automated Tests

Two-tier testing approach:

#### 1. Ruby Integration Tests

Test that static files are served correctly:

```bash
bundle _2.5.23_ exec rake test:integration
```

This runs `tests/integration/web_ui_test.rb` which verifies:
- HTML pages load correctly
- JavaScript modules are served with correct content type
- CSS files are accessible
- API endpoints are accessible from web UI

#### 2. Browser JavaScript Tests

Test JavaScript logic in the browser:

1. Start API server: `bundle _2.5.23_ exec rackup`
2. Open: `http://localhost:9292/test.html`
3. Open browser console (F12) to see detailed results

Tests include:
- API client functionality
- Component rendering
- Form validation
- Error handling

#### Adding New Tests

**Ruby tests:**
Edit `tests/integration/web_ui_test.rb`

**JS tests:**
1. Create `web/js/yourmodule.test.js`
2. Import test framework:
   ```javascript
   import { test, assert, assertEqual } from './test-framework.js';
   ```
3. Write tests:
   ```javascript
   test('your test name', async () => {
     assertEqual(1 + 1, 2);
   });
   ```
4. Import in `web/test.html`:
   ```javascript
   import './js/yourmodule.test.js';
   ```

### Manual Testing

Open pages in different browsers and devices:
- Chrome (desktop + mobile DevTools)
- Firefox
- Safari (desktop + iOS)
- Different screen sizes

## Development Workflow

1. **Edit files** - Modify HTML, CSS, or JS
2. **Refresh browser** (Cmd+R / F5) - See changes immediately
3. **Check console** - For errors or logs
4. **Run tests** - Verify nothing broke

No build step, no hot reload, no complex tooling.

## Tech Stack

| Technology | Purpose | Delivery |
|------------|---------|----------|
| HTML5 | Structure | Static files |
| Vanilla JavaScript (ES6+) | Logic | ES modules |
| Tailwind CSS | Styling | CDN |
| Fetch API | API calls | Browser native |

## File Structure

```
web/
├── index.html              # Main search page
├── details.html            # Restaurant details
├── index-location.html     # Index form
├── categories.html         # Browse categories
├── test.html               # Test runner
├── js/
│   ├── api.js             # REST API client
│   ├── search.js          # Search page controller
│   ├── details.js         # Details page controller
│   ├── index-form.js      # Index form controller
│   ├── categories-list.js # Categories controller
│   ├── test-framework.js  # Browser test framework
│   ├── api.test.js        # API client tests
│   └── components/        # Reusable components
│       ├── restaurant-card.js    # Restaurant result card
│       ├── loading-spinner.js    # Loading state indicator
│       └── error-message.js      # Error display component
└── css/
    └── custom.css         # Custom styles
```

## API Integration

Web UI connects to the same Sinatra server that provides the REST API:

```javascript
// api.js uses localhost:9292
const API_BASE_URL = 'http://localhost:9292';
```

Since both UI and API are served from the same origin, no CORS configuration is needed.

## Browser Support

**Minimum Requirements:**
- ES6+ (2015+)
- Native ES modules
- Fetch API
- CSS Grid and Flexbox

**Tested Browsers:**
- Chrome/Edge 61+
- Firefox 60+
- Safari 11+
- Mobile Safari (iOS 11+)

## Deployment

The web UI is served by Sinatra from the `web/` directory. In production:

1. Ensure `web/` directory is included in deployment
2. Sinatra `public_folder` is set to `web/` (already configured in `lib/api/server.rb`)
3. Start server: `bundle exec rackup`
4. Access at server URL

### Docker

Web files are automatically included:
```dockerfile
COPY web /app/web
```

Sinatra serves them from the public folder.

## Debugging

**Browser DevTools:**
- **Console:** View logs and errors
- **Network:** Inspect API requests/responses
- **Elements:** Inspect/modify DOM and styles
- **Sources:** Set breakpoints in JS

**Common Issues:**

| Issue | Solution |
|-------|----------|
| CORS errors | Use Sinatra serving (same origin) |
| Module not found | Check import paths |
| API errors | Verify server running on :9292 |
| Styles not loading | Check Tailwind CDN loaded |

## Performance

**Initial Load:**
- HTML: ~2KB
- JavaScript: ~20KB (all modules)
- Tailwind CDN: ~100KB (cached)
- **Total: ~122KB**

**Optimization:**
- Images lazy load: `<img loading="lazy">`
- Minimal custom CSS
- ES modules naturally code-split by page

## Next Steps

See `docs/web-frontend.md` for the complete 14-phase implementation plan.

**Immediate TODOs:**
1. ~~Implement search.js page controller~~ (done)
2. ~~Create reusable components (restaurant-card.js, loading-spinner.js, error-message.js)~~ (done)
3. ~~Implement index-form.js to run indexer from web UI~~ (done)
4. ~~Implement details.js page controller~~ (done)
5. ~~Implement categories-list.js page controller~~ (done)
6. Add responsive design (mobile + desktop)

## Philosophy

**Keep it simple:**
- No build step
- No frameworks
- No complexity
- Just HTML, CSS, JavaScript

**When to add complexity:**
- Only if performance becomes a real issue
- Only if features demand it
- Only after measuring the problem

**For now: Stay simple.**
