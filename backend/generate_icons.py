"""
Generate PNG icons from SVG for the Chrome extension.
Run: python generate_icons.py
Requires: pip install cairosvg (or Pillow for simple generation)
"""

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Pillow not found. Generating simple icons...")

import struct
import zlib
import os


def create_png(width: int, height: int, filename: str):
    """Create a simple gradient PNG icon with 'W' letter."""
    
    pixels = []
    for y in range(height):
        row = []
        for x in range(width):
            # Gradient from blue (#4A6FA5) to green (#7B9E6B)
            t = (x + y) / (width + height)
            r = int(74 + (123 - 74) * t)
            g = int(111 + (158 - 111) * t)
            b = int(165 + (107 - 165) * t)
            
            # Round corners
            corner_radius = width * 0.18
            dx = min(x, width - 1 - x)
            dy = min(y, height - 1 - y)
            if dx < corner_radius and dy < corner_radius:
                dist = ((corner_radius - dx) ** 2 + (corner_radius - dy) ** 2) ** 0.5
                if dist > corner_radius:
                    r, g, b = 0, 0, 0
                    a = 0
                    row.append((r, g, b, a))
                    continue
            
            # Simple W shape in center
            cx, cy = width / 2, height / 2
            a = 255
            
            # Check if we're in the "W" area (simplified)
            rel_x = (x - cx) / (width * 0.35)
            rel_y = (y - cy) / (height * 0.3)
            
            in_w = False
            if -1 < rel_x < 1 and -0.5 < rel_y < 0.8:
                # W shape approximation
                if abs(rel_x) > 0.85 and rel_y > -0.3:
                    in_w = True
                elif abs(rel_x - 0.45) < 0.12 and rel_y > 0:
                    in_w = True
                elif abs(rel_x + 0.45) < 0.12 and rel_y > 0:
                    in_w = True
                elif abs(rel_x) < 0.12 and rel_y > 0.3:
                    in_w = True
                elif -0.9 < rel_x < -0.6 and abs(rel_y - (rel_x + 0.75) * 2) < 0.15:
                    in_w = True
                elif 0.6 < rel_x < 0.9 and abs(rel_y - (-rel_x + 0.75) * 2) < 0.15:
                    in_w = True
            
            if in_w:
                r, g, b = 255, 255, 255
            
            row.append((r, g, b, a))
        pixels.append(row)
    
    # Write PNG manually
    def write_png(filename, width, height, pixels):
        def make_chunk(chunk_type, data):
            chunk = chunk_type + data
            return struct.pack('>I', len(data)) + chunk + struct.pack('>I', zlib.crc32(chunk) & 0xFFFFFFFF)
        
        header = b'\x89PNG\r\n\x1a\n'
        ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA
        
        raw_data = b''
        for row in pixels:
            raw_data += b'\x00'  # filter type: none
            for r, g, b, a in row:
                raw_data += struct.pack('BBBB', r, g, b, a)
        
        compressed = zlib.compress(raw_data)
        
        with open(filename, 'wb') as f:
            f.write(header)
            f.write(make_chunk(b'IHDR', ihdr))
            f.write(make_chunk(b'IDAT', compressed))
            f.write(make_chunk(b'IEND', b''))
    
    write_png(filename, width, height, pixels)
    print(f"Created {filename} ({width}x{height})")


if __name__ == "__main__":
    icons_dir = os.path.join(os.path.dirname(__file__), "..", "extension", "public", "icons")
    os.makedirs(icons_dir, exist_ok=True)
    
    for size in [16, 32, 48, 128]:
        create_png(size, size, os.path.join(icons_dir, f"icon{size}.png"))
    
    print("All icons generated!")
