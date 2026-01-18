# Grub Stars Design System

A fun, whimsical design language for finding delicious food with friends.

## Theme: "Cosmic Comfort Food"

The theme blends the **stars** in "grub stars" with warm, appetizing food vibes. Think: a cozy diner floating in space, where every meal is an adventure.

## Color Palette

### Primary Colors
| Name | Tailwind Class | Hex | Usage |
|------|---------------|-----|-------|
| **Mango** | `bg-mango` / `text-mango` | `#FFB347` | Primary actions, highlights |
| **Hot Pink** | `bg-hotpink` / `text-hotpink` | `#FF6B9D` | Accents, fun elements |
| **Electric Purple** | `bg-electric` / `text-electric` | `#A855F7` | Secondary actions, links |

### Supporting Colors
| Name | Tailwind Class | Hex | Usage |
|------|---------------|-----|-------|
| **Mint** | `bg-mint` / `text-mint` | `#6EE7B7` | Success states |
| **Sunny** | `bg-sunny` / `text-sunny` | `#FDE047` | Ratings, stars |
| **Coral** | `bg-coral` / `text-coral` | `#FB7185` | Warnings, errors |

### Neutrals
| Name | Tailwind Class | Hex | Usage |
|------|---------------|-----|-------|
| **Cream** | `bg-cream` | `#FFFBF5` | Page backgrounds |
| **Cocoa** | `text-cocoa` | `#4A3728` | Primary text |
| **Latte** | `bg-latte` | `#F5E6D3` | Card backgrounds |

## Typography

### Font Stack
- **Display/Headlines**: `font-display` - "Fredoka" (rounded, playful)
- **Body**: `font-body` - "Nunito" (friendly, readable)

### Scale
```
text-4xl font-display  → Page titles (32px, bold)
text-2xl font-display  → Section headers (24px, semibold)
text-xl font-body      → Card titles (20px, medium)
text-base font-body    → Body text (16px, regular)
text-sm font-body      → Secondary text (14px, regular)
```

## Spacing & Layout

### Border Radius
Everything is **extra rounded** for a friendly feel:
- Cards: `rounded-2xl` (16px)
- Buttons: `rounded-full` (pill shape)
- Inputs: `rounded-xl` (12px)
- Small elements: `rounded-lg` (8px)

### Shadows
Soft, colorful shadows add depth without feeling corporate:
- Cards: `shadow-card` (soft purple tint)
- Buttons (hover): `shadow-glow` (color-matched glow)
- Focus: `ring-2 ring-electric ring-offset-2`

## Components

### Buttons

**Primary Button**
```html
<button class="bg-gradient-to-r from-mango to-hotpink text-white font-display
               px-6 py-3 rounded-full shadow-card hover:shadow-glow
               hover:scale-105 transition-all duration-200">
  Find Food! 🍕
</button>
```

**Secondary Button**
```html
<button class="bg-latte text-cocoa font-display px-6 py-3 rounded-full
               border-2 border-mango hover:bg-mango hover:text-white
               transition-all duration-200">
  Browse Categories
</button>
```

**Ghost Button**
```html
<button class="text-electric font-display px-4 py-2 rounded-full
               hover:bg-electric/10 transition-all duration-200">
  Learn More →
</button>
```

### Cards

**Restaurant Card**
```html
<div class="bg-white rounded-2xl shadow-card p-5 hover:shadow-glow
            hover:-translate-y-1 transition-all duration-200 border-2 border-latte">
  <!-- Image with fun overlay -->
  <div class="relative rounded-xl overflow-hidden">
    <img src="..." class="w-full h-40 object-cover">
    <div class="absolute top-2 right-2 bg-sunny text-cocoa px-2 py-1
                rounded-full text-sm font-display flex items-center gap-1">
      ⭐ 4.5
    </div>
  </div>
  <!-- Content -->
  <h3 class="font-display text-xl text-cocoa mt-3">Pizza Paradise</h3>
  <p class="text-cocoa/70 text-sm mt-1">📍 123 Yummy Street</p>
  <!-- Tags -->
  <div class="flex flex-wrap gap-2 mt-3">
    <span class="bg-hotpink/20 text-hotpink px-3 py-1 rounded-full text-xs font-medium">
      🍕 Pizza
    </span>
  </div>
</div>
```

**Category Card**
```html
<a href="#" class="group block bg-gradient-to-br from-electric/20 to-hotpink/20
                   rounded-2xl p-6 hover:from-electric/30 hover:to-hotpink/30
                   transition-all duration-200 border-2 border-transparent
                   hover:border-electric">
  <span class="text-4xl">🍕</span>
  <h3 class="font-display text-lg text-cocoa mt-2 group-hover:text-electric
             transition-colors">Pizza</h3>
  <p class="text-cocoa/60 text-sm mt-1">12 spots</p>
</a>
```

### Form Elements

**Text Input**
```html
<input type="text" placeholder="What are you craving?"
       class="w-full px-5 py-3 rounded-xl border-2 border-latte bg-white
              focus:border-electric focus:ring-2 focus:ring-electric/20
              outline-none transition-all placeholder:text-cocoa/40
              font-body text-cocoa">
```

**Select Dropdown**
```html
<select class="w-full px-5 py-3 rounded-xl border-2 border-latte bg-white
               focus:border-electric focus:ring-2 focus:ring-electric/20
               outline-none transition-all font-body text-cocoa appearance-none
               bg-[url('data:image/svg+xml,...')] bg-no-repeat bg-right-4">
  <option>Pick a category...</option>
</select>
```

### Badges & Tags

**Rating Badge**
```html
<span class="inline-flex items-center gap-1 bg-sunny text-cocoa
             px-3 py-1 rounded-full text-sm font-display">
  ⭐ 4.5
</span>
```

**Source Badge**
```html
<span class="inline-flex items-center gap-1 bg-coral/20 text-coral
             px-2 py-0.5 rounded-full text-xs font-medium">
  Yelp
</span>
```

**Category Tag**
```html
<span class="inline-flex items-center bg-electric/15 text-electric
             px-3 py-1 rounded-full text-sm hover:bg-electric/25
             transition-colors cursor-pointer">
  🥗 Healthy
</span>
```

### Alerts & Messages

**Success Message**
```html
<div class="bg-mint/20 border-2 border-mint rounded-2xl p-4 flex items-start gap-3">
  <span class="text-2xl">🎉</span>
  <div>
    <h4 class="font-display text-cocoa">Woohoo!</h4>
    <p class="text-cocoa/70 text-sm">Found 42 delicious spots near you.</p>
  </div>
</div>
```

**Error Message**
```html
<div class="bg-coral/20 border-2 border-coral rounded-2xl p-4 flex items-start gap-3">
  <span class="text-2xl">😅</span>
  <div>
    <h4 class="font-display text-cocoa">Oops!</h4>
    <p class="text-cocoa/70 text-sm">Something went wrong. Try again?</p>
  </div>
</div>
```

**Empty State**
```html
<div class="text-center py-12">
  <span class="text-6xl">🔍</span>
  <h3 class="font-display text-xl text-cocoa mt-4">No grub found!</h3>
  <p class="text-cocoa/60 mt-2">Try searching for something else</p>
  <button class="mt-4 bg-gradient-to-r from-mango to-hotpink text-white
                 px-6 py-2 rounded-full font-display">
    Start Fresh
  </button>
</div>
```

### Loading States

**Spinner**
```html
<div class="flex flex-col items-center gap-4 py-12">
  <div class="w-12 h-12 border-4 border-latte border-t-electric rounded-full
              animate-spin"></div>
  <p class="font-display text-cocoa animate-pulse">Finding tasty spots...</p>
</div>
```

**Skeleton Card**
```html
<div class="bg-white rounded-2xl shadow-card p-5 animate-pulse">
  <div class="bg-latte rounded-xl h-40"></div>
  <div class="bg-latte rounded-lg h-6 w-3/4 mt-3"></div>
  <div class="bg-latte rounded-lg h-4 w-1/2 mt-2"></div>
</div>
```

## Icons & Emojis

Use emojis liberally to add personality! Here's our emoji vocabulary:

| Context | Emoji |
|---------|-------|
| Search | 🔍 |
| Location | 📍 |
| Rating/Stars | ⭐ |
| Success | 🎉 |
| Error | 😅 |
| Loading | 🍳 |
| Empty | 🍽️ |
| Pizza | 🍕 |
| Burger | 🍔 |
| Asian | 🍜 |
| Mexican | 🌮 |
| Coffee | ☕ |
| Dessert | 🧁 |
| Bar | 🍺 |
| Fine Dining | 🍷 |
| Healthy | 🥗 |
| Breakfast | 🥞 |

## Animations

### Hover Effects
- Cards: `hover:-translate-y-1 hover:shadow-glow`
- Buttons: `hover:scale-105`
- Links: `hover:text-electric`

### Transitions
All interactive elements use: `transition-all duration-200`

### Fun Animations (CSS)
```css
/* Wiggle on hover */
@keyframes wiggle {
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
}
.animate-wiggle:hover { animation: wiggle 0.3s ease-in-out; }

/* Float animation for decorative elements */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
.animate-float { animation: float 3s ease-in-out infinite; }

/* Pop in for new elements */
@keyframes pop-in {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.animate-pop-in { animation: pop-in 0.3s ease-out; }
```

## Page Layout

### Header
```html
<header class="bg-gradient-to-r from-electric via-hotpink to-mango p-1">
  <div class="bg-cream">
    <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
      <a href="/" class="font-display text-2xl text-cocoa flex items-center gap-2">
        ⭐ grub stars
      </a>
      <nav class="flex gap-4">
        <a href="/categories.html" class="text-cocoa/70 hover:text-electric
                                          transition-colors font-medium">
          Categories
        </a>
      </nav>
    </div>
  </div>
</header>
```

### Footer
```html
<footer class="bg-latte mt-12 py-8">
  <div class="max-w-4xl mx-auto px-4 text-center">
    <p class="font-display text-cocoa">
      Made with 🍕 by friends, for friends
    </p>
    <div class="flex justify-center gap-4 mt-4">
      <a href="/" class="text-cocoa/60 hover:text-electric text-sm">Search</a>
      <a href="/categories.html" class="text-cocoa/60 hover:text-electric text-sm">Categories</a>
      <a href="/index-location.html" class="text-cocoa/60 hover:text-electric text-sm">Add Area</a>
    </div>
  </div>
</footer>
```

## Tailwind Configuration

Add this to your `tailwind.config.js`:

```javascript
tailwind.config = {
  theme: {
    extend: {
      colors: {
        mango: '#FFB347',
        hotpink: '#FF6B9D',
        electric: '#A855F7',
        mint: '#6EE7B7',
        sunny: '#FDE047',
        coral: '#FB7185',
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
      },
      animation: {
        'wiggle': 'wiggle 0.3s ease-in-out',
        'float': 'float 3s ease-in-out infinite',
        'pop-in': 'pop-in 0.3s ease-out',
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
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
}
```

## Quick Reference

### Common Class Combos

**Gradient Background**
```
bg-gradient-to-r from-mango to-hotpink
bg-gradient-to-br from-electric/20 to-hotpink/20
```

**Card Base**
```
bg-white rounded-2xl shadow-card p-5 border-2 border-latte
hover:shadow-glow hover:-translate-y-1 transition-all duration-200
```

**Button Base**
```
font-display px-6 py-3 rounded-full transition-all duration-200 hover:scale-105
```

**Input Base**
```
w-full px-5 py-3 rounded-xl border-2 border-latte bg-white font-body text-cocoa
focus:border-electric focus:ring-2 focus:ring-electric/20 outline-none transition-all
```

**Link**
```
text-electric hover:text-hotpink transition-colors font-medium
```

---

Happy eating! 🍕⭐
