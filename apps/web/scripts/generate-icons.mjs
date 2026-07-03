/**
 * PWA icon generator (Task 8.1).
 *
 * Generates the PWA icon set for the web target using only Node built-ins (no
 * native image deps), so it is reproducible in any environment. Emits:
 *   - icon-192.png, icon-512.png          (standard / "any" purpose)
 *   - icon-maskable-512.png               ("maskable" purpose, full-bleed bg
 *                                          with the mark inside the safe zone)
 *   - apple-touch-icon-180.png            (iOS/iPadOS home-screen icon)
 *   - icon.svg                            (scalable "any" source)
 *
 * Design: hardware-synth aesthetic — absolute-black (#000000) background (so the
 * installed launch shows no color flash against the manifest background_color),
 * a cyan LCD-style rounded rectangle, and a darker inset "display" band.
 *
 * Run: `node scripts/generate-icons.mjs` from apps/web.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../public/icons');
mkdirSync(OUT_DIR, { recursive: true });

// ── Colors (RGBA) ────────────────────────────────────────────────────────────
const BLACK = [0, 0, 0, 255]; // #000000 absolute black
const CYAN = [6, 182, 212, 255]; // tailwind cyan-500 — the "glow" accent
const CYAN_DARK = [14, 116, 144, 255]; // cyan-700 — inset display band
const ORANGE = [249, 115, 22, 255]; // accent dot (active-tone color)

/** Build an RGBA pixel buffer for one square icon of the given size/purpose. */
function renderIcon(size, { maskable }) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b, a]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
  };

  // Background: absolute black, full-bleed (maskable safe-zone friendly).
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, BLACK);

  // Maskable icons must keep content inside the ~80% safe zone; standard icons
  // can use a larger footprint.
  const inset = maskable ? size * 0.2 : size * 0.14;
  const left = Math.round(inset);
  const top = Math.round(size * (maskable ? 0.32 : 0.3));
  const right = size - left;
  const bottom = size - Math.round(size * (maskable ? 0.32 : 0.3));
  const radius = Math.round((right - left) * 0.18);

  const inRoundedRect = (x, y, l, t, r, b, rad) => {
    if (x < l || x > r || y < t || y > b) return false;
    const nx = x < l + rad ? l + rad - x : x > r - rad ? x - (r - rad) : 0;
    const ny = y < t + rad ? t + rad - y : y > b - rad ? y - (b - rad) : 0;
    return nx * nx + ny * ny <= rad * rad;
  };

  // Outer cyan LCD plate.
  for (let y = top; y <= bottom; y++)
    for (let x = left; x <= right; x++)
      if (inRoundedRect(x, y, left, top, right, bottom, radius)) set(x, y, CYAN);

  // Inset darker "display" band.
  const pad = Math.round((right - left) * 0.12);
  const il = left + pad;
  const it = top + pad;
  const ir = right - pad;
  const ib = bottom - pad;
  const irad = Math.round(radius * 0.6);
  for (let y = it; y <= ib; y++)
    for (let x = il; x <= ir; x++)
      if (inRoundedRect(x, y, il, it, ir, ib, irad)) set(x, y, CYAN_DARK);

  // Active-tone accent dot (top-right of the display band).
  const dotR = Math.round((ir - il) * 0.07);
  const dcx = ir - Math.round((ir - il) * 0.16);
  const dcy = it + Math.round((ib - it) * 0.22);
  for (let y = dcy - dotR; y <= dcy + dotR; y++)
    for (let x = dcx - dotR; x <= dcx + dotR; x++) {
      const dx = x - dcx;
      const dy = y - dcy;
      if (dx * dx + dy * dy <= dotR * dotR) set(x, y, ORANGE);
    }

  return px;
}

/** Minimal but valid PNG encoder (8-bit RGBA, no filtering). */
function encodePng(size, rgba) {
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  };

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // remaining bytes (compression, filter, interlace) default 0

  // Raw scanlines, each prefixed with filter byte 0.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#000000"/>
  <rect x="72" y="154" width="368" height="204" rx="40" fill="#06b6d4"/>
  <rect x="116" y="198" width="280" height="116" rx="24" fill="#0e7490"/>
  <circle cx="356" cy="232" r="14" fill="#f97316"/>
</svg>
`;

const targets = [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon-180.png', size: 180, maskable: false },
];

for (const t of targets) {
  const rgba = renderIcon(t.size, { maskable: t.maskable });
  writeFileSync(resolve(OUT_DIR, t.name), encodePng(t.size, rgba));
  // eslint-disable-next-line no-console
  console.log(`wrote icons/${t.name} (${t.size}x${t.size})`);
}
writeFileSync(resolve(OUT_DIR, 'icon.svg'), SVG);
// eslint-disable-next-line no-console
console.log('wrote icons/icon.svg');
