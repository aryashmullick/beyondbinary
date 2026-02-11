/**
 * Quick icon generator - run with Node.js
 * node scripts/generate-icons.js
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function createPNG(width, height) {
  // Build RGBA pixel data
  const rawData = Buffer.alloc(height * (1 + width * 4));

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pixOffset = rowOffset + 1 + x * 4;

      // Gradient blue (#4A6FA5) to green (#7B9E6B)
      const t = (x + y) / (width + height);
      let r = Math.round(74 + (123 - 74) * t);
      let g = Math.round(111 + (158 - 111) * t);
      let b = Math.round(165 + (107 - 165) * t);
      let a = 255;

      // Rounded corners
      const cornerR = width * 0.2;
      const dx = Math.min(x, width - 1 - x);
      const dy = Math.min(y, height - 1 - y);
      if (dx < cornerR && dy < cornerR) {
        const dist = Math.sqrt((cornerR - dx) ** 2 + (cornerR - dy) ** 2);
        if (dist > cornerR) {
          a = 0;
          r = 0;
          g = 0;
          b = 0;
        }
      }

      rawData[pixOffset] = r;
      rawData[pixOffset + 1] = g;
      rawData[pixOffset + 2] = b;
      rawData[pixOffset + 3] = a;
    }
  }

  // Build PNG file
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function makeChunk(type, data) {
    const typeBuffer = Buffer.from(type);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const combined = Buffer.concat([typeBuffer, data]);
    const crc = Buffer.alloc(4);
    crc.writeInt32BE(crc32(combined));
    return Buffer.concat([length, combined, crc]);
  }

  function crc32(buf) {
    let crc = ~0;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return ~crc;
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const compressed = zlib.deflateSync(rawData);

  return Buffer.concat([
    signature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

const iconsDir = path.join(__dirname, "..", "extension", "public", "icons");
fs.mkdirSync(iconsDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const png = createPNG(size, size);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  console.log(`Created icon${size}.png`);
}

console.log("Done!");
