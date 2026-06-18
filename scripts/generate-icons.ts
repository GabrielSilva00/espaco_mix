/**
 * Gera os ícones do PWA a partir de public/logo-full.png.
 *
 * A logo-full.png (1254x1254, fundo preto, texto completo "RECEPÇÕES & EVENTOS")
 * é redimensionada e centralizada sobre um canvas quadrado preto. Os ícones
 * "maskable" recebem MAIS margem para que a logo caiba na safe zone (círculo
 * central de 80%) e não seja cortada pela máscara arredondada/circular do SO.
 *
 * Uso: npx tsx scripts/generate-icons.ts
 */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(__dirname, '..', 'public');
const SOURCE = path.join(PUBLIC, 'logo-full.png');

// Preto puro — igual ao fundo da logo-full.png, para não criar uma "emenda"
// visível entre a logo e a margem do canvas.
const BG = { r: 0, g: 0, b: 0, alpha: 1 }; // #000000

type IconSpec = {
  file: string;
  size: number;
  /** fração do canvas ocupada pela logo (o resto é preenchido de preto) */
  ratio: number;
};

const ICONS: IconSpec[] = [
  // purpose: any — não sofre máscara, pode ocupar mais espaço
  { file: 'pwa-192x192.png', size: 192, ratio: 0.88 },
  { file: 'pwa-512x512.png', size: 512, ratio: 0.88 },
  // purpose: maskable — precisa caber na safe zone (~80%); logo menor
  { file: 'maskable-icon-512x512.png', size: 512, ratio: 0.66 },
  // iOS arredonda os cantos; margem evita corte
  { file: 'apple-touch-icon-180x180.png', size: 180, ratio: 0.8 },
];

async function generate({ file, size, ratio }: IconSpec) {
  const inner = Math.round(size * ratio);
  const logo = await sharp(SOURCE)
    .resize(inner, inner, { fit: 'contain', background: BG })
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(path.join(PUBLIC, file));

  console.log(`✓ ${file} (${size}x${size}, logo ${inner}px)`);
}

async function main() {
  for (const spec of ICONS) {
    await generate(spec);
  }
  console.log('Ícones gerados com sucesso.');
}

main().catch((err) => {
  console.error('Falha ao gerar ícones:', err);
  process.exit(1);
});
