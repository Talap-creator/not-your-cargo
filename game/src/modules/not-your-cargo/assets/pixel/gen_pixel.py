"""NOT YOUR CARGO â€” original, integer-grid pixel sprites.

Run: python pixel-staging/gen_pixel.py (requires Pillow >= 10.1).
Writes beside this script, never reads/rasterizes SVGs. All geometry is authored
at native resolution; only the final previews use nearest-neighbour scaling.
Light: upper left. Coordinates are inclusive. No antialiasing or alpha blending.
"""
from pathlib import Path
import math
import random

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
PALETTE = {
    'ink': '#1d1714', 'dark': '#3a2e28', 'steel': '#62544a',
    'metal': '#968575', 'ivory': '#f4ead8', 'sand': '#c9a46a',
    'sand_hi': '#dbc08b', 'sand_lo': '#b48f58',
    'rust_dark': '#643124', 'rust': '#a64b29', 'orange': '#ff7a1a',
    'yellow': '#ffc24a', 'red_dark': '#7a2420', 'red': '#d9452b',
    'cyan_dark': '#205568', 'cyan_mid': '#219bb2', 'cyan': '#2ee6ff',
    'blue_dark': '#245681', 'blue': '#3aa0ff', 'blue_hi': '#91caff',
    'pink_dark': '#8c355e', 'pink': '#ff4fa3', 'pink_hi': '#ffaad0',
    'grey_dark': '#656565', 'grey': '#9c9c9c', 'grey_hi': '#d6d6d6',
    'white': '#ffffff',
    # Low-contrast opaque earth ramps, not alpha overlays.
    'dust_dark': '#b59564', 'dust': '#bea06d', 'dust_hi': '#d1b17b',
    'road_dark': '#99794f', 'road': '#aa8757', 'road_hi': '#bc9863',
}
SIZES = {
    'bike_blue': (32, 24), 'bike_pink': (32, 24), 'bike_paint': (32, 24),
    'raider': (24, 24), 'drone': (20, 20), 'boss': (64, 48), 'truck': (56, 28),
    'turret': (24, 24), 'turret_mg': (24, 8), 'turret_shotgun': (24, 10),
    'turret_laser': (24, 8), 'turret_rocket': (24, 10),
    'cargo': (16, 16), 'core': (16, 16), 'repair_kit': (16, 16),
    'target': (20, 20), 'rocket': (12, 5), 'station': (80, 80),
    'evac': (80, 80), 'terminal': (24, 24), 'wall_block': (32, 32),
    'ground_sand': (64, 64), 'ground_road': (64, 64),
    **{f'icon_{n}': (16, 16) for n in
       ('cargo', 'dash', 'hp', 'laser', 'mg', 'rocket', 'shotgun', 'core')},
}


def color(name):
    return PALETTE.get(name, name) if name is not None else None


class Canvas:
    def __init__(self, size, background=(0, 0, 0, 0)):
        self.im = Image.new('RGBA', size, color(background))
        self.d = ImageDraw.Draw(self.im)

    def rect(self, box, fill, outline=None):
        self.d.rectangle(box, fill=color(fill), outline=color(outline))

    def poly(self, points, fill, outline='ink'):
        self.d.polygon(points, fill=color(fill), outline=color(outline))

    def line(self, points, fill, width=1):
        self.d.line(points, fill=color(fill), width=width)

    def dot(self, x, y, fill):
        self.d.point((x, y), fill=color(fill))

    def oval(self, box, fill, outline='ink'):
        # Pillow's integer ellipse rasterizer, without supersampling.
        self.d.ellipse(box, fill=color(fill), outline=color(outline))

    def panel(self, box, fill='steel', hi='metal', lo='dark'):
        x0, y0, x1, y1 = box
        self.rect(box, fill, 'ink')
        self.line([(x0 + 1, y1 - 1), (x0 + 1, y0 + 1),
                   (x1 - 1, y0 + 1)], hi)
        self.line([(x0 + 2, y1 - 1), (x1 - 1, y1 - 1),
                   (x1 - 1, y0 + 2)], lo)

    def bolt(self, x, y):
        self.dot(x, y, 'ivory')
        self.dot(x + 1, y + 1, 'ink')


def bike(variant):
    c = Canvas((32, 24))
    neutral = variant == 'paint'
    accent, high, low = {
        'blue': ('blue', 'blue_hi', 'blue_dark'),
        'pink': ('pink', 'pink_hi', 'pink_dark'),
        'paint': ('grey_hi', 'white', 'grey'),
    }[variant]
    hull, shadow = ('grey_hi', 'grey') if neutral else ('ivory', 'metal')
    steel = 'grey_dark' if neutral else 'steel'
    dark = 'grey_dark' if neutral else 'dark'
    for x, y, w in [(4, 1, 10), (18, 2, 8), (4, 17, 10), (18, 17, 8)]:
        c.poly([(x + 1, y), (x + w - 2, y), (x + w, y + 2),
                (x + w, y + 4), (x + w - 2, y + 5),
                (x + 1, y + 5), (x, y + 4), (x, y + 1)], dark)
        c.line([(x + 2, y + 1), (x + w - 2, y + 1)], steel)
        c.line([(x + 2, y + 2), (x + w - 2, y + 2)], accent)
        c.line([(x + 2, y + 4), (x + w - 2, y + 4)], low)
    c.poly([(3, 8), (8, 8), (8, 16), (3, 16), (1, 14), (1, 10)], steel)
    c.line([(2, 11), (2, 13)], 'white' if neutral else 'orange')
    c.poly([(8, 6), (21, 6), (26, 8), (30, 11), (30, 12),
            (26, 15), (21, 18), (8, 18), (5, 15), (5, 9)], hull)
    c.poly([(7, 14), (10, 16), (22, 16), (28, 13), (25, 16),
            (20, 17), (8, 17)], shadow, None)
    c.line([(8, 7), (20, 7), (24, 8)], high)
    c.poly([(11, 7), (21, 7), (25, 9), (19, 9), (17, 10), (11, 10)], accent, None)
    c.line([(11, 8), (19, 8)], high)
    c.poly([(11, 17), (21, 17), (25, 15), (19, 15), (17, 14), (11, 14)], low, None)
    c.line([(12, 16), (21, 16)], accent)
    c.poly([(9, 9), (16, 9), (19, 12), (16, 15), (9, 15), (7, 13), (7, 11)], dark)
    c.line([(10, 10), (15, 10)], steel)
    for y in (11, 13):
        c.line([(10, y), (14, y)], 'grey' if neutral else 'sand')
    c.poly([(20, 10), (24, 10), (27, 12), (24, 14), (20, 14)], steel)
    c.poly([(22, 11), (24, 11), (26, 12), (24, 13), (22, 13)], accent, None)
    c.dot(23, 11, high)
    c.dot(28, 11, 'white' if neutral else 'ivory')
    c.dot(8, 8, 'white' if neutral else 'ivory')
    c.dot(8, 16, steel)
    return c.im


def raider():
    c = Canvas((24, 24))
    for x in (2, 14):
        for y in (3, 16):
            c.panel((x, y, x + 6, y + 4), 'dark', 'steel', 'ink')
    for x in (6, 13):
        c.poly([(x, 7), (x + 2, 1), (x + 4, 7)], 'sand')
        c.dot(x + 2, 3, 'ivory')
        c.poly([(x, 17), (x + 2, 22), (x + 4, 17)], 'sand_lo')
    c.poly([(4, 7), (15, 7), (20, 9), (22, 12), (20, 15),
            (15, 17), (4, 17), (2, 14), (2, 10)], 'rust')
    c.line([(5, 8), (14, 8), (17, 9)], 'orange')
    c.line([(5, 16), (14, 16), (18, 14)], 'red_dark')
    c.poly([(6, 9), (11, 9), (14, 12), (11, 15), (6, 15)], 'dark')
    c.line([(7, 10), (10, 10)], 'steel')
    c.rect((12, 10, 22, 13), 'steel', 'ink')
    c.line([(17, 11), (21, 11)], 'sand')
    c.rect((10, 10, 15, 14), 'sand', 'ink')
    c.line([(11, 11), (14, 11)], 'ivory')
    # Bone helmet with a two-pixel visor; no lettering at this scale.
    c.dot(12, 12, 'ink')
    c.dot(14, 12, 'ink')
    c.dot(5, 10, 'sand')
    c.dot(5, 14, 'rust_dark')
    return c.im


def drone():
    c = Canvas((20, 20))
    c.line([(4, 4), (15, 15)], 'ink', 3)
    c.line([(4, 15), (15, 4)], 'ink', 3)
    c.line([(4, 4), (15, 15)], 'steel')
    c.line([(4, 15), (15, 4)], 'metal')
    for x, y in ((1, 1), (13, 1), (1, 13), (13, 13)):
        c.oval((x, y, x + 5, y + 5), 'rust_dark')
        c.line([(x + 1, y + 1), (x + 3, y + 1)], 'rust')
        c.line([(x + 1, y + 3), (x + 4, y + 3)], 'sand')
        c.dot(x + 2, y + 2, 'ivory')
        c.dot(x + 3, y + 3, 'ink')
    c.poly([(6, 6), (11, 6), (15, 8), (18, 10), (15, 12),
            (11, 14), (6, 14), (4, 12), (4, 8)], 'rust')
    c.line([(6, 7), (11, 7)], 'orange')
    c.line([(6, 13), (11, 13)], 'rust_dark')
    c.panel((6, 8, 10, 12), 'dark', 'steel', 'ink')
    c.poly([(12, 7), (14, 8), (16, 10), (14, 12), (12, 13), (10, 10)], 'orange')
    c.line([(13, 9), (13, 11)], 'yellow')
    c.dot(13, 9, 'ivory')
    return c.im


def boss():
    c = Canvas((64, 48))
    c.poly([(4, 11), (18, 11), (18, 37), (4, 37), (1, 34), (1, 14)], 'dark')
    for y in (15, 27):
        c.panel((2, y, 8, y + 7), 'rust_dark', 'rust', 'ink')
        c.line([(3, y + 2), (3, y + 5)], 'orange')
        c.line([(4, y + 2), (4, y + 4)], 'yellow')
    c.poly([(9, 12), (19, 8), (41, 8), (54, 14), (62, 23),
            (62, 25), (54, 34), (41, 40), (19, 40), (9, 36), (6, 30), (6, 18)], 'rust')
    c.poly([(9, 29), (20, 36), (41, 36), (55, 29), (59, 26),
            (53, 33), (41, 39), (19, 39), (10, 35)], 'red_dark', None)
    c.line([(10, 13), (20, 9), (40, 9), (52, 14)], 'orange')
    c.line([(9, 14), (7, 19), (7, 24)], 'sand_lo')
    c.poly([(14, 14), (34, 14), (44, 19), (44, 29), (34, 34),
            (14, 34), (11, 30), (11, 18)], 'steel')
    c.poly([(17, 16), (31, 16), (38, 20), (38, 28), (31, 32),
            (17, 32), (14, 28), (14, 20)], 'rust_dark')
    c.line([(17, 17), (30, 17), (35, 20)], 'rust')
    c.line([(17, 18), (29, 18)], 'orange')
    for x in (18, 22):
        c.rect((x, 20, x + 2, 28), 'ink')
        c.line([(x, 20), (x, 26)], 'metal')
    # A grinning scrap-metal skull on the interceptor's roof.
    c.poly([(28, 21), (33, 21), (35, 23), (34, 26), (33, 26),
            (33, 28), (29, 28), (29, 26), (27, 25), (27, 23)], 'sand', None)
    c.line([(29, 21), (32, 21)], 'ivory')
    c.dot(29, 23, 'ink')
    c.dot(32, 23, 'ink')
    c.dot(31, 25, 'rust_dark')
    c.dot(30, 28, 'rust_dark')
    c.dot(32, 28, 'rust_dark')
    c.poly([(39, 18), (49, 16), (56, 24), (49, 32), (39, 30), (43, 24)], 'dark')
    c.poly([(47, 19), (49, 20), (53, 24), (49, 28), (47, 29), (50, 24)], 'orange', None)
    c.line([(48, 19), (52, 23)], 'yellow')
    c.line([(56, 21), (59, 24), (56, 27)], 'sand')
    for y in (1, 33):
        c.poly([(14, y), (45, y), (50, y + 3), (50, y + 10),
                (45, y + 13), (14, y + 13), (11, y + 10), (11, y + 3)], 'red_dark')
        c.line([(14, y + 1), (44, y + 1), (48, y + 3)], 'red')
        c.line([(13, y + 3), (13, y + 9)], 'rust')
        c.panel((16, y + 2, 42, y + 11), 'steel', 'metal', 'dark')
        for x in (23, 31):
            c.line([(x, y + 3), (x, y + 10)], 'ink')
            c.line([(x + 1, y + 3), (x + 1, y + 9)], 'dark')
        for yy in (y + 4, y + 9):
            c.line([(18, yy), (21, yy)], 'sand')
            c.line([(26, yy), (29, yy)], 'sand')
            c.line([(34, yy), (39, yy)], 'sand')
        c.panel((43, y + 2, 48, y + 11), 'dark', 'steel', 'ink')
        for yy in (y + 4, y + 7, y + 10):
            c.line([(45, yy), (46, yy)], 'orange')
        c.bolt(15, y + 3)
        c.bolt(15, y + 10)
    c.dot(10, 27, 'orange')
    c.dot(53, 17, 'metal')
    return c.im


def truck():
    c = Canvas((56, 28))
    for x in (5, 22, 43):
        for y in (1, 22):
            c.panel((x, y, x + 8, y + 4), 'dark', 'steel', 'ink')
            for xx in range(x + 2, x + 8, 3):
                c.line([(xx, y + 1), (xx, y + 3)], 'ink')
    c.panel((2, 6, 51, 22), 'steel')
    c.panel((1, 4, 38, 24), 'orange', 'yellow', 'rust_dark')
    for x in (4, 21):
        c.panel((x, 6, x + 13, 21), 'sand', 'sand_hi', 'sand_lo')
        c.rect((x + 2, 8, x + 11, 19), 'rust')
        for xx in (x + 3, x + 7, x + 10):
            c.line([(xx, 8), (xx, 18)], 'rust_dark')
            c.line([(xx + 1, 8), (xx + 1, 18)], 'orange')
        c.line([(x + 2, 8), (x + 11, 8)], 'yellow')
        c.bolt(x + 1, 7)
        c.bolt(x + 11, 20)
    # Crossed-out consignment label, matching the cargo pickup.
    c.rect((14, 11, 22, 17), 'ivory', 'ink')
    c.line([(16, 13), (20, 13)], 'metal')
    c.line([(15, 17), (21, 11)], 'red_dark')
    c.poly([(38, 4), (48, 4), (54, 8), (54, 19), (48, 23), (38, 23)], 'dark')
    c.line([(39, 5), (47, 5), (52, 8)], 'metal')
    c.poly([(41, 7), (46, 7), (49, 10), (49, 17), (46, 20), (41, 20)], 'steel')
    c.line([(42, 8), (46, 8)], 'metal')
    c.line([(42, 19), (46, 19)], 'ink')
    for y in (10, 12, 14):
        c.line([(42, y), (45, y)], 'dark')
    c.poly([(49, 8), (52, 10), (52, 17), (49, 19)], 'blue_dark')
    c.line([(50, 10), (50, 16)], 'blue')
    c.line([(50, 10), (51, 11)], 'blue_hi')
    c.line([(53, 9), (53, 11)], 'ivory')
    c.line([(53, 17), (53, 19)], 'sand')
    c.line([(39, 7), (39, 10)], 'orange')
    c.line([(39, 18), (39, 21)], 'rust')
    c.dot(2, 9, 'ivory')
    c.dot(2, 19, 'red')
    return c.im


def turret():
    c = Canvas((24, 24))
    for x in (3, 16):
        for y in (3, 16):
            c.panel((x, y, x + 4, y + 4), 'dark', 'metal', 'ink')
    c.oval((1, 2, 22, 22), 'steel')
    c.oval((3, 3, 20, 20), 'rust_dark')
    c.line([(5, 6), (8, 4), (14, 4), (17, 6)], 'orange')
    c.line([(6, 18), (9, 20), (15, 19), (18, 17)], 'dark')
    c.oval((6, 7, 17, 18), 'rust')
    c.oval((8, 9, 15, 16), 'dark')
    c.line([(10, 10), (13, 10)], 'metal')
    c.dot(11, 12, 'orange')
    c.dot(12, 12, 'yellow')
    for x, y in ((4, 11), (18, 11), (10, 5), (10, 19)):
        c.bolt(x, y)
    return c.im


def gun(kind):
    h = 8 if kind in ('mg', 'laser') else 10
    c = Canvas((24, h))
    cy = h // 2
    c.poly([(0, cy - 1), (2, cy - 3), (5, cy - 3), (7, cy - 1),
            (7, cy + 1), (5, cy + 3), (2, cy + 3), (0, cy + 1)], 'steel')
    if kind in ('mg', 'laser'):
        c.rect((9, 2, 22, 5), 'dark', 'ink')
        c.poly([(4, 1), (11, 1), (14, 3), (14, 4), (11, 6), (4, 6)], 'sand')
        c.line([(5, 2), (11, 2)], 'ivory')
        c.line([(5, 5), (11, 5)], 'metal')
        for x in (8, 10):
            c.line([(x, 3), (x, 4)], 'dark')
        if kind == 'mg':
            c.line([(15, 3), (19, 3)], 'sand')
            c.panel((20, 1, 23, 6), 'steel', 'metal', 'dark')
            c.dot(5, 3, 'orange')
        else:
            c.line([(14, 3), (20, 3)], 'cyan')
            for x in (15, 18):
                c.line([(x, 2), (x, 5)], 'ink')
                c.dot(x, 2, 'metal')
            c.rect((20, 0, 23, 7), 'steel', 'ink')
            c.line([(22, 2), (22, 5)], 'cyan')
            c.dot(22, 2, 'ivory')
    elif kind == 'shotgun':
        for y in (1, 5):
            c.panel((8, y, 20, y + 3), 'metal', 'ivory', 'steel')
            c.rect((18, y, 21, y + 3), 'dark', 'ink')
            c.dot(19, y + 1, 'steel')
            c.dot(13, y + 1, 'orange')
        c.panel((4, 2, 10, 7), 'sand', 'ivory', 'sand_lo')
        c.line([(8, 3), (8, 6)], 'rust_dark')
    else:
        c.rect((5, 2, 22, 7), 'dark', 'ink')
        c.poly([(5, 1), (15, 1), (18, 3), (18, 6), (15, 8), (5, 8)], 'sand')
        c.line([(6, 2), (15, 2)], 'ivory')
        c.line([(6, 7), (15, 7)], 'metal')
        for x in (10, 13):
            c.line([(x, 2), (x, 7)], 'dark')
        c.panel((19, 1, 23, 8), 'steel', 'metal', 'dark')
        c.line([(21, 3), (21, 6)], 'orange')
        c.dot(21, 3, 'yellow')
    c.dot(3, cy - 1, 'metal')
    c.dot(4, cy, 'ink')
    return c.im


def cargo():
    c = Canvas((16, 16))
    c.poly([(2, 1), (13, 1), (14, 2), (14, 13), (13, 14),
            (2, 14), (1, 13), (1, 2)], 'orange')
    c.line([(2, 12), (2, 2), (12, 2)], 'yellow')
    c.line([(3, 13), (13, 13), (13, 3)], 'rust')
    for y in (3, 11):
        c.rect((2, y, 13, y + 1), 'sand_lo')
        c.line([(2, y), (12, y)], 'sand_hi')
    c.rect((5, 5, 11, 10), 'ivory', 'ink')
    c.line([(7, 7), (9, 7)], 'metal')
    c.line([(5, 11), (12, 4)], 'red_dark')
    c.line([(3, 6), (3, 9)], 'rust_dark')
    c.line([(13, 6), (13, 9)], 'rust_dark')
    c.poly([(3, 1), (5, 2), (5, 4), (3, 5), (2, 3)], 'ivory', None)
    c.line([(3, 2), (4, 3), (3, 4)], 'ink')
    return c.im


def core():
    c = Canvas((16, 16))
    c.poly([(5, 1), (10, 1), (14, 5), (14, 10), (10, 14),
            (5, 14), (1, 10), (1, 5)], 'orange')
    c.line([(2, 6), (5, 2), (10, 2)], 'yellow')
    c.line([(4, 12), (6, 13), (10, 13), (13, 10), (13, 6)], 'rust')
    c.poly([(5, 4), (10, 4), (12, 6), (12, 10), (10, 12),
            (5, 12), (3, 10), (3, 6)], 'dark')
    c.oval((5, 5, 11, 11), 'cyan_dark', None)
    c.oval((5, 5, 10, 10), 'cyan_mid', None)
    c.oval((5, 5, 9, 9), 'cyan', None)
    c.line([(6, 8), (6, 6), (8, 6)], 'ivory')
    for y in (0, 13):
        c.panel((5, y, 10, y + 2), 'sand', 'sand_hi', 'sand_lo')
    for x in (2, 13):
        c.dot(x, 6, 'ink')
        c.dot(x, 9, 'ink')
    return c.im


def repair_kit():
    c = Canvas((16, 16))
    c.rect((5, 0, 10, 3), 'steel', 'ink')
    c.line([(6, 1), (9, 1)], 'metal')
    c.poly([(2, 3), (13, 3), (15, 5), (15, 12), (13, 14),
            (2, 14), (0, 12), (0, 5)], 'steel')
    c.line([(2, 4), (12, 4)], 'metal')
    c.line([(2, 13), (12, 13), (14, 11)], 'dark')
    for x in (1, 13):
        c.rect((x, 5, x + 1, 11), 'dark')
        c.dot(x, 5, 'orange')
    c.poly([(6, 5), (9, 5), (9, 7), (11, 7), (11, 10),
            (9, 10), (9, 12), (6, 12), (6, 10), (4, 10), (4, 7), (6, 7)], 'ivory')
    c.line([(7, 6), (8, 6)], 'white')
    c.line([(7, 11), (8, 11)], 'sand')
    return c.im


def target():
    c = Canvas((20, 20))
    for x in (2, 15):
        c.panel((x, 2, x + 2, 17), 'steel', 'metal', 'dark')
    c.poly([(14, 8), (17, 8), (19, 10), (17, 12), (14, 12)], 'sand')
    c.oval((1, 1, 17, 17), 'red_dark')
    c.oval((2, 2, 16, 16), 'red', None)
    c.line([(4, 3), (7, 2), (10, 2)], 'orange')
    c.oval((4, 4, 14, 14), 'sand')
    c.oval((4, 4, 13, 13), 'ivory', None)
    c.oval((6, 6, 12, 12), 'red_dark')
    c.oval((7, 7, 11, 11), 'red', None)
    c.rect((8, 8, 10, 10), 'ivory')
    # The bullseye is pristine. Everyone shot the edge instead.
    for x, y in ((3, 7), (13, 4), (12, 14)):
        c.dot(x, y, 'sand')
        c.dot(x + 1, y + 1, 'ink')
    return c.im


def rocket():
    c = Canvas((12, 5))
    c.poly([(0, 0), (5, 1), (5, 3), (0, 4), (1, 2)], 'orange', None)
    c.line([(1, 2), (4, 2)], 'yellow')
    c.poly([(3, 0), (5, 0), (7, 2), (5, 4), (3, 4), (4, 2)], 'sand')
    c.poly([(5, 1), (8, 1), (11, 2), (8, 3), (5, 3)], 'ivory')
    c.line([(6, 2), (8, 2)], 'ivory')
    c.dot(9, 2, 'red')
    return c.im


def terminal():
    c = Canvas((24, 24))
    c.rect((3, 4, 20, 20), 'dark', 'ink')
    c.poly([(5, 2), (17, 2), (21, 6), (21, 17), (17, 21),
            (5, 21), (2, 18), (2, 5)], 'steel')
    c.line([(3, 16), (3, 5), (5, 3), (16, 3), (19, 6)], 'metal')
    c.line([(5, 20), (16, 20), (20, 16), (20, 7)], 'dark')
    c.panel((5, 5, 15, 18), 'dark', 'steel', 'ink')
    c.rect((7, 7, 13, 16), 'cyan_dark')
    c.line([(8, 14), (8, 8), (12, 8)], 'cyan_mid')
    c.line([(9, 9), (11, 9)], 'cyan')
    # Tiny sad face: the service is, predictably, unavailable.
    c.dot(9, 11, 'cyan')
    c.dot(12, 11, 'cyan')
    c.line([(9, 14), (10, 13), (11, 13), (12, 14)], 'cyan')
    c.dot(8, 8, 'ivory')
    for y in (8, 13):
        c.panel((17, y, 19, y + 3), 'sand', 'ivory', 'sand_lo')
    c.line([(8, 19), (11, 19)], 'orange')
    c.dot(13, 19, 'red')
    c.bolt(5, 4)
    c.bolt(18, 18)
    return c.im


def station():
    c = Canvas((80, 80))
    c.poly([(12, 3), (67, 3), (76, 12), (76, 67), (67, 76),
            (12, 76), (3, 67), (3, 12)], 'dark')
    c.line([(4, 64), (4, 12), (12, 4), (66, 4), (74, 12)], 'metal')
    c.poly([(14, 8), (65, 8), (71, 14), (71, 65), (65, 71),
            (14, 71), (8, 65), (8, 14)], 'sand_lo')
    c.line([(9, 62), (9, 14), (14, 9), (64, 9)], 'sand_hi')
    c.line([(14, 70), (64, 70), (70, 64), (70, 15)], 'rust_dark')
    # Inset floor slabs and expansion joints, all in overhead projection.
    for y in (22, 39, 56):
        c.line([(10, y), (69, y)], 'sand')
    for x in (20, 40, 60):
        c.line([(x, 20), (x, 59)], 'sand')
    c.poly([(33, 18), (51, 18), (63, 30), (63, 50), (51, 61),
            (33, 61), (21, 50), (21, 30)], 'dark')
    c.line([(36, 21), (49, 21), (60, 32), (60, 47), (49, 58), (36, 58)], 'cyan_dark', 2)
    c.line([(37, 22), (49, 22), (59, 32)], 'cyan_mid')
    c.line([(60, 37), (60, 44)], 'cyan')
    # Two solar banks; broken cells replaced with riveted scrap.
    for y in (11, 61):
        c.panel((14, y, 61, y + 8), 'dark', 'steel', 'ink')
        for x in range(16, 60, 8):
            c.rect((x, y + 2, x + 5, y + 6), 'cyan_dark')
            c.line([(x, y + 2), (x + 5, y + 2)], 'cyan_mid')
            c.line([(x + 2, y + 2), (x + 2, y + 6)], 'steel')
            c.line([(x, y + 4), (x + 5, y + 4)], 'dark')
        c.panel((48, y + 1, 55, y + 7), 'rust', 'orange', 'rust_dark')
        c.bolt(49, y + 2)
        c.bolt(53, y + 5)
    c.panel((14, 31, 28, 49), 'steel', 'metal', 'dark')
    for y in range(34, 47, 3):
        c.line([(16, y), (20, y)], 'ink')
    # Dish has discrete concentric material ramps, not a gradient.
    c.oval((16, 25, 45, 54), 'steel')
    c.oval((16, 25, 44, 53), 'sand')
    c.oval((17, 26, 43, 51), 'ivory', None)
    c.poly([(20, 31), (30, 40), (20, 49), (17, 45), (17, 35)], 'sand_lo', None)
    c.line([(30, 27), (30, 52)], 'metal')
    c.line([(19, 33), (42, 47)], 'sand')
    c.line([(19, 47), (42, 33)], 'sand')
    c.line([(23, 28), (28, 26), (34, 26)], 'white')
    c.oval((26, 35, 35, 44), 'sand_hi')
    c.panel((29, 38, 49, 42), 'steel', 'metal', 'dark')
    c.poly([(45, 36), (50, 36), (53, 40), (50, 44), (45, 44)], 'cyan_dark')
    c.line([(46, 37), (49, 37), (51, 39)], 'cyan')
    c.dot(49, 39, 'ivory')
    c.poly([(65, 34), (70, 40), (65, 46), (65, 42), (60, 42),
            (60, 38), (65, 38)], 'ivory')
    c.line([(61, 41), (66, 41), (66, 43)], 'sand')
    for x in (14, 57):
        for y in (5, 73):
            c.rect((x, y, x + 8, y + 1), 'cyan_dark')
            c.line([(x, y), (x + 6, y)], 'cyan')
    for y in (23, 51):
        c.panel((9, y, 12, y + 6), 'rust', 'orange', 'rust_dark')
        for yy in (y + 1, y + 4):
            c.dot(10, yy, 'yellow')
    for x, y in ((11, 11), (66, 11), (11, 66), (66, 66)):
        c.bolt(x, y)
    # Small crossed-out parcel plaque: delivery doesn't imply ownership.
    c.panel((45, 48, 54, 55), 'sand', 'ivory', 'sand_lo')
    c.rect((47, 50, 51, 53), 'orange', 'rust_dark')
    c.line([(47, 54), (52, 49)], 'red_dark')
    c.line([(12, 56), (15, 54), (17, 54)], 'rust')
    c.dot(13, 58, 'rust_dark')
    c.line([(66, 24), (65, 26), (67, 28)], 'rust')
    return c.im


def evac():
    c = Canvas((80, 80))
    # Explicit per-pixel ring masks preserve an entirely open landing area.
    for y in range(80):
        for x in range(80):
            dx, dy = x - 39.5, y - 39.5
            r2 = dx * dx + dy * dy
            if 29 * 29 <= r2 <= 38 * 38:
                r = math.sqrt(r2)
                if r < 30 or r >= 37:
                    shade = 'ink'
                elif r < 31 or r >= 36:
                    shade = 'metal' if dx + dy < 0 else 'dark'
                else:
                    sector = int((math.atan2(dy, dx) + math.pi) * 32 / (2 * math.pi))
                    shade = ('orange' if dx + dy < 0 else 'rust') if sector % 2 else 'dark'
                    if sector % 2 and 35 <= r < 36:
                        shade = 'yellow' if dx + dy < 0 else 'orange'
                c.dot(x, y, shade)
            elif 22 * 22 <= r2 <= 24 * 24:
                c.dot(x, y, 'ivory' if 22.6 ** 2 <= r2 < 23.5 ** 2 else 'ink')
    for box in ((35, 1, 44, 7), (35, 72, 44, 78),
                (1, 35, 7, 44), (72, 35, 78, 44)):
        c.panel(box, 'steel', 'metal', 'dark')
    for x, y in ((37, 3), (37, 74)):
        c.line([(x, y), (x + 5, y)], 'cyan')
        c.dot(x, y, 'ivory')
    for x, y in ((3, 37), (74, 37)):
        c.line([(x, y), (x, y + 5)], 'cyan')
        c.dot(x, y, 'ivory')
    for points in ([(39, 14), (39, 18)], [(39, 61), (39, 65)],
                   [(14, 39), (18, 39)], [(61, 39), (65, 39)]):
        c.line(points, 'ink', 3)
        c.line(points, 'sand')
    for x, y in ((15, 15), (61, 15), (15, 61), (61, 61)):
        c.bolt(x, y)
    # One faulty red guidance light, rather than an immaculate sci-fi pad.
    c.line([(40, 74), (42, 74)], 'red')
    return c.im


def wall_block():
    c = Canvas((32, 32), 'dark')
    c.panel((1, 1, 30, 30), 'steel', 'metal', 'ink')
    c.panel((3, 3, 28, 28), 'sand_lo', 'sand_hi', 'rust_dark')
    c.rect((5, 5, 26, 26), 'sand')
    c.line([(5, 25), (5, 5), (25, 5)], 'sand_hi')
    c.poly([(3, 3), (10, 3), (10, 4), (6, 4), (6, 7), (3, 8)], 'rust', None)
    c.line([(4, 4), (7, 4)], 'orange')
    c.poly([(25, 23), (28, 23), (28, 28), (22, 28), (22, 26), (25, 26)], 'rust_dark', None)
    c.line([(26, 24), (26, 27), (23, 27)], 'rust')
    c.line([(9, 5), (9, 9), (12, 12), (12, 16)], 'sand_lo')
    c.line([(9, 9), (6, 10)], 'sand_lo')
    c.line([(26, 19), (23, 19), (20, 22), (20, 26)], 'sand_lo')
    c.line([(24, 18), (26, 18)], 'sand_hi')
    for x, y in ((4, 4), (25, 4), (4, 25), (25, 25)):
        c.panel((x, y, x + 2, y + 2), 'steel', 'metal', 'dark')
    for x, y in ((14, 7), (8, 19), (16, 24), (22, 10), (16, 17)):
        c.line([(x, y), (x + 2, y)], 'sand_lo')
        c.dot(x, y - 1, 'sand_hi')
    return c.im


def ground(road=False):
    c = Canvas((64, 64), 'road' if road else 'sand')
    rng = random.Random(1702 if road else 891)
    # Wrapped clusters on a 63-pixel period. Last row/column explicitly repeat
    # the first: exact edge equality, with marks continuing across the seam.
    def wrapped(x, y, shade):
        c.dot(x % 63, y % 63, shade)

    if road:
        for y in list(range(12, 20)) + list(range(43, 51)):
            for x in range(63):
                wrapped(x, y, 'road_hi')
        for y in (16, 47):
            for x in range(63):
                wrapped(x, y, 'road_dark')
        for _ in range(38):
            x, y = rng.randrange(63), rng.randrange(63)
            for dx in range(rng.randrange(3, 10)):
                wrapped(x + dx, y, rng.choice(('road_hi', 'road', 'sand_lo')))
    else:
        for _ in range(65):
            x, y = rng.randrange(63), rng.randrange(63)
            shade = rng.choice(('dust', 'dust_hi'))
            for dx, dy in ((0, 0), (1, 0), (2, 0), (1, 1)):
                wrapped(x + dx, y + dy, shade)
    # Three quiet hand-authored crack systems, including a seam crossing.
    paths = [[(7, 11), (12, 11), (15, 14), (19, 14)],
             [(12, 11), (12, 8)], [(15, 14), (15, 17), (17, 19)],
             [(40, 38), (45, 38), (49, 42), (54, 42)],
             [(45, 38), (45, 34), (43, 32)], [(49, 42), (49, 46)],
             [(59, 54), (64, 54), (67, 57), (70, 57)]]
    for points in paths:
        for (x0, y0), (x1, y1) in zip(points, points[1:]):
            steps = max(abs(x1 - x0), abs(y1 - y0))
            for i in range(steps + 1):
                wrapped(x0 + (x1 - x0) * i // steps,
                        y0 + (y1 - y0) * i // steps,
                        'road_dark' if road else 'dust_dark')
    for _ in range(22):
        x, y = rng.randrange(63), rng.randrange(63)
        wrapped(x, y, 'sand_lo' if road else 'dust_dark')
        wrapped(x + 1, y, 'sand_lo' if road else 'dust_dark')
        wrapped(x, y - 1, 'road_hi' if road else 'dust_hi')
    for y in range(63):
        c.im.putpixel((63, y), c.im.getpixel((0, y)))
    for x in range(64):
        c.im.putpixel((x, 63), c.im.getpixel((x, 0)))
    return c.im


def icon(kind):
    c = Canvas((16, 16))
    if kind == 'core':
        c.poly([(5, 2), (10, 2), (14, 6), (14, 9), (10, 13),
                (5, 13), (1, 9), (1, 6)], 'sand')
        c.line([(2, 6), (5, 3), (9, 3)], 'ivory')
        c.line([(5, 12), (10, 12), (13, 9)], 'metal')
        c.poly([(6, 4), (9, 4), (12, 7), (12, 8), (9, 11),
                (6, 11), (3, 8), (3, 7)], 'cyan_dark')
        c.poly([(6, 5), (8, 5), (10, 7), (8, 10), (5, 8)], 'cyan', None)
        c.line([(6, 7), (7, 6)], 'ivory')
    elif kind == 'cargo':
        c.poly([(2, 2), (13, 2), (14, 3), (14, 12), (13, 13),
                (2, 13), (1, 12), (1, 3)], 'sand')
        c.line([(2, 11), (2, 3), (12, 3)], 'ivory')
        for x in (4, 11):
            c.line([(x, 3), (x, 12)], 'dark')
        c.rect((6, 5, 9, 10), 'ivory', 'ink')
        c.line([(5, 11), (10, 4)], 'rust_dark')
    elif kind == 'dash':
        c.poly([(6, 1), (9, 1), (15, 7), (15, 8), (9, 14),
                (6, 14), (11, 8), (11, 7)], 'sand')
        c.line([(8, 2), (9, 2), (13, 6)], 'ivory')
        c.line([(8, 12), (12, 8)], 'orange')
        for x, y, w in ((0, 3, 4), (2, 7, 5), (0, 11, 4)):
            c.rect((x, y, x + w, y + 2), 'ink')
            c.line([(x + 1, y + 1), (x + w - 1, y + 1)], 'ivory')
    elif kind == 'hp':
        c.poly([(5, 1), (10, 1), (10, 5), (14, 5), (14, 10),
                (10, 10), (10, 14), (5, 14), (5, 10), (1, 10),
                (1, 5), (5, 5)], 'ivory')
        c.line([(6, 13), (9, 13), (9, 9), (13, 9), (13, 6)], 'sand')
        c.line([(2, 9), (2, 6), (6, 6), (6, 2), (9, 2)], 'white')
    else:
        c.panel((3, 8, 7, 13), 'sand', 'ivory', 'metal')
        if kind == 'shotgun':
            for y in (3, 8):
                c.panel((6, y, 14, y + 3), 'sand', 'ivory', 'metal')
                c.line([(12, y + 1), (12, y + 2)], 'ink')
            c.panel((1, 5, 6, 11), 'sand', 'ivory', 'metal')
            c.line([(4, 6), (4, 9)], 'dark')
        else:
            c.panel((5, 5, 14, 8), 'sand', 'ivory', 'metal')
            c.panel((1, 4, 8, 10), 'sand', 'ivory', 'metal')
            if kind == 'mg':
                c.panel((12, 3, 15, 9), 'sand', 'ivory', 'metal')
                c.line([(3, 6), (5, 6)], 'ink')
                c.dot(7, 5, 'orange')
            elif kind == 'laser':
                for x in (4, 7):
                    c.line([(x, 6), (x, 8)], 'dark')
                c.line([(9, 6), (12, 6)], 'cyan')
                c.panel((12, 3, 15, 10), 'steel', 'metal', 'dark')
                c.line([(14, 5), (14, 8)], 'cyan')
            else:
                c.panel((4, 4, 12, 10), 'sand', 'ivory', 'metal')
                for x in (7, 10):
                    c.line([(x, 5), (x, 9)], 'dark')
                c.panel((12, 2, 15, 11), 'steel', 'metal', 'dark')
                c.line([(14, 4), (14, 9)], 'orange')
    return c.im


def make_sprites():
    images = {}
    for variant in ('blue', 'pink', 'paint'):
        images[f'bike_{variant}'] = bike(variant)
    for fn in (raider, drone, boss, truck, turret, cargo, core, repair_kit,
               target, rocket, station, evac, terminal, wall_block):
        images[fn.__name__] = fn()
    for kind in ('mg', 'shotgun', 'laser', 'rocket'):
        images[f'turret_{kind}'] = gun(kind)
    images['ground_sand'] = ground()
    images['ground_road'] = ground(road=True)
    for kind in ('cargo', 'dash', 'hp', 'laser', 'mg', 'rocket', 'shotgun', 'core'):
        images[f'icon_{kind}'] = icon(kind)
    return {name: images[name] for name in SIZES}


def bitmap_text(image, xy, text, fill='ivory', scale=1):
    # Pillow's bundled bitmap font, drawn in mode 1: even labels have no AA.
    font = ImageFont.load_default_imagefont()
    bounds = font.getbbox(text)
    mask = Image.new('1', (bounds[2] + 1, max(12, bounds[3] + 1)))
    ImageDraw.Draw(mask).text((0, 0), text, font=font, fill=1)
    mask = mask.resize((mask.width * scale, mask.height * scale), Image.Resampling.NEAREST)
    image.paste(color(fill), (xy[0], xy[1], xy[0] + mask.width, xy[1] + mask.height), mask)


def contact_sheet(images):
    sheet = Image.new('RGB', (1408, 1460), color('ink'))
    d = ImageDraw.Draw(sheet)
    bitmap_text(sheet, (24, 14), 'NOT YOUR CARGO / STEPPE MOTOR POOL', 'ivory', 3)
    bitmap_text(sheet, (25, 55), '31 ORIGINAL PIXEL SPRITES  /  EXACT 4X NEAREST  /  LIGHT: UPPER LEFT', 'sand', 1)
    d.line((24, 78, 1383, 78), fill=color('orange'), width=2)

    def card(name, box):
        x, y, w, h = box
        d.rectangle((x, y, x + w - 1, y + h - 1), outline=color('dark'))
        preview = images[name].resize((images[name].width * 4, images[name].height * 4), Image.Resampling.NEAREST)
        px, py = x + (w - preview.width) // 2, y + (h - 34 - preview.height) // 2
        sheet.paste(preview, (px, py), preview)
        bitmap_text(sheet, (x + 12, y + h - 29), name, 'ivory')
        bitmap_text(sheet, (x + 12, y + h - 16), f'{images[name].width}x{images[name].height} / +x', 'sand_lo')

    for name, x, w in [('station', 24, 336), ('evac', 368, 336),
                       ('ground_sand', 712, 328), ('ground_road', 1048, 336)]:
        card(name, (x, 96, w, 370))
    bitmap_text(sheet, (24, 482), '01 / VEHICLES - HOVER SHOES, ARMOUR, AND QUESTIONABLE INSURANCE', 'orange')
    for name, x, w in [('boss', 24, 276), ('truck', 308, 248),
                       ('bike_blue', 564, 156), ('bike_pink', 728, 156),
                       ('bike_paint', 892, 156), ('raider', 1056, 156), ('drone', 1220, 164)]:
        card(name, (x, 504, w, 244))
    bitmap_text(sheet, (24, 765), '02 / HARDWARE - LEFT-END GUN BEARINGS; TURRET IS A SEPARATE BASE', 'orange')
    for i, name in enumerate(('wall_block', 'terminal', 'turret', 'turret_mg',
                              'turret_shotgun', 'turret_laser', 'turret_rocket')):
        card(name, (24 + i * 195, 788, 187, 174))
    bitmap_text(sheet, (24, 980), '03 / FIELD SUPPLIES - NO REFUNDS, EVEN IF STILL RADIOACTIVE', 'orange')
    for i, name in enumerate(('cargo', 'core', 'repair_kit', 'target', 'rocket')):
        card(name, (24 + i * 195, 1004, 187, 142))
    bitmap_text(sheet, (24, 1165), '04 / HUD - SMALL SYMBOLS, LARGE LIABILITIES', 'orange')
    for i, kind in enumerate(('cargo', 'dash', 'hp', 'laser', 'mg', 'rocket', 'shotgun', 'core')):
        card(f'icon_{kind}', (24 + i * 171, 1188, 163, 140))
    swatches = ('ink', 'dark', 'steel', 'metal', 'ivory', 'sand', 'rust_dark',
                'rust', 'orange', 'yellow', 'red', 'cyan_dark', 'cyan', 'blue', 'pink')
    for i, shade in enumerate(swatches):
        d.rectangle((24 + i * 30, 1350, 47 + i * 30, 1364), fill=color(shade), outline=color('steel'))
    bitmap_text(sheet, (24, 1380), 'NATIVE GRID FIRST. NO FILTERS. NO VECTOR RASTERIZATION. NO SMOOTH EDGES.', 'sand')
    bitmap_text(sheet, (24, 1400), 'SEAM TESTS + EXACT PALETTE COUNTS: REPORT.md / REGENERATE: python gen_pixel.py', 'sand_lo')
    sheet.save(ROOT / 'contact-sheet.png')


def report(images):
    lines = [
        '# NOT YOUR CARGO â€” pixel sprite set', '',
        '31 native sprites, 31 nearest-neighbour 4x previews, and `contact-sheet.png`.',
        'Generated directly beside `gen_pixel.py`; requires Python 3.9+ and Pillow 10.1+.',
        'Run `python gen_pixel.py`, then `python -m unittest discover -s . -p "test_*.py"`.', '',
        'The brief names **30** sprites despite asking for 31. All 30 named sprites are '
        'included; **`icon_core` is a bonus HUD energy-core icon** to reach 31 pairs.', '',
        '## Placement and reference notes', '',
        'The requested absolute destination is outside this agent\'s permitted workspace. '
        'Files were therefore written to the checkout\'s `pixel-staging/`, not the requested '
        'Documents folder. No links or `out/` folder were used. The 30 same-name SVGs in '
        '`game/src/modules/not-your-cargo/assets/sprites/` were read and left unchanged; '
        'the external copy could not be compared under the workspace restriction.', '',
        'All art is authored at native resolution with integer pixel geometry. Vehicles '
        'and weapon muzzles face right. Gun pivots are (4, 4) for MG/laser and (4, 5) '
        'for shotgun/rocket. `turret` is deliberately a gunless base as requested, '
        'rather than copying the reference\'s integrated barrel. `bike_paint` uses '
        'achromatic fills with the shared graphite outline for tinting. Repair supplies '
        'use graphite/ivory rather than introducing the reference\'s green.', '',
        'Sand, dirt road and wall fill their tiles; other sprites have transparent '
        'surroundings. The evac landing area remains transparent. Road wear runs along '
        '+x. Both opposite edges match exactly on all three tiles. Tile surfaces '
        'intentionally omit object-style outlines around individual sand grains.', '',
        '## Palette counts', '',
        'Counts below are distinct **opaque RGB colours**, followed by total RGBA values '
        '(including full transparency where present). Native and 4x counts are identical. '
        'Every RGB value belongs to the explicit generator palette. No partial alpha.', '',
        '| Sprite | Native | 4x | Opaque colours | RGBA values |',
        '|---|---:|---:|---:|---:|',
    ]
    for name, im in images.items():
        colors = {p for _, p in im.getcolors(im.width * im.height)}
        opaque = sum(p[3] == 255 for p in colors)
        w, h = im.size
        lines.append(f'| {name} | {w}x{h} | {w * 4}x{h * 4} | {opaque} | {len(colors)} |')
    lines += [
        '', '## Art review / weaker assets', '',
        '- Strongest design intent: the paired hover shoes and interchangeable bike '
        'liveries; ribbed convoy container; relay dish and patched solar banks.',
        '- `rocket` is the weakest: at 12x5 its outline leaves only a one-pixel payload '
        'interior. It reads as a projectile, but cannot support full material ramps.',
        '- `turret_shotgun` and the small weapon icons sacrifice wear and bevel detail '
        'for muzzle separation. The 16px laser/MG silhouettes are similar; emitter '
        'colour and muzzle shape carry the distinction.',
        '- `evac` is intentionally sparse to preserve the reference\'s open landing '
        'area; its repeating ring is more utilitarian than the station.',
        '- Dark humour is modest: crossed-out consignment labels, a skull interceptor, '
        'a sad offline terminal and a training target hit everywhere but the bullseye. '
        'There is no illegible pretend lettering baked into the sprites.',
        '- These are design-level assessments, not a claim of a rendered human review. '
        'No in-engine or human visual review was performed; inspect `contact-sheet.png`.', '',
        '## Verification', '',
        'The generator checks inventory, dimensions, RGBA mode, explicit palette '
        'membership, at most 32 colours including transparency, binary alpha and '
        'opposite tile edges before saving. The independent unittest suite additionally '
        'reopens every PNG, verifies every 4x pixel block, image inventory, bike masks, '
        'open evac centre and contact-sheet dimensions/palette. Test execution results '
        'are recorded in the task handoff rather than asserted by this generated file.',
    ]
    (ROOT / 'REPORT.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')


def validate(images):
    assert set(images) == set(SIZES) and len(images) == 31
    allowed = {(*Image.new('RGB', (1, 1), v).getpixel((0, 0)), 255) for v in PALETTE.values()}
    allowed.add((0, 0, 0, 0))
    for name, im in images.items():
        assert im.mode == 'RGBA' and im.size == SIZES[name], name
        colors = {p for _, p in im.getcolors(im.width * im.height)}
        assert colors <= allowed and len(colors) <= 32, (name, colors - allowed)
    for name in ('ground_sand', 'ground_road', 'wall_block'):
        im = images[name]
        w, h = im.size
        assert all(im.getpixel((0, y)) == im.getpixel((w - 1, y)) for y in range(h)), name
        assert all(im.getpixel((x, 0)) == im.getpixel((x, h - 1)) for x in range(w)), name
        assert im.getchannel('A').getextrema() == (255, 255), name


def main():
    images = make_sprites()
    validate(images)
    for name, im in images.items():
        im.save(ROOT / f'{name}.png')
        im.resize((im.width * 4, im.height * 4), Image.Resampling.NEAREST).save(ROOT / f'{name}@4x.png')
    contact_sheet(images)
    report(images)
    for name, im in images.items():
        colors = {p for _, p in im.getcolors(im.width * im.height)}
        print(f'{name:16} {im.width:2}x{im.height:<2} -> {im.width * 4:3}x{im.height * 4:<3} '
              f'{sum(p[3] == 255 for p in colors):2} opaque / {len(colors):2} RGBA colours')
    print('Saved 62 sprite PNGs, contact-sheet.png and REPORT.md beside gen_pixel.py.')


if __name__ == '__main__':
    main()
