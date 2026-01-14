# frozen_string_literal: true

require 'securerandom'
require 'concurrent'

module GrubStars
  module API
    class JobManager
      MAX_WORKERS = 3

      Job = Struct.new(:id, :status, :result, :error, :created_at, :completed_at, keyword_init: true)

      class << self
        def instance
          @instance ||= new
        end

        def reset!
          @instance&.shutdown
          @instance = nil
        end
      end

      def initialize
        @jobs = Concurrent::Hash.new
        @pool = Concurrent::FixedThreadPool.new(MAX_WORKERS)
      end

      def enqueue(&block)
        job_id = SecureRandom.uuid
        job = Job.new(
          id: job_id,
          status: :pending,
          result: nil,
          error: nil,
          created_at: Time.now,
          completed_at: nil
        )
        @jobs[job_id] = job

        @pool.post do
          run_job(job_id, &block)
        end

        job_id
      end

      def get(job_id)
        @jobs[job_id]
      end

      def all
        @jobs.values.sort_by(&:created_at).reverse
      end

      def active_count
        @jobs.values.count { |j| j.status == :pending || j.status == :running }
      end

      def shutdown
        @pool.shutdown
        @pool.wait_for_termination(5)
      end

      private

      def run_job(job_id)
        job = @jobs[job_id]
        job.status = :running

        begin
          result = yield
          job.status = :completed
          job.result = result
        rescue => e
          job.status = :failed
          job.error = e.message
        ensure
          job.completed_at = Time.now
        end
      end
    end
  end
end
