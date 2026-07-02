// Generates the iOS app icon and launch-splash images from the Fave Day
// crescent-moon brand mark (same design as public/favicon.svg, but square).
// Run: node scripts/generate-ios-assets.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// size = canvas px, moonScale = crescent size relative to canvas
function crescentSVG(size, moonScale) {
  const c = size / 2;
  const moonR = size * moonScale;
  // Cutout circle offset creates the crescent (same geometry as favicon.svg)
  const moonCx = c - size * 0.04;
  const cutCx = moonCx + moonR * 0.385;
  const cutCy = c - moonR * 0.19;
  const cutR = moonR * 0.865;
  const star = (x, y, r, o) =>
    `<circle cx="${x * size}" cy="${y * size}" r="${r * size}" fill="#e2d4f7" opacity="${o}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="75%">
      <stop offset="0%" stop-color="#1a0a2e"/>
      <stop offset="100%" stop-color="#0d0618"/>
    </radialGradient>
    <radialGradient id="cut" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#150826"/>
      <stop offset="100%" stop-color="#0e061a"/>
    </radialGradient>
    <radialGradient id="moonGlow" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#c8a8f0"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  ${star(0.20, 0.22, 0.010, 0.8)}
  ${star(0.75, 0.18, 0.008, 0.6)}
  ${star(0.82, 0.68, 0.009, 0.7)}
  ${star(0.15, 0.70, 0.007, 0.5)}
  ${star(0.68, 0.85, 0.008, 0.6)}
  ${star(0.30, 0.82, 0.006, 0.5)}
  ${star(0.88, 0.38, 0.008, 0.7)}
  ${star(0.10, 0.42, 0.007, 0.6)}
  ${star(0.55, 0.10, 0.007, 0.6)}
  <circle cx="${moonCx}" cy="${c}" r="${moonR}" fill="url(#moonGlow)"/>
  <circle cx="${cutCx}" cy="${cutCy}" r="${cutR}" fill="url(#cut)"/>
  <circle cx="${moonCx}" cy="${c}" r="${moonR}" fill="none" stroke="#a78bfa" stroke-width="${size * 0.004}" opacity="0.3"/>
</svg>`;
}

async function render(svg, outPath) {
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log("wrote", path.relative(root, outPath));
}

const iconDir = path.join(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset");
const splashDir = path.join(root, "ios/App/App/Assets.xcassets/Splash.imageset");

// App icon: 1024x1024, big crescent (iOS masks the rounded corners itself)
await render(crescentSVG(1024, 0.30), path.join(iconDir, "AppIcon-512@2x.png"));

// Splash: 2732x2732, smaller crescent so it looks right at any crop
const splash = crescentSVG(2732, 0.14);
for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
  await render(splash, path.join(splashDir, name));
}
