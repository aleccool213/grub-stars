#!/usr/bin/env node
// Generate PNG icon variants from the SVG favicon for PWA support
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const imagesDir = join(__dirname, '..', 'web', 'images');
const svgBuffer = readFileSync(join(imagesDir, 'favicon.svg'));

const icons = [
  { name: 'favicon.png', size: 32 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

// Maskable icon: needs safe zone padding (icon centered in 80% of canvas)
async function generateMaskable(svgBuffer, outputPath, size) {
  const iconSize = Math.round(size * 0.7);
  const padding = Math.round((size - iconSize) / 2);

  const icon = await sharp(svgBuffer)
    .resize(iconSize, iconSize)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 248, b: 231, alpha: 1 } // #FFF8E7 cream
    }
  })
    .composite([{ input: icon, left: padding, top: padding }])
    .png()
    .toFile(outputPath);
}

for (const { name, size } of icons) {
  const outputPath = join(imagesDir, name);
  await sharp(svgBuffer).resize(size, size).png().toFile(outputPath);
  console.log(`Generated ${name} (${size}x${size})`);
}

await generateMaskable(svgBuffer, join(imagesDir, 'icon-maskable-512.png'), 512);
console.log('Generated icon-maskable-512.png (512x512 maskable)');

console.log('Done! All PWA icons generated.');
