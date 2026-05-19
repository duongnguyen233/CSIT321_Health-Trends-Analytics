/**
 * Reference-capture only. NOT in the render path.
 *
 * Visits the live frontend (http://localhost:5173) and saves PNGs of the
 * pages we need to mirror in technical scenes 09-14. The PNGs are reference
 * material: scenes are rebuilt as HTML so motion still works.
 *
 * Run: node scripts/capture-ui-references.mjs
 */

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'screenshots');

const BASE = 'http://localhost:5173';

const FAKE_USER = {
  id: 'promo-capture',
  email: 'don@bayside.example',
  name: 'Avery Cole',
  facility: 'Bayside Aged Care',
};

const targets = [
  { name: '01-landing',          url: '/',                 auth: false },
  { name: '02-login',            url: '/login',            auth: false },
  { name: '03-upload-csv',       url: '/upload-csv',       auth: true  },
  { name: '04-qi-dashboard',     url: '/dashboard',        auth: true  },
  { name: '05-reports',          url: '/reports',          auth: false },
  { name: '06-benchmarking',     url: '/benchmarking',     auth: false },
  { name: '07-voice-dashboard',  url: '/voice/dashboard',  auth: true  },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  // Seed fake auth before any page load
  await ctx.addInitScript(({ token, user }) => {
    try {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    } catch {}
  }, { token: 'promo-capture-fake-token', user: FAKE_USER });

  for (const t of targets) {
    const page = await ctx.newPage();
    try {
      console.log(`[capture] ${t.name} <- ${t.url}`);
      await page.goto(`${BASE}${t.url}`, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.waitForTimeout(900);
      const out = join(OUT_DIR, `${t.name}.png`);
      await page.screenshot({ path: out, fullPage: false });
      console.log(`  -> ${out}`);

      // Full-page screenshot too, so we can see content below the fold
      const outFull = join(OUT_DIR, `${t.name}-full.png`);
      await page.screenshot({ path: outFull, fullPage: true });
    } catch (err) {
      console.warn(`  ! failed: ${err.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log(`\nDone. ${targets.length} pages captured to ${OUT_DIR}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
