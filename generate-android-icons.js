import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// 1. Define beautiful vector SVG templates
const dValues = {
  // Orange grade & design
  defs: `
    <linearGradient id="orangeGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FF6B35" />
      <stop offset="100%" stop-color="#D72638" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  `,
  // Center tracking graphic content
  graphic: `
    <!-- Concentric radar circles for tracking look -->
    <circle cx="256" cy="256" r="210" fill="none" stroke="#374151" stroke-width="1.5" stroke-dasharray="6 6" opacity="0.6"/>
    <circle cx="256" cy="256" r="160" fill="none" stroke="#1F2937" stroke-width="1" opacity="0.4"/>
    
    <!-- Curved Route Track -->
    <path d="M 130 370 Q 210 170, 310 290 T 380 140" fill="none" stroke="url(#orangeGrad)" stroke-width="26" stroke-linecap="round" />
    <path d="M 130 370 Q 210 170, 310 290 T 380 140" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" opacity="0.4"/>
    
    <!-- Location Pin / GPS marker -->
    <g transform="translate(380, 140)">
      <circle cx="0" cy="0" r="16" fill="#FFFFFF" />
      <circle cx="0" cy="0" r="30" fill="none" stroke="#FF6B35" stroke-width="6" />
      <circle cx="0" cy="0" r="45" fill="none" stroke="#D72638" stroke-width="3" stroke-dasharray="4 4" opacity="0.8"/>
    </g>

    <!-- Cargo Box/Package origin -->
    <g transform="translate(130, 370)">
      <rect x="-35" y="-35" width="70" height="70" rx="16" fill="#1F2937" stroke="url(#orangeGrad)" stroke-width="8" />
      <!-- Inner detail (parcel box tape) -->
      <path d="M 0 -35 L 0 35 M -35 0 L 35 0" stroke="url(#orangeGrad)" stroke-width="4" opacity="0.6" />
    </g>
  `
};

// Standard launcher background
const squareSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>${dValues.defs}</defs>
  <!-- Sleek dark background -->
  <rect width="512" height="512" rx="100" fill="#111827"/>
  ${dValues.graphic}
</svg>
`;

// Circular launcher backup background (for devices that use default round launcher icon configurations)
const roundSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>${dValues.defs}</defs>
  <!-- Circular container -->
  <circle cx="256" cy="256" r="256" fill="#111827"/>
  ${dValues.graphic}
</svg>
`;

// Adaptive Icon Foreground (transparent background, slightly scaled down to fit within Android safe zone boundaries)
const foregroundSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>${dValues.defs}</defs>
  <g transform="scale(0.8) translate(51, 51)">
    ${dValues.graphic}
  </g>
</svg>
`;

// Destination configurations
const mipmaps = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 }
];

const basePath = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res');

async function generate() {
  console.log('Starting Android Icon Generation via Sharp...');
  
  // Make sure directories exist
  for (const mip of mipmaps) {
    const dirPath = path.join(basePath, mip.dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // A. Generate regular ic_launcher.png (Square with rounded corners)
    await sharp(Buffer.from(squareSVG))
      .resize(mip.size, mip.size)
      .png()
      .toFile(path.join(dirPath, 'ic_launcher.png'));
    
    // B. Generate ic_launcher_round.png (Circular)
    await sharp(Buffer.from(roundSVG))
      .resize(mip.size, mip.size)
      .png()
      .toFile(path.join(dirPath, 'ic_launcher_round.png'));

    // C. Generate adaptive ic_launcher_foreground.png (Transparent background + scaled vector)
    await sharp(Buffer.from(foregroundSVG))
      .resize(mip.size, mip.size)
      .png()
      .toFile(path.join(dirPath, 'ic_launcher_foreground.png'));

    console.log(`Successfully generated icons for ${mip.dir} (${mip.size}x${mip.size})`);
  }

  // 2. Also set the adaptive background color to match the dark theme `#111827` inside ic_launcher_background.xml
  const backgroundXmlPath = path.join(basePath, 'values', 'ic_launcher_background.xml');
  const bgXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#111827</color>
</resources>
`;
  fs.writeFileSync(backgroundXmlPath, bgXmlContent, 'utf8');
  console.log('Updated ic_launcher_background.xml to use dark gray (#111827) background.');

  console.log('Android Icon Generation Complete!');
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
