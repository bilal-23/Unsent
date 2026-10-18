// Generates the PWA icons as PNGs with no dependencies (run: npm run icons).
// Motif: a folded letter on a calm sage background.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [0x3d, 0x6a, 0x5a]
const PAPER = [0xf6, 0xf4, 0xf0]
const LINE = [0x3d, 0x6a, 0x5a]

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const S = 4 // supersampling for anti-aliasing
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const [pr, pg, pb, pa] = pixel((x + (sx + 0.5) / S) / size, (y + (sy + 0.5) / S) / size)
          r += pr * pa; g += pg * pa; b += pb * pa; a += pa
        }
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = a ? Math.round(r / a) : 0
      raw[o + 1] = a ? Math.round(g / a) : 0
      raw[o + 2] = a ? Math.round(b / a) : 0
      raw[o + 3] = Math.round((a / (S * S)) * 255)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const inRoundedRect = (u, v, x0, y0, x1, y1, r) => {
  if (u < x0 || u > x1 || v < y0 || v > y1) return false
  const cx = Math.min(Math.max(u, x0 + r), x1 - r)
  const cy = Math.min(Math.max(v, y0 + r), y1 - r)
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r
}
const distToSegment = (u, v, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(u - (ax + t * dx), v - (ay + t * dy))
}

/** scale: size of the letter relative to the canvas (smaller for maskable safe zone). */
function letterIcon({ rounded, scale }) {
  return (u, v) => {
    if (rounded && !inRoundedRect(u, v, 0, 0, 1, 1, 0.22)) return [0, 0, 0, 0]
    const w = 0.62 * scale, h = 0.44 * scale
    const x0 = 0.5 - w / 2, y0 = 0.52 - h / 2, x1 = 0.5 + w / 2, y1 = 0.52 + h / 2
    if (inRoundedRect(u, v, x0, y0, x1, y1, 0.035 * scale)) {
      const stroke = 0.022 * scale
      const flap = Math.min(distToSegment(u, v, x0 + 0.02, y0 + 0.02, 0.5, y0 + h * 0.58), distToSegment(u, v, x1 - 0.02, y0 + 0.02, 0.5, y0 + h * 0.58))
      return flap < stroke ? [...LINE, 1] : [...PAPER, 1]
    }
    return [...BG, 1]
  }
}

function ringIcon(u, v) {
  if (!inRoundedRect(u, v, 0, 0, 1, 1, 0.22)) return [0, 0, 0, 0]
  const d = Math.hypot(u - 0.5, v - 0.5)
  if (Math.abs(d - 0.24) < 0.035 || d < 0.08) return [...PAPER, 1]
  return [...BG, 1]
}

const out = (name, data) => writeFileSync(new URL(`../public/${name}`, import.meta.url), data)
out('icon-192.png', png(192, letterIcon({ rounded: true, scale: 1 })))
out('icon-512.png', png(512, letterIcon({ rounded: true, scale: 1 })))
out('icon-maskable-512.png', png(512, letterIcon({ rounded: false, scale: 0.8 })))
out('apple-touch-icon.png', png(180, letterIcon({ rounded: false, scale: 0.9 })))
out('shortcut-write-96.png', png(96, letterIcon({ rounded: true, scale: 1 })))
out('shortcut-urge-96.png', png(96, ringIcon))
console.log('Icons written to public/')
