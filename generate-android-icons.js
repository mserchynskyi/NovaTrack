import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// 1. Define beautiful vector SVG templates
const dValues = {
  // Orange grade & design -> Red for Nova Poshta
  defs: `
    <linearGradient id="redGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FF3333" />
      <stop offset="100%" stop-color="#CC0000" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <filter id="shadow">
      <feDropShadow dx="0" dy="10" stdDeviation="10" flood-opacity="0.3" />
    </filter>
  `,
  graphic: `
    <!-- Concentric radar circles for tracking look (subtle) -->
    <path d="M 50 450 Q 256 550, 460 300" fill="none" stroke="#CC0000" stroke-width="40" stroke-linecap="round" opacity="0.3" />
    
    <!-- 3D Box Base (Center) -->
    <g transform="translate(140, 260)" filter="url(#shadow)">
      <!-- Left Face -->
      <path d="M 120 70 L 120 180 L 10 140 L 10 30 Z" fill="#E5E7EB" />
      <!-- Right Face -->
      <path d="M 120 70 L 120 180 L 230 140 L 230 30 Z" fill="#D1D5DB" />
      <!-- Top Face -->
      <path d="M 120 -10 L 230 30 L 120 70 L 10 30 Z" fill="#F3F4F6" />
      
      <!-- Red Tape -->
      <path d="M 120 -10 L 140 -2 L 140 78 L 120 70 Z" fill="#FF3333" />
      <path d="M 120 -10 L 100 -2 L 100 78 L 120 70 Z" fill="#CC0000" />
      <path d="M 120 70 L 120 180 L 140 172 L 140 78 Z" fill="#CC0000" />
      
      <!-- Box Arrows Decoration (Nova Poshta style on right face) -->
      <g transform="translate(175, 100) scale(0.4)">
        <polygon points="0,-40 20,-20 -20,-20" fill="#CC0000" transform="translate(0, -10)" />
        <polygon points="0,40 20,20 -20,20" fill="#CC0000" transform="translate(0, 10)" />
        <polygon points="-40,0 -20,20 -20,-20" fill="#CC0000" transform="translate(-10, 0)" />
        <polygon points="40,0 20,20 20,-20" fill="#CC0000" transform="translate(10, 0)" />
      </g>
    </g>

    <!-- Map Pin with NP arrows -->
    <g transform="translate(260, 240) scale(1.2)" filter="url(#shadow)">
      <path d="M 0 -80 C -40 -80, -70 -50, -70 -10 C -70 30, -10 90, 0 110 C 10 90, 70 30, 70 -10 C 70 -50, 40 -80, 0 -80 Z" fill="#FFFFFF" />
      <circle cx="0" cy="-15" r="45" fill="#CC0000" />
      
      <!-- 4 Arrows inside red circle -->
      <g transform="translate(0, -15) scale(0.6)">
        <polygon points="0,-40 20,-20 -20,-20" fill="#FFFFFF" transform="translate(0, -5)" />
        <polygon points="0,40 20,20 -20,20" fill="#FFFFFF" transform="translate(0, 5)" />
        <polygon points="-40,0 -20,20 -20,-20" fill="#FFFFFF" transform="translate(-5, 0)" />
        <polygon points="40,0 20,20 20,-20" fill="#FFFFFF" transform="translate(5, 0)" />
      </g>
    </g>
  `
};

// Standard launcher background
const squareSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>\${dValues.defs}</defs>
  <rect width="512" height="512" rx="120" fill="#E60000"/>
  \${dValues.graphic}
</svg>
`;

// Circular launcher backup background
const roundSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>\${dValues.defs}</defs>
  <circle cx="256" cy="256" r="256" fill="#E60000"/>
  \${dValues.graphic}
</svg>
`;

// Adaptive Icon Foreground
const foregroundSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>\${dValues.defs}</defs>
  <g transform="scale(0.8) translate(51, 51)">
    \${dValues.graphic}
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

  // 2. Also set the adaptive background color to match the red theme inside ic_launcher_background.xml
  const backgroundXmlPath = path.join(basePath, 'values', 'ic_launcher_background.xml');
  const bgXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#E60000</color>
</resources>
`;
  fs.writeFileSync(backgroundXmlPath, bgXmlContent, 'utf8');
  console.log('Updated ic_launcher_background.xml to use red (#E60000) background.');

  console.log('Android Icon Generation Complete!');
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
