// make-icons.js — Run with Node.js to generate icons: node make-icons.js
// No external dependencies needed

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Generate a minimal PNG with a purple gradient circle icon
function createPNG(size) {
  // Create pixel data (RGBA)
  const pixels = new Uint8Array(size * size * 4);
  const cx = size / 2, cy = size / 2, r = size * 0.46;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= r) {
        // Purple gradient fill
        const t = dist / r;
        const red   = Math.round(123 + (91 - 123) * t);   // 7B → 5B
        const green = Math.round(92  + (47 - 92) * t);    // 5C → 2F
        const blue  = Math.round(255 + (255 - 255) * t);  // FF → FF
        pixels[idx]     = red;
        pixels[idx + 1] = green;
        pixels[idx + 2] = blue;
        pixels[idx + 3] = 255;
      } else {
        // Transparent outside circle
        pixels[idx + 3] = 0;
      }

      // Draw lightning bolt shape (simplified ⚡)
      const nx = (x - cx) / r, ny = (y - cy) / r;
      if (Math.abs(nx) < 0.12 && ny > -0.45 && ny < 0.45) {
        pixels[idx] = 234; pixels[idx+1] = 240; pixels[idx+2] = 255; pixels[idx+3] = 220;
      }
      if (nx > -0.3 && nx < 0.3 && ny > -0.2 && ny < 0.2) {
        const inBolt = (nx < 0 && ny < 0) || (nx > 0 && ny > 0);
        if (inBolt) {
          pixels[idx] = 234; pixels[idx+1] = 240; pixels[idx+2] = 255; pixels[idx+3] = 200;
        }
      }
    }
  }

  return encodePNG(size, size, pixels);
}

function encodePNG(width, height, pixels) {
  // PNG signature
  const sig = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);

  // IHDR chunk
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw image data (filter byte 0 before each row)
  const raw = Buffer.allocUnsafe(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = y * (1 + width * 4) + 1 + x * 4;
      raw[di]     = pixels[si];
      raw[di + 1] = pixels[si + 1];
      raw[di + 2] = pixels[si + 2];
      raw[di + 3] = pixels[si + 3];
    }
  }

  const compressed = zlib.deflateSync(raw);

  function chunk(type, data) {
    const buf = Buffer.allocUnsafe(12 + data.length);
    buf.writeUInt32BE(data.length, 0);
    buf.write(type, 4, 'ascii');
    data.copy(buf, 8);
    const crc = crc32(Buffer.concat([Buffer.from(type, 'ascii'), data]));
    buf.writeInt32BE(crc, 8 + data.length);
    return buf;
  }

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) | 0;
}

const dir = __dirname;
[16, 48, 128].forEach(size => {
  const png = createPNG(size);
  const out = path.join(dir, `icon${size}.png`);
  fs.writeFileSync(out, png);
  console.log(`Created ${out} (${png.length} bytes)`);
});
console.log('Done!');
