# frozen_string_literal: true

FROM ruby:3.3.6-slim

# Install dependencies
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
    build-essential \
    sqlite3 \
    libsqlite3-dev \
    curl && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy Gemfile first for layer caching
COPY Gemfile Gemfile.lock ./

# Install gems with bundler 2.5.23
RUN gem install bundler -v 2.5.23 && \
    bundle _2.5.23_ config set --local deployment true && \
    bundle _2.5.23_ config set --local without development test && \
    bundle _2.5.23_ install

# Copy application code
COPY . .

# Create data directory for SQLite database
RUN mkdir -p /data

# Environment variables
ENV RACK_ENV=production
ENV GRUB_STARS_CONFIG_DIR=/data

# Expose port
EXPOSE 9292

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD curl -f http://localhost:9292/health || exit 1

# Start server
CMD ["bundle", "_2.5.23_", "exec", "rackup", "-o", "0.0.0.0", "-p", "9292"]
