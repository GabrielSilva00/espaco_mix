// Gera os ícones de favicon/PWA/Apple a partir de public/logo-mark.png (logo
// reduzida "Espaço Mix"). Requer `sharp` (devDependency).
//
//   npm i -D sharp   # se ainda não instalado
//   node scripts/generate-icons.mjs
//
// Sobrescreve, em public/: favicon.ico, favicon-32x32.png,
// apple-touch-icon-180x180.png, pwa-192x192.png, pwa-512x512.png e
// maskable-icon-512x512.png.

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');
const SRC = join(PUBLIC, 'logo-mark.png');
const BG = { r: 10, g: 10, b: 10, alpha: 1 }; // #0a0a0a (identidade do app)

// Ícone simples: a logo redimensionada (contain) sobre fundo da marca.
async function icon(size, out, padRatio = 0) {
  const inner = Math.round(size * (1 - padRatio));
  const resized = await sharp(SRC)
    .resize(inner, inner, { fit: 'contain', background: BG })
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toFile(join(PUBLIC, out));
}

await icon(32, 'favicon-32x32.png');
await icon(32, 'favicon.ico'); // PNG dentro de .ico — aceito pelos navegadores atuais
await icon(180, 'apple-touch-icon-180x180.png');
await icon(192, 'pwa-192x192.png');
await icon(512, 'pwa-512x512.png');
// Maskable precisa de margem de segurança (~20%) para o recorte adaptativo.
await icon(512, 'maskable-icon-512x512.png', 0.2);

console.log('Ícones gerados em public/.');
