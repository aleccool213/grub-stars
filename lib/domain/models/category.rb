# frozen_string_literal: true

module Domain
  module Models
    # Category domain model
    class Category
      attr_accessor :id, :name

      def initialize(attributes = {})
        @id = attributes[:id]
        @name = attributes[:name]
      end

      def to_h
        {
          id: id,
          name: name
        }
      end

      def to_s
        name
      end
    end
  end
end
