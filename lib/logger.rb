# frozen_string_literal: true

require "pastel"

module GrubStars
  class Logger
    def initialize(output: $stdout, enabled: true, colors: true)
      @output = output
      @enabled = enabled
      @pastel = colors ? Pastel.new : Pastel.new(enabled: false)
    end

    def info(message)
      return unless @enabled

      @output.puts message
    end

    # Debug logging - outputs detailed information for troubleshooting
    def debug(message)
      return unless @enabled

      @output.puts @pastel.dim("[DEBUG] #{message}")
    end

    # Warning logging - outputs warning messages
    def warn(message)
      return unless @enabled

      @output.puts @pastel.yellow("[WARN] #{message}")
    end

    def progress(name:, current:, total:, percent:, adapter: nil)
      return unless @enabled

      bar_width = 20
      filled = (percent / 100.0 * bar_width).round
      empty = bar_width - filled

      # Colored progress bar
      bar = @pastel.green("█" * filled) + @pastel.dim("░" * empty)

      # Truncate name if too long
      display_name = name.length > 35 ? "#{name[0..32]}..." : name

      percent_str = @pastel.cyan("#{percent.to_s.rjust(5)}%")
      count_str = @pastel.dim("(#{current}/#{total})")
      name_str = @pastel.white(display_name)

      # Include adapter name if provided
      adapter_str = adapter ? @pastel.magenta("[#{adapter}] ") : ""

      line = "\r   #{adapter_str}[#{bar}] #{percent_str} #{count_str} #{name_str}"
      @output.print line.ljust(110)
      @output.flush
    end

    # Display adapter phase message (starting, completed)
    def adapter_phase(adapter:, phase:, stats: nil)
      return unless @enabled

      case phase
      when :starting
        @output.puts @pastel.bold("   📡 Indexing from #{@pastel.magenta(adapter)}...")
      when :completed
        if stats
          @output.puts @pastel.dim("      ✓ #{stats[:total]} found (#{stats[:created]} new, #{stats[:merged]} merged, #{stats[:updated]} updated)")
        else
          @output.puts @pastel.dim("      ✓ Complete")
        end
      end
    end

    def clear_line
      return unless @enabled

      @output.print "\r" + " " * 100 + "\r"
      @output.flush
    end

    def newline
      return unless @enabled

      @output.puts
    end

    # Create a silent logger for tests
    def self.silent
      new(output: StringIO.new, enabled: false, colors: false)
    end
  end
end
