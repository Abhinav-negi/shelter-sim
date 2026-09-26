// apps/studio/e2e/png.mjs — minimal PNG decoder + bounding-box measurement,
// used by flow.mjs to compare the viewer canvas's rendered extent before and
// after a design change (Q1.md condition 1: "the viewer bounding box
// grows"). No new dependency: only `node:zlib` (stdlib) for the DEFLATE
// data — the PNG container/filter logic is ~60 lines, hand-rolled.
//
// ponytail: supports only what Chromium/Playwright's `element.screenshot()`
// actually emits — 8-bit, non-interlaced, colour type 2 (RGB) or 6 (RGBA).
// No palette/16-bit/interlace support; add if a future screenshot source
// needs it (none does today).
import { inflateSync } from 'node:zlib';

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Decodes a PNG buffer into `{width, height, data}`, `data` a flat RGBA
 *  Uint8Array (RGB is expanded to RGBA with alpha=255). */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG (bad signature)');
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idatChunks = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
      const interlace = data.readUInt8(12);
      if (bitDepth !== 8) throw new Error(`unsupported PNG bit depth ${bitDepth}`);
      if (colorType !== 2 && colorType !== 6) throw new Error(`unsupported PNG colour type ${colorType}`);
      if (interlace !== 0) throw new Error('interlaced PNG unsupported');
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 8 + len + 4; // length + type + data + crc
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idatChunks));
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);
  let prevRow = new Uint8Array(stride);
  let rawOffset = 0;
  for (let y = 0; y < height; y++) {
    const filterType = raw[rawOffset++];
    const row = raw.subarray(rawOffset, rawOffset + stride);
    rawOffset += stride;
    const outRow = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? outRow[x - channels] : 0;
      const b = prevRow[x];
      const c = x >= channels ? prevRow[x - channels] : 0;
      let v = row[x];
      switch (filterType) {
        case 0:
          break;
        case 1:
          v = (v + a) & 0xff;
          break;
        case 2:
          v = (v + b) & 0xff;
          break;
        case 3:
          v = (v + Math.floor((a + b) / 2)) & 0xff;
          break;
        case 4:
          v = (v + paeth(a, b, c)) & 0xff;
          break;
        default:
          throw new Error(`unsupported PNG filter type ${filterType}`);
      }
      outRow[x] = v;
    }
    for (let px = 0; px < width; px++) {
      const si = px * channels;
      const di = (y * width + px) * 4;
      out[di] = outRow[si];
      out[di + 1] = outRow[si + 1];
      out[di + 2] = outRow[si + 2];
      out[di + 3] = channels === 4 ? outRow[si + 3] : 255;
    }
    prevRow = outRow;
  }
  return { width, height, data: out };
}

/** Bounding box (inclusive px extents) of "detail" pixels -- local gradient
 *  magnitude (|dGray/dx| + |dGray/dy|) above `threshold` -- or `null` if
 *  nothing exceeds it.
 *
 *  Tried first (and rejected): a single reference background colour (the
 *  canvas's own corner pixel) diffed against every pixel. ShelterViewer's
 *  background is not flat -- `<fog>`/the ground plane produce a continuous
 *  soft gradient across the *entire* canvas (confirmed empirically: dumping
 *  a real canvas screenshot showed a smooth top-left-to-bottom-right
 *  brightness ramp with no hard ground/sky edge) -- so a single-colour diff
 *  saturates to "the whole canvas differs" regardless of the building's
 *  size, which is useless for this measurement. Edge/gradient detection
 *  instead isolates actual geometry (building faces, edges, the compass,
 *  the sun dash) from that smooth backdrop, since the backdrop's own local
 *  gradient step is tiny compared to a real silhouette edge. Verified
 *  against two real canvas screenshots (footprint width 3 m vs 20 m, same
 *  design otherwise): bbox area grew ~29% here vs. 0% with the flat-colour
 *  approach (which saturated to the same full-frame box both times). */
export function edgeBBox({ width, height, data }, threshold = 18) {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx = gray[i + 1] - gray[i - 1];
      const gy = gray[i + width] - gray[i - width];
      const mag = Math.abs(gx) + Math.abs(gy);
      if (mag > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
