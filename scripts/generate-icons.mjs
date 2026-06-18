// Gera os logos (fundo preto removido + margem aparada) e os ícones de
// favicon/PWA/Apple a partir das logos de origem em public/. Requer `sharp` e
// `sharp-ico` (devDependencies).
//
//   node scripts/generate-icons.mjs
//
// Fontes (mantidas no repo):
//   public/logo-mark.png  → logo RETANGULAR ("espaço MIX", sem círculo)
//   public/logo-full.png  → logo REDONDA (com o anel/círculo)
//
// Saídas em public/:
//   logo-rect.png                  → retangular, transparente e APARADA (menu/sidebar aberta/header mobile)
//   logo-round.png                 → redonda, transparente e aparada (sidebar recolhida)
//   favicon.ico (16/32/48), favicon-32x32.png → redonda transparente (ícone do site)
//   apple-touch-icon-180x180.png, pwa-192x192.png, pwa-512x512.png,
//   maskable-icon-512x512.png      → redonda, FUNDO PRETO, preenchendo todo o ícone (app)

import sharp from 'sharp';
import sharpIco from 'sharp-ico';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');
const SRC_RECT = join(PUBLIC, 'logo-mark.png');   // retangular
const SRC_ROUND = join(PUBLIC, 'logo-full.png');  // redonda
const BLACK = { r: 0, g: 0, b: 0 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// Remove o fundo preto: alpha proporcional à luminância (preto → transparente,
// branco/amarelo da logo → opaco), com borda suave entre os limiares.
async function makeTransparentBuffer(srcPath) {
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info; // 4
  const T0 = 22, T1 = 64;
  for (let i = 0; i < data.length; i += channels) {
    const lum = Math.max(data[i], data[i + 1], data[i + 2]);
    data[i + 3] = lum <= T0 ? 0 : lum >= T1 ? 255 : Math.round(((lum - T0) / (T1 - T0)) * 255);
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

const roundTransparent = await makeTransparentBuffer(SRC_ROUND);
const rectTransparent = await makeTransparentBuffer(SRC_RECT);

// Apara a moldura transparente para a logo PREENCHER seu espaço na UI (sem isso
// a logo fica pequena no meio de uma área transparente grande).
const rectTight = await sharp(rectTransparent).trim({ threshold: 10 }).png().toBuffer();
const roundTight = await sharp(roundTransparent).trim({ threshold: 10 }).png().toBuffer();
await sharp(rectTight).toFile(join(PUBLIC, 'logo-rect.png'));
await sharp(roundTight).toFile(join(PUBLIC, 'logo-round.png'));

// Favicon (ícone do site): redonda, transparente, contida no quadrado.
async function faviconPng(size) {
  return sharp(roundTight).resize(size, size, { fit: 'contain', background: TRANSPARENT }).png().toBuffer();
}
const fav16 = await faviconPng(16);
const fav32 = await faviconPng(32);
const fav48 = await faviconPng(48);
await sharp(fav32).toFile(join(PUBLIC, 'favicon-32x32.png'));
// .ico REAL (multi-resolução) — o PNG-renomeado anterior não era confiável.
await sharpIco.sharpsToIco([sharp(fav16), sharp(fav32), sharp(fav48)], join(PUBLIC, 'favicon.ico'));

// Ícone do app (PWA/Apple/mobile): redonda, FUNDO PRETO, preenchendo todo o
// espaço. Apara a borda preta e redimensiona com cover para tocar as bordas.
const roundTrimmed = await sharp(SRC_ROUND).trim({ threshold: 12 }).toBuffer();
async function appIcon(size, out) {
  return sharp(roundTrimmed)
    .resize(size, size, { fit: 'cover', position: 'center' })
    .flatten({ background: BLACK })
    .png()
    .toFile(join(PUBLIC, out));
}
await appIcon(180, 'apple-touch-icon-180x180.png');
await appIcon(192, 'pwa-192x192.png');
await appIcon(512, 'pwa-512x512.png');
await appIcon(512, 'maskable-icon-512x512.png');

console.log('Logos e ícones gerados em public/.');
