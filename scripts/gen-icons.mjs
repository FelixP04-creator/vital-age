#!/usr/bin/env node
/**
 * Generiert die PWA-Icons für VITAL AGE (PNG, nur Node-Stdlib).
 * Design: Obsidian-Hintergrund #0B0F12 + leuchtender Mint-Ring #00F0A8
 * mit Sensor-Punkt (Markensymbol der App).
 * Aufruf: node scripts/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')
mkdirSync(outDir, { recursive: true })

// --- Mini-PNG-Encoder (RGBA, 8-Bit) ---
let crcTable
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}
function encodePng(size, pixelFn) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc(size * (1 + size * 4))
  for (let y = 0; y < size; y++) {
    const rowOff = y * (1 + size * 4)
    raw[rowOff] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y)
      const p = rowOff + 1 + x * 4
      raw[p] = r
      raw[p + 1] = g
      raw[p + 2] = b
      raw[p + 3] = a
    }
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- Branding ---
const BG = [11, 15, 18] // #0B0F12
const RING = [0, 240, 168] // #00F0A8
const DOT = [119, 255, 0] // #70FF00

function makeIcon(size, { maskable = false, radiusFrac = 0.22 } = {}) {
  const c = size / 2
  const ringR = size * (maskable ? 0.27 : 0.33) // maskable: sicher in Safe Zone
  const ringW = size * 0.055
  const dotR = size * 0.055
  const dotY = c - ringR // Sensor-Punkt auf 12-Uhr-Position
  const corner = size * radiusFrac
  return encodePng(size, (x, y) => {
    // abgerundete Ecken (außer bei maskable)
    if (!maskable) {
      const dx = x < corner ? corner - x : x >= size - corner ? x - (size - 1 - corner) : 0
      const dy = y < corner ? corner - y : y >= size - corner ? y - (size - 1 - corner) : 0
      if (dx > 0 && dy > 0 && dx * dx + dy * dy > corner * corner) return [0, 0, 0, 0]
    }
    // Ring (mit weichem Glow-Rand)
    const d = Math.hypot(x - c, y - c)
    const dist = Math.abs(d - ringR)
    let [r, g, b] = BG
    let a = 255
    if (dist <= ringW / 2) {
      ;[r, g, b] = RING
    } else if (dist <= ringW) {
      const t = 1 - (dist - ringW / 2) / (ringW / 2)
      r = Math.round(BG[0] + (RING[0] - BG[0]) * t * 0.8)
      g = Math.round(BG[1] + (RING[1] - BG[1]) * t * 0.8)
      b = Math.round(BG[2] + (RING[2] - BG[2]) * t * 0.8)
    } else if (d < ringR - ringW / 2 - size * 0.02) {
      // dezentes Innenfeld
      r = Math.round(BG[0] + 4)
      g = Math.round(BG[1] + 6)
      b = Math.round(BG[2] + 7)
    }
    // Sensor-Punkt (Lime)
    const dd = Math.hypot(x - c, y - dotY)
    if (dd <= dotR) {
      ;[r, g, b] = DOT
      a = 255
    } else if (dd <= dotR * 1.8) {
      const t = 1 - (dd - dotR) / (dotR * 0.8)
      r = Math.round(r + (DOT[0] - r) * t * 0.35)
      g = Math.round(g + (DOT[1] - g) * t * 0.35)
      b = Math.round(b + (DOT[2] - b) * t * 0.35)
    }
    return [r, g, b, a]
  })
}

writeFileSync(join(outDir, 'icon-192.png'), makeIcon(192))
writeFileSync(join(outDir, 'icon-512.png'), makeIcon(512))
writeFileSync(join(outDir, 'icon-512-maskable.png'), makeIcon(512, { maskable: true, radiusFrac: 0 }))
console.log('Icons erzeugt in public/icons/')
