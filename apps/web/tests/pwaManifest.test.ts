/**
 * Task 8.1 / 8.2 — installability + offline-precache verification.
 *
 * Validates the production PWA artifacts emitted by the build:
 *  - the web app manifest declares name, short_name, start_url, standalone
 *    display, theme/background color (absolute black, no launch flash), and a
 *    complete maskable + high-resolution icon set; and
 *  - the generated service worker precaches the full app shell — HTML, JS, CSS,
 *    the Orbitron font, and every icon size — so an offline cold launch renders
 *    with no network, with an SPA navigation fallback to index.html.
 *
 * The build is run once (if the artifacts are absent) so the test is
 * self-contained. Building from source guarantees the assertions track the real
 * vite-plugin-pwa configuration rather than a hand-copied snapshot.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WEB_ROOT = resolve(__dirname, '..');
const DIST = resolve(WEB_ROOT, 'dist');
const MANIFEST = resolve(DIST, 'manifest.webmanifest');
const SW = resolve(DIST, 'sw.js');

beforeAll(() => {
  if (!existsSync(MANIFEST) || !existsSync(SW)) {
    execSync('npm run build', { cwd: WEB_ROOT, stdio: 'inherit' });
  }
}, 180_000);

describe('PWA web app manifest', () => {
  it('declares the required installability fields and synth-aesthetic colors', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8'));
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    // Absolute black background avoids a color flash on launch (Req 6.5).
    expect(manifest.background_color).toBe('#000000');
    expect(manifest.theme_color).toBe('#000000');
  });

  it('includes a maskable icon plus high-resolution (>=512) icons', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8'));
    const icons: Array<{ sizes: string; purpose?: string; type: string }> =
      manifest.icons;
    expect(icons.length).toBeGreaterThanOrEqual(3);

    const hasMaskable = icons.some((i) => (i.purpose ?? '').includes('maskable'));
    expect(hasMaskable).toBe(true);

    const has192 = icons.some((i) => i.sizes.includes('192'));
    const has512 = icons.some((i) => i.sizes.includes('512'));
    expect(has192).toBe(true);
    expect(has512).toBe(true);
  });
});

describe('Offline-shell service worker precache', () => {
  it('precaches the full shell: HTML, JS, CSS, font, and every icon', () => {
    const sw = readFileSync(SW, 'utf-8');
    // Workbox inlines the precache manifest as revisioned entries in the SW.
    expect(sw).toContain('index.html');
    expect(sw).toContain('fonts/Orbitron.ttf');
    expect(sw).toContain('icons/icon-192.png');
    expect(sw).toContain('icons/icon-512.png');
    expect(sw).toContain('icons/icon-maskable-512.png');
    expect(sw).toMatch(/assets\/index-[^"']+\.js/);
    expect(sw).toMatch(/assets\/index-[^"']+\.css/);
  });

  it('serves an SPA navigation fallback to the cached index document', () => {
    const sw = readFileSync(SW, 'utf-8');
    // NavigationRoute bound to index.html: the minified bundle registers a route
    // whose matcher rejects non-`navigate` requests (the NavigationRoute guard)
    // and binds the handler to the precached index document.
    expect(sw).toContain('index.html');
    expect(sw).toContain('"navigate"');
  });
});
