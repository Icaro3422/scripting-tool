/**
 * Genera iconos PWA mínimos (192x192 y 512x512) en public/.
 * Ejecutar: node scripts/generate-pwa-icons.js
 * Requiere: npm install sharp --save-dev (o bun add -d sharp)
 */
const fs = require("fs");
const path = require("path");

async function main() {
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    console.warn("sharp no instalado. Ejecuta: bun add -d sharp");
    console.warn("O añade manualmente icon-192.png e icon-512.png en public/");
    process.exit(0);
    return;
  }

  const publicDir = path.join(__dirname, "..", "public");
  const size = 192;
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#6366f1"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="80" fill="white">S</text>
    </svg>
  `;
  const buf192 = await sharp(Buffer.from(svg)).png().toBuffer();
  const svg512 = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" fill="#6366f1"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="220" fill="white">S</text></svg>`;
  const buf512 = await sharp(Buffer.from(svg512)).png().toBuffer();
  fs.writeFileSync(path.join(publicDir, "icon-192.png"), buf192);
  fs.writeFileSync(path.join(publicDir, "icon-512.png"), buf512);
  console.log("Iconos PWA generados: public/icon-192.png, public/icon-512.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
