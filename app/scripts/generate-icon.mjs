import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, '../build/icon.png');

const SIZE = 512;
const rgba = Buffer.alloc(SIZE * SIZE * 4);

function blendPixel(x, y, r, g, b, a) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE || a <= 0) return;
  const idx = (y * SIZE + x) * 4;
  const srcA = a / 255;
  const dstA = rgba[idx + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;
  rgba[idx] = Math.round((r * srcA + rgba[idx] * dstA * (1 - srcA)) / outA);
  rgba[idx + 1] = Math.round((g * srcA + rgba[idx + 1] * dstA * (1 - srcA)) / outA);
  rgba[idx + 2] = Math.round((b * srcA + rgba[idx + 2] * dstA * (1 - srcA)) / outA);
  rgba[idx + 3] = Math.round(outA * 255);
}

function sdfRoundedRect(px, py, cx, cy, hw, hh, rad) {
  const qx = Math.abs(px - cx) - hw + rad;
  const qy = Math.abs(py - cy) - hh + rad;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - rad;
}

function sdfCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

function sdfEllipse(px, py, cx, cy, rx, ry) {
  const dx = (px - cx) / rx;
  const dy = (py - cy) / ry;
  const k0 = Math.hypot(dx, dy);
  if (k0 === 0) return -Math.min(rx, ry);
  const k1 = Math.hypot(dx / rx, dy / ry);
  return (k0 * (k0 - 1)) / k1;
}

function sdfSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * h, pay - bay * h);
}

function sdfTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const e0x = bx - ax, e0y = by - ay;
  const e1x = cx - bx, e1y = cy - by;
  const e2x = ax - cx, e2y = ay - cy;
  const v0x = px - ax, v0y = py - ay;
  const v1x = px - bx, v1y = py - by;
  const v2x = px - cx, v2y = py - cy;
  const c0 = Math.max(0, Math.min(1, (v0x * e0x + v0y * e0y) / (e0x * e0x + e0y * e0y)));
  const c1 = Math.max(0, Math.min(1, (v1x * e1x + v1y * e1y) / (e1x * e1x + e1y * e1y)));
  const c2 = Math.max(0, Math.min(1, (v2x * e2x + v2y * e2y) / (e2x * e2x + e2y * e2y)));
  const pq0x = v0x - e0x * c0, pq0y = v0y - e0y * c0;
  const pq1x = v1x - e1x * c1, pq1y = v1y - e1y * c1;
  const pq2x = v2x - e2x * c2, pq2y = v2y - e2y * c2;
  const s = Math.sign(e0x * e2y - e0y * e2x);
  const d0x = pq0x * pq0x + pq0y * pq0y;
  const d0y = s * (v0x * e0y - v0y * e0x);
  const d1x = pq1x * pq1x + pq1y * pq1y;
  const d1y = s * (v1x * e1y - v1y * e1x);
  const d2x = pq2x * pq2x + pq2y * pq2y;
  const d2y = s * (v2x * e2y - v2y * e2x);
  const minDistSq = Math.min(d0x, d1x, d2x);
  const minSign = Math.min(d0y, d1y, d2y);
  return -Math.sqrt(minDistSq) * Math.sign(minSign);
}

function cov(d) {
  return Math.max(0, Math.min(1, 0.5 - d));
}

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    // macOS Squircle background
    const bgD = sdfRoundedRect(x, y, 256, 256, 218, 218, 96);
    const bgCov = cov(bgD);
    if (bgCov > 0) {
      const t = y / SIZE;
      const r = Math.round(18 + (32 - 18) * t);
      const g = Math.round(24 + (44 - 24) * t);
      const b = Math.round(46 + (82 - 46) * t);
      blendPixel(x, y, r, g, b, Math.round(bgCov * 255));

      const glowDist = Math.hypot(x - 256, y - 270);
      if (glowDist < 200) {
        const gAlpha = Math.pow(1 - glowDist / 200, 2) * 0.45 * bgCov;
        blendPixel(x, y, 125, 211, 252, Math.round(gAlpha * 255));
      }
    }

    // Cat Ears (rounded triangles)
    const leftEar = cov(sdfTriangle(x, y, 126, 232, 118, 96, 224, 168) - 10);
    const rightEar = cov(sdfTriangle(x, y, 386, 232, 288, 168, 394, 96) - 10);
    if (leftEar > 0) blendPixel(x, y, 125, 211, 252, Math.round(leftEar * 255));
    if (rightEar > 0) blendPixel(x, y, 125, 211, 252, Math.round(rightEar * 255));

    // Pink Inner Ears
    const leftInner = cov(sdfTriangle(x, y, 140, 212, 136, 126, 204, 174) - 4);
    const rightInner = cov(sdfTriangle(x, y, 372, 212, 308, 174, 376, 126) - 4);
    if (leftInner > 0) blendPixel(x, y, 253, 164, 175, Math.round(leftInner * 255));
    if (rightInner > 0) blendPixel(x, y, 253, 164, 175, Math.round(rightInner * 255));

    // Round Cat Head
    const headCov = cov(sdfEllipse(x, y, 256, 276, 152, 126));
    if (headCov > 0) {
      const ht = Math.max(0, Math.min(1, (y - 150) / 252));
      const r = Math.round(145 + (56 - 145) * ht);
      const g = Math.round(220 + (189 - 220) * ht);
      const b = Math.round(254 + (248 - 254) * ht);
      blendPixel(x, y, r, g, b, Math.round(headCov * 255));
    }

    // Tabby forehead stripes
    const s1 = cov(sdfRoundedRect(x, y, 256, 174, 8, 20, 7));
    const s2 = cov(sdfRoundedRect(x, y, 226, 180, 6.5, 16, 6));
    const s3 = cov(sdfRoundedRect(x, y, 286, 180, 6.5, 16, 6));
    if (s1 > 0) blendPixel(x, y, 14, 165, 233, Math.round(s1 * 180));
    if (s2 > 0) blendPixel(x, y, 14, 165, 233, Math.round(s2 * 160));
    if (s3 > 0) blendPixel(x, y, 14, 165, 233, Math.round(s3 * 160));

    // Cream Muzzle
    const muzzleCov = cov(sdfEllipse(x, y, 256, 322, 66, 44));
    if (muzzleCov > 0) blendPixel(x, y, 240, 249, 255, Math.round(muzzleCov * 235));

    // Rosy Cheeks
    const lc = cov(sdfEllipse(x, y, 166, 314, 22, 12));
    const rc = cov(sdfEllipse(x, y, 346, 314, 22, 12));
    if (lc > 0) blendPixel(x, y, 251, 113, 133, Math.round(lc * 155));
    if (rc > 0) blendPixel(x, y, 251, 113, 133, Math.round(rc * 155));

    // Glossy Cat Eyes
    const le = cov(sdfEllipse(x, y, 198, 276, 22, 26));
    const re = cov(sdfEllipse(x, y, 314, 276, 22, 26));
    if (le > 0) blendPixel(x, y, 30, 41, 59, Math.round(le * 255));
    if (re > 0) blendPixel(x, y, 30, 41, 59, Math.round(re * 255));

    // Eye Sparkles
    const lh = cov(sdfCircle(x, y, 190, 266, 8.5));
    const rh = cov(sdfCircle(x, y, 306, 266, 8.5));
    if (lh > 0) blendPixel(x, y, 255, 255, 255, Math.round(lh * 255));
    if (rh > 0) blendPixel(x, y, 255, 255, 255, Math.round(rh * 255));

    // Pink Nose
    const nose = cov(sdfTriangle(x, y, 244, 304, 268, 304, 256, 318) - 2);
    if (nose > 0) blendPixel(x, y, 251, 113, 133, Math.round(nose * 255));

    // Cute :3 Cat Smile (two little arcs)
    const smL = Math.abs(Math.hypot(x - 240, y - 322) - 16) - 4;
    const smR = Math.abs(Math.hypot(x - 272, y - 322) - 16) - 4;
    if (y > 322 && x >= 222 && x <= 258) {
      const c = cov(smL);
      if (c > 0) blendPixel(x, y, 30, 41, 59, Math.round(c * 255));
    }
    if (y > 322 && x >= 254 && x <= 290) {
      const c = cov(smR);
      if (c > 0) blendPixel(x, y, 30, 41, 59, Math.round(c * 255));
    }

    // Whiskers
    const w1 = cov(sdfSegment(x, y, 86, 290, 140, 298) - 4);
    const w2 = cov(sdfSegment(x, y, 88, 320, 140, 318) - 4);
    const w3 = cov(sdfSegment(x, y, 426, 290, 372, 298) - 4);
    const w4 = cov(sdfSegment(x, y, 424, 320, 372, 318) - 4);
    const wCov = Math.max(w1, w2, w3, w4);
    if (wCov > 0) blendPixel(x, y, 51, 65, 85, Math.round(wCov * 170));
  }
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

const rawRows = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (SIZE * 4 + 1);
  rawRows[rowStart] = 0;
  rgba.copy(rawRows, rowStart + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  makeChunk('IHDR', ihdr),
  makeChunk('IDAT', zlib.deflateSync(rawRows)),
  makeChunk('IEND', Buffer.alloc(0)),
]);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, png);
console.log(`Generated macOS cat app icon: ${outPath} (${SIZE}x${SIZE})`);
