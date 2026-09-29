#!/usr/bin/env python3
"""
Magic Maze asset extractor.

Reads the original 1994 Turbo Pascal game files and converts them into
web-friendly formats (PNG, JSON, WAV) for the HTML5 port.

Source formats (all reverse-engineered from MMAZE.PAS):
  MM_SPR.DAT      : 768-byte VGA palette (6-bit) + 88 sprites of 1030 bytes
                    (2-byte width + 2-byte height + 2-byte flags + 1024 px)
                    Sprites 0..57  = "special" (player, monsters, items, spells)
                    Sprites 58..87 = "background" (walls, floors)
  MM_*.GRA        : Standard ZSoft PCX, 320x200x256 (title/end/back screens)
  MM_MAP.NNN      : 256-byte header + 32768-byte tile grid (128x128, 2 bytes/tile)
  MM_SAM.NNN      : Raw 8-bit PCM. Source XORs each byte with 127 before sending
                    to GUS RAM, so the on-disk format is biased: silence = ~127.
"""

import json
import os
import struct
import sys
import wave
from pathlib import Path
from PIL import Image

GAME_DIR = Path(__file__).resolve().parent.parent / 'game'
OUT_DIR  = Path(__file__).resolve().parent.parent / 'web' / 'assets'
LVL_DIR  = Path(__file__).resolve().parent.parent / 'web' / 'levels'

# Constants from MMAZE.PAS
MAX_SPR        = 57          # 0..57 = 58 special sprites
MAX_BACK_SPR   = 29          # 0..29 = 30 background sprites
SPRITE_BYTES   = 1030
SPRITE_HEADER  = 6           # 2 width + 2 height + 2 flags
TILE_SIZE      = 32
PALETTE_BYTES  = 768
MAP_HEADER     = 256
MAP_DATA_BYTES = 32768       # 128 * 128 * 2
MAP_W = MAP_H  = 128

# ---------------------------------------------------------------------------
# 1. Palette + sprite sheet
# ---------------------------------------------------------------------------

def vga6_to_rgb8(v: int) -> int:
    """VGA DAC stores 6-bit channel values (0..63). Spread to 8-bit (0..255)
    by replicating the top 2 bits at the bottom — gives true 0..255 range
    without a dim ceiling at 252."""
    return ((v & 0x3F) << 2) | ((v & 0x3F) >> 4)

def load_palette(data: bytes):
    """Return list of 256 (r,g,b) tuples in 8-bit space."""
    if len(data) < PALETTE_BYTES:
        raise ValueError("Palette truncated")
    pal = []
    for i in range(256):
        r, g, b = data[i*3], data[i*3+1], data[i*3+2]
        pal.append((vga6_to_rgb8(r), vga6_to_rgb8(g), vga6_to_rgb8(b)))
    return pal

def parse_sprite(buf: bytes):
    """Parse one 1030-byte sprite record. Returns (w, h, indices)."""
    w, h, _flags = struct.unpack('<HHH', buf[:SPRITE_HEADER])
    pixels = buf[SPRITE_HEADER:SPRITE_HEADER + w*h]
    return w, h, pixels

def build_spritesheet(spr_bytes: bytes, palette):
    """Decode all sprites and tile them onto a single PNG.

    Layout: 16 sprites per row.  Special and background sprites share the same
    sheet so the engine just needs one image. Spell-trail / monster / wall
    indices in the source map directly to columns/rows here.
    """
    sprites = []
    offset = PALETTE_BYTES
    for i in range(MAX_SPR + 1 + MAX_BACK_SPR + 1):
        w, h, pixels = parse_sprite(spr_bytes[offset:offset + SPRITE_BYTES])
        sprites.append((w, h, pixels))
        offset += SPRITE_BYTES

    cols = 16
    rows = (len(sprites) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * TILE_SIZE, rows * TILE_SIZE), (0, 0, 0, 0))

    # Treat palette index 0 as transparent for the *foreground* sprites only,
    # matching the engine's TransPut blit. Background sprites are drawn with
    # CopyPut (opaque), but storing them with alpha=255 even when the index is 0
    # works because the engine never blits index 0 from the background layer
    # without a wall sprite already present.
    for n, (w, h, pixels) in enumerate(sprites):
        cx = (n % cols) * TILE_SIZE
        cy = (n // cols) * TILE_SIZE
        is_background = n > MAX_SPR
        for y in range(h):
            for x in range(w):
                idx = pixels[y*w + x]
                r, g, b = palette[idx]
                a = 255 if (is_background or idx != 0) else 0
                sheet.putpixel((cx + x, cy + y), (r, g, b, a))

    sheet.save(OUT_DIR / 'sprites.png')
    return len(sprites), cols, rows

def extract_sprites_and_palette():
    raw = (GAME_DIR / 'MM_SPR.DAT').read_bytes()
    palette = load_palette(raw[:PALETTE_BYTES])
    n, cols, rows = build_spritesheet(raw, palette)

    # Save palette + sprite metadata for the JS engine
    meta = {
        'tile_size': TILE_SIZE,
        'cols': cols,
        'rows': rows,
        'count': n,
        'special_count': MAX_SPR + 1,        # 58 — sprites 0..57
        'background_count': MAX_BACK_SPR + 1,# 30 — sprites 58..87 in sheet
        'palette': [list(c) for c in palette],
        # Named sprite indices, transcribed from MMAZE.PAS constants.
        'sprite_ids': {
            'spell_lightning': 10,
            'spell_bigball':   11,
            'spell_coolcube':  12,
            'spell_map':       13,
            'spell_heal':      14,
            'spell_mana':      15,
            'spell_lookahead': 16,
            'blood_splat':      9,
            'chest':           20,
            'life_potion':     21,
            'mana_potion':     22,
            'money_bag':       23,
            'orb':             24,
            'key_yellow':      30,
            'key_blue':        31,
            'key_red':         32,
            'door_yellow':     33,
            'door_blue':       34,
            'door_red':        35,
            'exit':            39,
            'monsters_first':  40,
            'monsters_count':  20,
        },
    }
    (OUT_DIR / 'sprites.json').write_text(json.dumps(meta, indent=2))
    print(f"  sprites.png  : {n} tiles in {cols}x{rows} grid")
    print(f"  sprites.json : palette + indices")

# ---------------------------------------------------------------------------
# 2. Full-screen images (PCX)
# ---------------------------------------------------------------------------

def decode_pcx(data: bytes) -> Image.Image:
    """Decode a 256-color ZSoft PCX file. Magic Maze only uses this single
    flavour, so we don't bother with the planar/4-bit variants."""
    if data[0] != 0x0A:
        raise ValueError("Not a PCX file")
    xmin, ymin, xmax, ymax = struct.unpack_from('<HHHH', data, 4)
    width  = xmax - xmin + 1
    height = ymax - ymin + 1
    bytes_per_line = struct.unpack_from('<H', data, 66)[0]

    # PCX stores its 256-color palette at the very end: 1-byte marker (0x0C)
    # followed by 768 bytes of 8-bit RGB.
    palette = None
    if data[-769] == 0x0C:
        pal_raw = data[-768:]
        palette = [(pal_raw[i*3], pal_raw[i*3+1], pal_raw[i*3+2]) for i in range(256)]

    # RLE decode body (offset 128 onwards, until palette marker).
    body_end = len(data) - 769 if palette else len(data)
    pos = 128
    rows = []
    for _ in range(height):
        row = bytearray()
        while len(row) < bytes_per_line:
            b = data[pos]; pos += 1
            if (b & 0xC0) == 0xC0:
                count = b & 0x3F
                val = data[pos]; pos += 1
                row.extend([val] * count)
            else:
                row.append(b)
        rows.append(row[:width])

    img = Image.new('RGB', (width, height))
    if palette is None:
        # No palette in file — caller must apply one. Save as 'P' instead.
        img = Image.new('P', (width, height))
        img.putpalette([0]*768)
        flat = bytes(b for r in rows for b in r)
        img.frombytes(flat)
        return img
    for y, row in enumerate(rows):
        for x, idx in enumerate(row):
            img.putpixel((x, y), palette[idx])
    return img

def extract_screens():
    for name, src in [('title', 'MM_TITLE.GRA'),
                      ('end',   'MM_END.GRA'),
                      ('back',  'MM_BACK.GRA')]:
        img = decode_pcx((GAME_DIR / src).read_bytes())
        out = OUT_DIR / f'{name}.png'
        img.save(out)
        print(f"  {out.name:14s}: {img.size[0]}x{img.size[1]}")

# ---------------------------------------------------------------------------
# 3. Maps
# ---------------------------------------------------------------------------

def extract_maps():
    levels = []
    for n in range(1, 11):
        path = GAME_DIR / f'MM_MAP.{n:03d}'
        raw = path.read_bytes()
        if raw[:12] != b'MagicMazeMap':
            print(f"  WARNING: {path.name} missing signature")

        # Map files are stored with trailing zeros stripped — the original
        # Pascal code zero-fills the buffer before BlockRead, so any tiles
        # past the file's end are empty. Pad to full size for parsing.
        full_size = MAP_HEADER + MAP_DATA_BYTES
        if len(raw) < full_size:
            raw = raw + bytes(full_size - len(raw))

        # Header fields (from MMAZE.PAS DATA INFORMATION block at end of file)
        chk_lo, chk_hi = raw[16], raw[17]
        start_x, start_y = raw[24], raw[25]
        default_wall = raw[30] or 10
        last_level = (raw[32] & 0x80) != 0
        # Level name: NUL-terminated ASCII at byte 128, max ~38 chars
        name = bytearray()
        for i in range(128, 167):
            if raw[i] < 32: break
            name.append(raw[i])
        name = name.decode('latin-1')

        # Tile grid: 128x128, 2 bytes/tile, A=floor/wall (bit7=blocked), B=object
        tiles = []
        off = MAP_HEADER
        for y in range(MAP_H):
            row = []
            for x in range(MAP_W):
                a = raw[off]; b = raw[off+1]; off += 2
                row.append([a & 0x7F, b, bool(a & 0x80)])  # [floor, object, blocked]
            tiles.append(row)

        level = {
            'index':        n,
            'name':         name,
            'start':        [start_x, start_y],
            'default_wall': default_wall,
            'last_level':   last_level,
            'checksum':     chk_lo | (chk_hi << 8),
            'tiles':        tiles,
        }
        out = LVL_DIR / f'level{n:02d}.json'
        out.write_text(json.dumps(level))
        # Quick-look summary
        n_monsters = sum(1 for r in tiles for t in r if 40 <= t[1] < 60)
        print(f"  level{n:02d}.json: {name!r:35s} start=({start_x},{start_y}) monsters={n_monsters}")
        levels.append({'index': n, 'name': name, 'file': out.name})

    # Index file lists levels in order
    (LVL_DIR / 'index.json').write_text(json.dumps(levels, indent=2))

# ---------------------------------------------------------------------------
# 4. Sound samples
# ---------------------------------------------------------------------------
# From MMAZE.PAS:
#   sndARGH=1, sndZAP=2, sndPunch=3, sndBonus=4
#   GUSPlayVoice with rate 555 -> 22222 Hz; rate 200 -> 8000 Hz (bonus chime)
#   On load: GusPoke(addr, MapBuf^[j] XOR 127)  -- the GUS expects signed
#   8-bit, so the on-disk byte is the signed sample with bits 0..6 inverted.
#   Empirically this means:  signed_sample = on_disk_byte XOR 127.

SOUND_NAMES = {1: 'argh', 2: 'zap', 3: 'punch', 4: 'bonus'}
SOUND_RATES = {1: 22222, 2: 22222, 3: 22222, 4: 8000}

def extract_sounds():
    for n in range(1, 5):
        raw = (GAME_DIR / f'MM_SAM.{n:03d}').read_bytes()
        # Apply the same XOR 127 the original code does, then convert signed
        # 8-bit to unsigned 8-bit for WAV (which uses unsigned for 8-bit PCM).
        decoded = bytearray()
        for byte in raw:
            signed = (byte ^ 0x7F)
            if signed >= 128: signed -= 256        # interpret as signed
            decoded.append(signed + 128)           # back to unsigned for WAV

        out = OUT_DIR / f'snd_{SOUND_NAMES[n]}.wav'
        with wave.open(str(out), 'wb') as wav:
            wav.setnchannels(1)
            wav.setsampwidth(1)
            wav.setframerate(SOUND_RATES[n])
            wav.writeframes(bytes(decoded))
        print(f"  {out.name:18s}: {len(raw)} samples @ {SOUND_RATES[n]} Hz")

# ---------------------------------------------------------------------------

def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    LVL_DIR.mkdir(parents=True, exist_ok=True)

    print("[1/4] Extracting palette + sprites...")
    extract_sprites_and_palette()
    print("[2/4] Decoding title/end/background PCX screens...")
    extract_screens()
    print("[3/4] Parsing levels...")
    extract_maps()
    print("[4/4] Converting sound samples...")
    extract_sounds()
    print("Done.")

if __name__ == '__main__':
    main()
