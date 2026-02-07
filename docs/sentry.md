# Error Tracking with Sentry

Sentry is configured for both the Ruby API server and the JavaScript Web UI.

## Ruby API Server Setup

The API server uses the `sentry-ruby` gem with Rack middleware integration.

**Configuration:**
- Config file: `lib/config/sentry.rb`
- Environment variables in `.env`:
  - `SENTRY_DSN` - Your Sentry project DSN
  - `SENTRY_ENVIRONMENT` - Environment name (development, production)
  - `SENTRY_TRACES_SAMPLE_RATE` - Performance tracing sample rate (0.0-1.0)
  - `SENTRY_PROFILES_SAMPLE_RATE` - Profiling sample rate (0.0-1.0)

**Features:**
- Automatic error capturing via `Sentry::Rack::CaptureExceptions` middleware
- Breadcrumbs from HTTP requests and logs
- Performance tracing with configurable sample rates
- Release tracking with git commit SHA
- Environment-specific filtering

**Manual Error Capturing:**
```ruby
Sentry.capture_exception(error)
Sentry.capture_message("Something went wrong")
Sentry.capture_exception(error, extra: { restaurant_id: 123 })
```

## JavaScript SDK Setup

1. Add the Sentry JavaScript SDK to your HTML:
```html
<script src="https://browser.sentry-cdn.com/7.100.1/bundle.min.js" crossorigin="anonymous"></script>
```

2. Initialize Sentry in your JavaScript:
```javascript
Sentry.init({
  dsn: "https://43c2083e3a9d93430e19b51fec5a98f6@o4510802574835712.ingest.us.sentry.io/4510802575163392",
  release: "grub-stars@0.1.0",
  environment: "production"
});
```

## Sentry CLI Commands

```bash
sentry-cli releases new VERSION                          # Create a new release
sentry-cli releases set-commits VERSION --auto           # Associate commits
sentry-cli releases deploys VERSION new -e production    # Deploy release
sentry-cli releases files VERSION upload-sourcemaps ./web/js  # Upload source maps
```

**Release Management Script:**
```bash
./scripts/sentry-release.sh [version]    # Uses git commit SHA if version not specified
```

## Automated Deployment Integration

Sentry releases are automatically created during Fly.io deployments via GitHub Actions.

**GitHub Actions Workflows:**
- `.github/workflows/deploy-test.yml` - Creates Sentry release for test environment
- `.github/workflows/deploy-prod.yml` - Creates Sentry release for production environment

**Required Secret:**
Add `SENTRY_AUTH_TOKEN` to your GitHub repository secrets:
1. Go to: https://github.com/aleccool213/grub-stars/settings/secrets/actions
2. Add secret named `SENTRY_AUTH_TOKEN` with token from https://sentry.io/settings/account/api/auth-tokens/

If `SENTRY_AUTH_TOKEN` is not set, deployments proceed but skip the Sentry release step.

## Ruby 4.0 Compatibility

When using Sentry with Ruby 4.0, you may encounter `uninitialized constant Logger (NameError)` because Logger was moved out of Ruby's standard library.

**Solution:** The `config.ru` file requires `logger` before loading Sentry. If issues persist:
```bash
ruby -I lib -r logger -r bundler/setup -e "require 'dotenv'; Dotenv.load; require_relative 'lib/api/server'; require 'rack'; Rack::Server.start(app: GrubStars::API::Server, Port: 9292, Host: '0.0.0.0')"
```
