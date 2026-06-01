const fs = require('fs');
const sharp = require('sharp');

const iconBackgroundSvg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="#E33745"/>
</svg>`;

const iconOnlySvg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(512, 512) scale(2.8)">
    <path d="M 0 -80 C -40 -80, -70 -50, -70 -10 C -70 30, -10 90, 0 110 C 10 90, 70 30, 70 -10 C 70 -50, 40 -80, 0 -80 Z" fill="#FFFFFF" />
    <circle cx="0" cy="-15" r="45" fill="#E33745" />
    <g transform="translate(0, -15) scale(0.6)">
      <polygon points="0,-40 20,-20 -20,-20" fill="#FFFFFF" transform="translate(0, -5)" />
      <polygon points="0,40 20,20 -20,20" fill="#FFFFFF" transform="translate(0, 5)" />
      <polygon points="-40,0 -20,20 -20,-20" fill="#FFFFFF" transform="translate(-5, 0)" />
      <polygon points="40,0 20,20 20,-20" fill="#FFFFFF" transform="translate(5, 0)" />
    </g>
  </g>
</svg>`;

const splashSvg = `<svg width="2732" height="2732" xmlns="http://www.w3.org/2000/svg">
  <rect width="2732" height="2732" fill="#1b2b35"/>
  <g transform="translate(1366, 1366) scale(4)">
    <path d="M 0 -80 C -40 -80, -70 -50, -70 -10 C -70 30, -10 90, 0 110 C 10 90, 70 30, 70 -10 C 70 -50, 40 -80, 0 -80 Z" fill="#FFFFFF" />
    <circle cx="0" cy="-15" r="45" fill="#E33745" />
    <g transform="translate(0, -15) scale(0.6)">
      <polygon points="0,-40 20,-20 -20,-20" fill="#FFFFFF" transform="translate(0, -5)" />
      <polygon points="0,40 20,20 -20,20" fill="#FFFFFF" transform="translate(0, 5)" />
      <polygon points="-40,0 -20,20 -20,-20" fill="#FFFFFF" transform="translate(-5, 0)" />
      <polygon points="40,0 20,20 20,-20" fill="#FFFFFF" transform="translate(5, 0)" />
    </g>
  </g>
</svg>`;

async function run() {
  if (!fs.existsSync('assets')) {
    fs.mkdirSync('assets');
  }

  // Remove old icon.png if it's corrupted
  if (fs.existsSync('assets/icon.png')) {
    fs.unlinkSync('assets/icon.png');
  }

  try {
    await sharp(Buffer.from(iconBackgroundSvg))
      .png()
      .toFile('assets/icon-background.png');
    console.log('Generated icon-background.png');
    
    await sharp(Buffer.from(iconOnlySvg))
      .png()
      .toFile('assets/icon-only.png');
    console.log('Generated icon-only.png');

    await sharp(Buffer.from(splashSvg))
      .png()
      .toFile('assets/splash.png');
    console.log('Generated splash.png');
    
    // Create an icon.png just in case (combined)
    await sharp(Buffer.from(splashSvg))
      .resize(1024, 1024)
      .png()
      .toFile('assets/icon.png');
    console.log('Generated icon.png');
  } catch (err) {
    console.error('Error generating images', err);
  }
}

run();
