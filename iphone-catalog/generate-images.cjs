const fs = require('fs');
const path = require('path');

const models = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'src', 'data', 'models.json'), 'utf8')
);

const outDir = path.join(__dirname, 'public', 'images');
fs.mkdirSync(outDir, { recursive: true });

const tierColors = {
  'SE': '#636366',
  'Standard': '#007AFF',
  'Mini': '#5856D6',
  'Plus': '#FF9500',
  'Air': '#AF52DE',
  'Pro': '#FF2D55',
  'Pro Max': '#C8102E',
};

function getEra(year, tier, id) {
  if (tier === 'SE' && year <= 2022) return 'homeButton';
  if (id === 'iphone-8' || id === 'iphone-8-plus') return 'homeButton';
  if (year >= 2022) return 'dynamicIsland';
  if (year >= 2017) return 'notch';
  return 'homeButton';
}

function getFrameMaterial(materials, era) {
  if (!materials) return era === 'homeButton' ? 'Aluminum' : era === 'notch' ? 'Stainless Steel' : 'Titanium';
  return materials;
}

function getFrameGradient(material) {
  const m = material.toLowerCase();
  if (m.includes('titanium')) {
    return `
    <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#c4bfb6"/>
      <stop offset="30%" stop-color="#d4cfc6"/>
      <stop offset="70%" stop-color="#b8b3aa"/>
      <stop offset="100%" stop-color="#a8a39a"/>
    </linearGradient>`;
  }
  if (m.includes('stainless')) {
    return `
    <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#d4d4d8"/>
      <stop offset="30%" stop-color="#e4e4e8"/>
      <stop offset="70%" stop-color="#c4c4c8"/>
      <stop offset="100%" stop-color="#b4b4b8"/>
    </linearGradient>`;
  }
  return `
    <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#c0c0c4"/>
      <stop offset="30%" stop-color="#d0d0d4"/>
      <stop offset="70%" stop-color="#b0b0b4"/>
      <stop offset="100%" stop-color="#a0a0a4"/>
    </linearGradient>`;
}

function getFrameColor(material) {
  const m = material.toLowerCase();
  if (m.includes('titanium')) return '#b0a99e';
  if (m.includes('stainless')) return '#a4a4a8';
  return '#9a9aa0';
}

function getFrameHighlight(material) {
  const m = material.toLowerCase();
  if (m.includes('titanium')) return '#e0dbd2';
  if (m.includes('stainless')) return '#f0f0f4';
  return '#e8e8ec';
}

function getFrameButtonColor(material) {
  const m = material.toLowerCase();
  if (m.includes('titanium')) return '#b0a99e';
  if (m.includes('stainless')) return '#b4b4b8';
  return '#a0a0a4';
}

function getPhoneDimensions(displayInches, era) {
  const scale = displayInches / 6.1;
  if (era === 'dynamicIsland') {
    return {
      x: 280, y: 60, w: 240, h: 520,
      rx: 32, screenRx: 24,
      screenX: 288, screenY: 68, screenW: 224, screenH: 504,
      screenClipX: 296, screenClipY: 92, screenClipW: 208, screenClipH: 456,
      buttonY1: 140, buttonY2: 180, buttonY3: 232,
      sideButtonY: 180, sideButtonH: 52,
    };
  }
  if (era === 'notch') {
    return {
      x: 280, y: 60, w: 240, h: 520,
      rx: 28, screenRx: 20,
      screenX: 288, screenY: 68, screenW: 224, screenH: 504,
      screenClipX: 296, screenClipY: 92, screenClipW: 208, screenClipH: 456,
      buttonY1: 140, buttonY2: 180, buttonY3: 232,
      sideButtonY: 180, sideButtonH: 52,
    };
  }
  return {
    x: 284, y: 68, w: 232, h: 500,
    rx: 24, screenRx: 2,
    screenX: 292, screenY: 112, screenW: 216, screenH: 360,
    screenClipX: 302, screenClipY: 112, screenClipW: 196, screenClipH: 360,
    buttonY1: 138, buttonY2: 178, buttonY3: 226,
    sideButtonY: 178, sideButtonH: 48,
  };
}

function getScreenGradient(era) {
  if (era === 'dynamicIsland') {
    return `
    <linearGradient id="screenBg" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#16213e"/>
    </linearGradient>
    <linearGradient id="screenContent" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="#0f3460"/>
      <stop offset="50%" stop-color="#16213e"/>
      <stop offset="100%" stop-color="#1a1a2e"/>
    </linearGradient>`;
  }
  if (era === 'notch') {
    return `
    <linearGradient id="screenBg" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#16213e"/>
    </linearGradient>
    <linearGradient id="screenContent" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="#2d1b69"/>
      <stop offset="40%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#0f0f1a"/>
    </linearGradient>`;
  }
  return `
    <linearGradient id="screenBg" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#16213e"/>
    </linearGradient>
    <linearGradient id="screenContent" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="#1a2332"/>
      <stop offset="100%" stop-color="#0d1b2a"/>
    </linearGradient>`;
}

function generateDynamicIsland(dim, accentColor, model, tierColor) {
  return `
      <!-- Dynamic Island -->
      <rect x="${dim.screenClipX + 74}" y="${dim.screenClipY + 4}" width="60" height="18" rx="9" fill="#000"/>

      <!-- Model name -->
      <text x="${dim.screenClipX + dim.screenClipW / 2}" y="${dim.screenClipY + 108}" text-anchor="middle" font-family="-apple-system,Helvetica,sans-serif" font-size="20" font-weight="700" fill="#fff" letter-spacing="-0.5">iPhone ${model.generationYear === 2025 ? model.displayName.replace('iPhone ', '') : model.displayName.replace('iPhone ', '').split(' ')[0]}</text>
      ${model.tier !== 'Standard' ? `<text x="${dim.screenClipX + dim.screenClipW / 2}" y="${dim.screenClipY + 132}" text-anchor="middle" font-family="-apple-system,Helvetica,sans-serif" font-size="28" font-weight="800" fill="#fff" letter-spacing="-1">${model.displayName.replace('iPhone ', '').split(' ').slice(1).join(' ')}</text>` : ''}

      <!-- Accent line -->
      <rect x="${dim.screenClipX + 60}" y="${dim.screenClipY + 150}" width="80" height="2" rx="1" fill="${accentColor}" opacity="0.7"/>

      <!-- Camera icon -->
      <g transform="translate(${dim.screenClipX + 70}, ${dim.screenClipY + 198})" opacity="0.5">
        <circle cx="20" cy="16" r="10" fill="none" stroke="#fff" stroke-width="1.5"/>
        <circle cx="20" cy="16" r="4" fill="${accentColor}"/>
      </g>

      <!-- Feature chips -->
      <g transform="translate(${dim.screenClipX + 14}, ${dim.screenClipY + 248})">
        <rect x="0" y="0" width="180" height="28" rx="14" fill="${accentColor}" opacity="0.2"/>
        <text x="90" y="18" text-anchor="middle" font-family="-apple-system,sans-serif" font-size="10" font-weight="600" fill="${accentColor}">${model.chip?.name?.replace('Apple ', '') || 'A'} · ${model.camera?.system?.split(' ')[0] || ''}</text>
      </g>
      <g transform="translate(${dim.screenClipX + 14}, ${dim.screenClipY + 284})">
        <rect x="0" y="0" width="180" height="28" rx="14" fill="${accentColor}" opacity="0.15"/>
        <text x="90" y="18" text-anchor="middle" font-family="-apple-system,sans-serif" font-size="10" font-weight="600" fill="${accentColor}">${model.displayInches}" ${model.displayType}</text>
      </g>

      <!-- Bottom specs -->
      <text x="${dim.screenClipX + dim.screenClipW / 2}" y="${dim.screenClipY + dim.screenClipH - 50}" text-anchor="middle" font-family="-apple-system,sans-serif" font-size="9" fill="#fff" opacity="0.4">${model.displayInches}" · ${model.materials || ''} · ${model.camera?.system?.split(' ')[1] || ''}</text>

      <!-- Home indicator -->
      <rect x="${dim.screenClipX + 74}" y="${dim.screenClipY + dim.screenClipH - 30}" width="60" height="3" rx="1.5" fill="#fff" opacity="0.3"/>`;
}

function generateNotch(dim, accentColor, model, tierColor) {
  return `
      <!-- Notch -->
      <rect x="${dim.screenClipX + 60}" y="${dim.screenClipY}" width="88" height="22" rx="11" fill="#000"/>
      <circle cx="${dim.screenClipX + 94}" cy="${dim.screenClipY + 11}" r="3.5" fill="#1a1a2e" stroke="#2a2a3e" stroke-width="0.5"/>
      <circle cx="${dim.screenClipX + 114}" cy="${dim.screenClipY + 11}" r="2" fill="#1a1a2e"/>

      <!-- Model name -->
      <text x="${dim.screenClipX + dim.screenClipW / 2}" y="${dim.screenClipY + 88}" text-anchor="middle" font-family="-apple-system,Helvetica,sans-serif" font-size="32" font-weight="800" fill="#fff" letter-spacing="-1">iPhone</text>
      <text x="${dim.screenClipX + dim.screenClipW / 2}" y="${dim.screenClipY + 128}" text-anchor="middle" font-family="-apple-system,Helvetica,sans-serif" font-size="42" font-weight="900" fill="#fff" letter-spacing="-1.5">${model.displayName.replace('iPhone ', '').split(' ').slice(1).join(' ')}</text>

      <!-- Accent ring -->
      <circle cx="${dim.screenClipX + dim.screenClipW / 2}" cy="${dim.screenClipY + 178}" r="20" fill="none" stroke="${accentColor}" stroke-width="2" opacity="0.6"/>

      <!-- Face ID icon -->
      <g transform="translate(${dim.screenClipX + dim.screenClipW / 2 - 12}, ${dim.screenClipY + 166})" opacity="0.7">
        <rect x="0" y="0" width="24" height="24" rx="6" fill="none" stroke="#fff" stroke-width="1.5"/>
        <circle cx="12" cy="10" r="3" fill="none" stroke="#fff" stroke-width="1"/>
        <path d="M6 18 Q12 14 18 18" fill="none" stroke="#fff" stroke-width="1"/>
      </g>

      <!-- Feature chips -->
      <g transform="translate(${dim.screenClipX + 14}, ${dim.screenClipY + 228})">
        <rect x="0" y="0" width="180" height="28" rx="14" fill="${accentColor}" opacity="0.2"/>
        <text x="90" y="18" text-anchor="middle" font-family="-apple-system,sans-serif" font-size="10" font-weight="600" fill="${accentColor}">Face ID · ${model.displayType} · ${model.chip?.name?.replace('Apple ', '') || 'A'}</text>
      </g>

      <!-- Bottom specs -->
      <text x="${dim.screenClipX + dim.screenClipW / 2}" y="${dim.screenClipY + dim.screenClipH - 50}" text-anchor="middle" font-family="-apple-system,sans-serif" font-size="9" fill="#fff" opacity="0.4">${model.displayInches}" · ${model.materials || ''} · ${model.camera?.system?.split(' ')[1] || ''}</text>

      <!-- Home indicator -->
      <rect x="${dim.screenClipX + 74}" y="${dim.screenClipY + dim.screenClipH - 30}" width="60" height="3" rx="1.5" fill="#fff" opacity="0.3"/>`;
}

function generateHomeButton(dim, accentColor, model, tierColor) {
  const bezelH = 36;
  return `
      <!-- Top bezel (thick, with speaker and camera) -->
      <rect x="${dim.screenX}" y="${dim.y + 8}" width="${dim.screenW}" height="${bezelH}" rx="0" fill="#1a1a1a"/>
      <!-- Speaker grille -->
      <rect x="${dim.screenX + dim.screenW / 2 - 22}" y="${dim.y + 20}" width="44" height="3" rx="1.5" fill="#333"/>
      <!-- Front camera -->
      <circle cx="${dim.screenX + dim.screenW - 30}" cy="${dim.y + 25}" r="4" fill="#222" stroke="#333" stroke-width="0.5"/>
      <circle cx="${dim.screenX + dim.screenW - 30}" cy="${dim.y + 25}" r="2" fill="#1a1a2e"/>

      <!-- Model name -->
      <text x="${dim.screenClipX + dim.screenClipW / 2}" y="${dim.screenClipY + 98}" text-anchor="middle" font-family="-apple-system,Helvetica,sans-serif" font-size="22" font-weight="700" fill="#fff" letter-spacing="-0.5">iPhone</text>
      <text x="${dim.screenClipX + dim.screenClipW / 2}" y="${dim.screenClipY + 133}" text-anchor="middle" font-family="-apple-system,Helvetica,sans-serif" font-size="36" font-weight="800" fill="#fff" letter-spacing="-1">${model.displayName.replace('iPhone ', '').split(' ').slice(1).join(' ')}</text>

      <!-- Accent -->
      <rect x="${dim.screenClipX + 50}" y="${dim.screenClipY + 148}" width="96" height="2" rx="1" fill="${accentColor}"/>

      <!-- Feature chips -->
      <g transform="translate(${dim.screenClipX + 16}, ${dim.screenClipY + 178})">
        <rect x="0" y="0" width="164" height="28" rx="14" fill="${accentColor}" opacity="0.2"/>
        <text x="82" y="18" text-anchor="middle" font-family="-apple-system,sans-serif" font-size="10" font-weight="600" fill="${accentColor}">${model.chip?.name?.replace('Apple ', '') || 'A'} · ${model.camera?.system?.split(' ')[0] || ''}</text>
      </g>
      <g transform="translate(${dim.screenClipX + 16}, ${dim.screenClipY + 214})">
        <rect x="0" y="0" width="164" height="28" rx="14" fill="${accentColor}" opacity="0.15"/>
        <text x="82" y="18" text-anchor="middle" font-family="-apple-system,sans-serif" font-size="10" font-weight="600" fill="${accentColor}">${model.displayInches}" ${model.displayType}</text>
      </g>

      <!-- Bottom specs -->
      <text x="${dim.screenClipX + dim.screenClipW / 2}" y="${dim.screenClipY + dim.screenClipH - 40}" text-anchor="middle" font-family="-apple-system,sans-serif" font-size="9" fill="#fff" opacity="0.4">${model.displayInches}" · ${model.materials || ''} · ${model.camera?.system?.split(' ')[1] || ''}</text>

      <!-- Bottom bezel with Home button -->
      <rect x="${dim.screenX}" y="${dim.screenY + dim.screenH}" width="${dim.screenW}" height="96" rx="0" fill="#1a1a1a"/>
      <!-- Home button ring -->
      <circle cx="${dim.screenX + dim.screenW / 2}" cy="${dim.screenY + dim.screenH + 48}" r="16" fill="none" stroke="#555" stroke-width="1.5"/>
      <!-- Home button -->
      <circle cx="${dim.screenX + dim.screenW / 2}" cy="${dim.screenY + dim.screenH + 48}" r="12" fill="#222" stroke="#333" stroke-width="0.5"/>`;
}

function generateSVG(model) {
  const era = getEra(model.generationYear, model.tier, model.id);
  const material = getFrameMaterial(model.materials, era);
  const frameColor = getFrameColor(material);
  const frameHighlight = getFrameHighlight(material);
  const buttonColor = getFrameButtonColor(material);
  const tierColor = tierColors[model.tier] || '#888';
  const primaryColor = model.colors[0]?.hex || '#888';
  const dim = getPhoneDimensions(model.displayInches, era);

  const bgGradient = `
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f0f0f5"/>
      <stop offset="100%" stop-color="#e8e8ed"/>
    </linearGradient>`;
  const frameGradient = getFrameGradient(material);
  const screenGradient = getScreenGradient(era);

  const screenContent = era === 'dynamicIsland'
    ? generateDynamicIsland(dim, tierColor, model, tierColor)
    : era === 'notch'
      ? generateNotch(dim, tierColor, model, tierColor)
      : generateHomeButton(dim, tierColor, model, tierColor);

  const screenClipY = era === 'homeButton' ? dim.screenClipY : dim.screenClipY;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    ${bgGradient}
    ${frameGradient}
    ${screenGradient}
    <filter id="shadow" x="-20%" y="-10%" width="140%" height="130%">
      <feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="#000" flood-opacity="0.18"/>
    </filter>
    <clipPath id="screenClip">
      <rect x="${dim.screenClipX}" y="${dim.screenClipY}" width="${dim.screenClipW}" height="${dim.screenClipH}" rx="${era === 'homeButton' ? 2 : 4}"/>
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="800" height="800" fill="url(#bg)"/>

  <!-- Subtle grid pattern -->
  <g opacity="0.04">
    <line x1="0" y1="200" x2="800" y2="200" stroke="#000" stroke-width="0.5"/>
    <line x1="0" y1="400" x2="800" y2="400" stroke="#000" stroke-width="0.5"/>
    <line x1="0" y1="600" x2="800" y2="600" stroke="#000" stroke-width="0.5"/>
    <line x1="200" y1="0" x2="200" y2="800" stroke="#000" stroke-width="0.5"/>
    <line x1="400" y1="0" x2="400" y2="800" stroke="#000" stroke-width="0.5"/>
    <line x1="600" y1="0" x2="600" y2="800" stroke="#000" stroke-width="0.5"/>
  </g>

  <!-- Phone body group with shadow -->
  <g filter="url(#shadow)">
    <!-- Frame -->
    <rect x="${dim.x}" y="${dim.y}" width="${dim.w}" height="${dim.h}" rx="${dim.rx}" fill="url(#frame)" stroke="${frameColor}" stroke-width="1"/>

    <!-- Frame highlights (left edge) -->
    <rect x="${dim.x}" y="${dim.y + 20}" width="2" height="${dim.h - 40}" rx="1" fill="${frameHighlight}" opacity="0.5"/>

    <!-- Side buttons -->
    <rect x="${dim.x - 4}" y="${dim.buttonY1}" width="4" height="28" rx="2" fill="${buttonColor}"/>
    <rect x="${dim.x - 4}" y="${dim.buttonY2}" width="4" height="40" rx="2" fill="${buttonColor}"/>
    <rect x="${dim.x - 4}" y="${dim.buttonY3}" width="4" height="40" rx="2" fill="${buttonColor}"/>
    <rect x="${dim.x + dim.w}" y="${dim.sideButtonY}" width="4" height="${dim.sideButtonH}" rx="2" fill="${buttonColor}"/>

    <!-- Screen -->
    <rect x="${dim.screenX}" y="${dim.screenY}" width="${dim.screenW}" height="${dim.screenH}" rx="${dim.screenRx}" fill="url(#screenBg)"/>

    <!-- Screen content -->
    <g clip-path="url(#screenClip)">
      <rect x="${dim.screenClipX}" y="${dim.screenClipY}" width="${dim.screenClipW}" height="${dim.screenClipH}" fill="url(#screenContent)"/>

      <!-- Status bar -->
      <text x="${dim.screenClipX + 14}" y="${dim.screenClipY + 18}" font-family="-apple-system,sans-serif" font-size="9" fill="#fff" opacity="0.7">9:41</text>

      ${screenContent}
    </g>

    <!-- Screen edge reflections -->
    <rect x="${dim.screenX}" y="${dim.screenY}" width="${dim.screenW}" height="${dim.screenH}" rx="${dim.screenRx}" fill="none" stroke="#ffffff" stroke-width="0.5" opacity="0.2"/>
  </g>

  <!-- Tier badge -->
  <rect x="340" y="620" width="120" height="32" rx="16" fill="${tierColor}"/>
  <text x="400" y="641" text-anchor="middle" font-family="-apple-system,sans-serif" font-size="13" font-weight="700" fill="#fff">${model.tier}</text>

  <!-- Model label -->
  <text x="400" y="680" text-anchor="middle" font-family="-apple-system,Helvetica,sans-serif" font-size="22" font-weight="700" fill="#1a1a1a">${model.displayName}</text>
  <text x="400" y="705" text-anchor="middle" font-family="-apple-system,sans-serif" font-size="13" fill="#888">${model.generationYear} · From $${model.variants[0]?.launchPriceUSD?.toLocaleString() || 'N/A'}</text>

  <!-- Reflection line on frame -->
  <line x1="${dim.screenClipX - 4}" y1="${dim.y + 20}" x2="${dim.screenClipX - 4}" y2="${dim.y + dim.h - 20}" stroke="#fff" stroke-width="1" opacity="0.15"/>
</svg>`;
}

let count = 0;
for (const model of models) {
  const svg = generateSVG(model);
  const svgFilename = `${model.id}-hero.svg`;
  fs.writeFileSync(path.join(outDir, svgFilename), svg);
  count++;
  console.log(`Generated: ${svgFilename} (${model.displayName} - ${getEra(model.generationYear, model.tier, model.id)})`);
}

console.log(`\nGenerated ${count} era-accurate phone renders in public/images/`);
