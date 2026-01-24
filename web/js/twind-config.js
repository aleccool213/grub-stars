/**
 * Grub Stars Twind Configuration
 * "Cosmic Comfort Food" theme
 *
 * Twind is a small (~17KB) Tailwind-in-JS runtime that generates CSS on the fly.
 * No build step required - just include this after twind.min.js
 *
 * Usage:
 * <script src="/js/vendor/twind.min.js"></script>
 * <script src="/js/twind-config.js"></script>
 */

// Guard against missing Twind
if (typeof twind === 'undefined') {
  console.error('Twind not loaded. Make sure to include twind.min.js before this file.');
} else {
  twind.install({
    presets: [twind.presetAutoprefix(), twind.presetTailwind()],
    theme: {
      extend: {
        colors: {
          // Primary colors
          mango: '#FFB347',
          hotpink: '#FF6B9D',
          electric: '#A855F7',

          // Supporting colors
          mint: '#6EE7B7',
          sunny: '#FDE047',
          coral: '#FB7185',

          // Neutrals
          cream: '#FFFBF5',
          cocoa: '#4A3728',
          latte: '#F5E6D3',
        },
        fontFamily: {
          display: ['Fredoka', 'Comic Sans MS', 'cursive'],
          body: ['Nunito', 'system-ui', 'sans-serif'],
        },
        boxShadow: {
          'card': '0 4px 20px -2px rgba(168, 85, 247, 0.15)',
          'glow': '0 8px 30px -4px rgba(168, 85, 247, 0.3)',
          'glow-pink': '0 8px 30px -4px rgba(255, 107, 157, 0.4)',
        },
        borderRadius: {
          '2xl': '1rem',
          '3xl': '1.5rem',
        },
        animation: {
          'wiggle': 'wiggle 0.3s ease-in-out',
          'float': 'float 3s ease-in-out infinite',
          'pop-in': 'pop-in 0.3s ease-out',
          'bounce-in': 'bounce-in 0.4s ease-out',
          'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
          'rainbow': 'rainbow-shift 3s ease infinite',
          'sparkle': 'sparkle 1.5s ease-in-out infinite',
        },
        keyframes: {
          wiggle: {
            '0%, 100%': { transform: 'rotate(-3deg)' },
            '50%': { transform: 'rotate(3deg)' },
          },
          float: {
            '0%, 100%': { transform: 'translateY(0)' },
            '50%': { transform: 'translateY(-10px)' },
          },
          'pop-in': {
            '0%': { transform: 'scale(0.8)', opacity: '0' },
            '50%': { transform: 'scale(1.05)', opacity: '1' },
            '100%': { transform: 'scale(1)', opacity: '1' },
          },
          'bounce-in': {
            '0%': { transform: 'scale(0)', opacity: '0' },
            '50%': { transform: 'scale(1.1)' },
            '70%': { transform: 'scale(0.95)' },
            '100%': { transform: 'scale(1)', opacity: '1' },
          },
          'pulse-glow': {
            '0%, 100%': { boxShadow: '0 0 0 0 rgba(168, 85, 247, 0.4)' },
            '50%': { boxShadow: '0 0 20px 10px rgba(168, 85, 247, 0.2)' },
          },
          'rainbow-shift': {
            '0%': { backgroundPosition: '0% 50%' },
            '50%': { backgroundPosition: '100% 50%' },
            '100%': { backgroundPosition: '0% 50%' },
          },
          sparkle: {
            '0%, 100%': { opacity: '1', transform: 'scale(1)' },
            '50%': { opacity: '0.5', transform: 'scale(0.8)' },
          },
        },
      },
    },
  });
}
