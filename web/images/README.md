# grub stars - Images

This directory contains visual assets for the grub stars web application.

## Files

- **favicon.svg** - SVG favicon (star with fork and spoon)
- **og-image.svg** - Open Graph/unfurl image (1200x630px) for social media sharing

## Browser Compatibility

The SVG favicon works in all modern browsers (Chrome, Firefox, Safari, Edge). For maximum compatibility with older browsers and some social platforms, you may want to generate PNG versions.

## Generating PNG Versions (Optional)

If you need PNG versions for better compatibility:

### Using Node.js (svg2png or sharp)

```bash
npm install -g svg2png-cli
svg2png favicon.svg -o favicon.png -w 32 -h 32
svg2png og-image.svg -o og-image.png -w 1200 -h 630
```

### Using ImageMagick

```bash
convert -background none -resize 32x32 favicon.svg favicon.png
convert -background none -resize 1200x630 og-image.svg og-image.png
```

### Using Inkscape

```bash
inkscape favicon.svg --export-filename=favicon.png --export-width=32 --export-height=32
inkscape og-image.svg --export-filename=og-image.png --export-width=1200 --export-height=630
```

### Using rsvg-convert

```bash
rsvg-convert -w 32 -h 32 favicon.svg > favicon.png
rsvg-convert -w 1200 -h 630 og-image.svg > og-image.png
```

### Online Tools

You can also use online converters like:
- https://cloudconvert.com/svg-to-png
- https://svgtopng.com/

## Open Graph Image Notes

- Standard size is 1200x630px (aspect ratio 1.91:1)
- Works on iMessage, Facebook, Twitter, LinkedIn, Slack, etc.
- SVG should work for most modern platforms
- PNG/JPEG recommended for maximum compatibility

## Favicon Notes

- Modern browsers support SVG favicons
- Fallback to PNG is specified in HTML: `<link rel="icon" type="image/png" href="/images/favicon.png">`
- If favicon.png is missing, SVG will be used
- Recommended sizes for PNG: 32x32 (standard), 16x16 (small), 192x192 (Android), 180x180 (iOS)

## Theme Colors

The images use the grub stars color palette:
- **Mango/Orange**: `#FF6B35`, `#FFB830`, `#F7931E` (gradient for star)
- **Cocoa**: `#8B4513` (outlines and text)
- **Cream**: `#FFF8E7`, `#FFE4C4` (background gradient)
