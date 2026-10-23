// WhatsApp-sized preview images (sharp): < 200KB JPEG, ≤ 600px wide, SVG placeholders rasterized, fallback without sharp.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { derivePreview, setSharpLoader, PREVIEW } from '../server/ogImage.js';
import { placeholderFlyer } from '../server/importer/placeholder.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* not installed here */ }

describe('preview images with sharp', { skip: !sharp && 'sharp not installed' }, () => {
  let big;
  before(async () => {
    setSharpLoader(() => import('sharp').then(m => m.default));
    // a noisy 1110×1570 photo-like JPEG (~1MB) — like a big uploaded flyer
    const w = 1110, h = 1570, raw = Buffer.alloc(w * h * 3);
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761 >>> 0) % 251;
    const jpg = await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 95 }).withMetadata({ exif: { IFD0: { Copyright: 'x' } } }).toBuffer();
    assert.ok(jpg.length > 300 * 1024, `fixture is big (${jpg.length})`);
    big = `data:image/jpeg;base64,${jpg.toString('base64')}`;
  });
  test('big flyer → JPEG ≤ 600px wide (aspect kept), < 200KB, progressive, no metadata', async () => {
    const d = await derivePreview('event:big', big);
    assert.equal(d.type, 'image/jpeg');
    assert.equal(d.width, 600);
    assert.equal(d.height, Math.round(1570 * 600 / 1110));
    assert.ok(d.buf.length < PREVIEW.targetBytes, `${d.buf.length} bytes`);
    const meta = await sharp(d.buf).metadata();
    assert.equal(meta.format, 'jpeg');
    assert.equal(meta.isProgressive, true);
    assert.equal(meta.exif, undefined, 'metadata stripped');
  });
  test('cached: the same key + image returns the same buffer', async () => {
    const a = await derivePreview('event:big', big);
    const b = await derivePreview('event:big', big);
    assert.equal(a, b);
  });
  test('small images are not enlarged', async () => {
    const small = await sharp({ create: { width: 300, height: 400, channels: 3, background: '#8A5058' } }).png().toBuffer();
    const d = await derivePreview('event:small', `data:image/png;base64,${small.toString('base64')}`);
    assert.equal(d.width, 300);
    assert.equal(d.type, 'image/jpeg');
  });
  test('SVG placeholder flyer → JPEG WhatsApp can show', async () => {
    const d = await derivePreview('event:svg', placeholderFlyer({ title: 'סדנת שזירת חלות לנשים', kind: 'סדנה', dateLabel: 'יום חמישי, 12 בנובמבר · 19:00', city: 'מודיעין עילית' }));
    assert.equal(d.type, 'image/jpeg');
    assert.equal(d.width, 600); assert.equal(d.height, 750);
  });
  test('Hebrew renders with ONLY the bundled font (a server image without Hebrew fonts)', () => {
    // render the same Hebrew text in a child process: (a) only server/fonts, (b) no fonts at all → must differ
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-'));
    const only = path.join(tmp, 'only.conf'); const none = path.join(tmp, 'none.conf');
    fs.writeFileSync(only, `<?xml version="1.0"?><fontconfig><dir>${path.join(ROOT, 'server', 'fonts')}</dir><cachedir>${tmp}</cachedir></fontconfig>`);
    fs.writeFileSync(none, `<?xml version="1.0"?><fontconfig><dir>${tmp}/empty</dir><cachedir>${tmp}</cachedir></fontconfig>`);
    const script = `import('sharp').then(async ({default: s}) => { const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120"><rect width="400" height="120" fill="#fff"/><text x="200" y="80" font-size="56" text-anchor="middle" font-family="Simple CLM, sans-serif">שלום נשי</text></svg>'); const { data } = await s(svg).raw().toBuffer({ resolveWithObject: true }); process.stdout.write(require('crypto').createHash('sha1').update(data).digest('hex') + ' ' + data.filter(v => v < 128).length); })`;
    const run = (conf) => execFileSync(process.execPath, ['--input-type=commonjs', '-e', script], { cwd: ROOT, env: { ...process.env, FONTCONFIG_FILE: conf } }).toString().split(' ');
    const [hashOnly, darkOnly] = run(only);
    const [hashNone] = run(none);
    assert.ok(Number(darkOnly) > 500, 'text was drawn');
    assert.notEqual(hashOnly, hashNone, 'the bundled font is what draws the Hebrew glyphs');
  });
  after(() => setSharpLoader(() => import('sharp').then(m => m.default)));
});

describe('without sharp (or when it fails)', () => {
  test('derivePreview → null, so routes serve the stored bytes as before', async () => {
    setSharpLoader(() => Promise.reject(new Error('Cannot find package sharp')));
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(100)]);
    assert.equal(await derivePreview('event:x', `data:image/png;base64,${png.toString('base64')}`), null);
    setSharpLoader(() => import('sharp').then(m => m.default));
  });
  test('not an image / broken bytes → null', async () => {
    assert.equal(await derivePreview('k', 'data:text/plain;base64,aGVsbG8='), null);
    assert.equal(await derivePreview('k', 'data:image/jpeg;base64,AAAA'), null);
    assert.equal(await derivePreview('k', 'https://example.com/x.jpg'), null);
  });
});
