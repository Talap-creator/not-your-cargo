# NOT YOUR CARGO â€” pixel sprite set

31 native sprites, 31 nearest-neighbour 4x previews, and `contact-sheet.png`.
Generated directly beside `gen_pixel.py`; requires Python 3.9+ and Pillow 10.1+.
Run `python gen_pixel.py`, then `python -m unittest discover -s . -p "test_*.py"`.

The brief names **30** sprites despite asking for 31. All 30 named sprites are included; **`icon_core` is a bonus HUD energy-core icon** to reach 31 pairs.

## Placement and reference notes

The requested absolute destination is outside this agent's permitted workspace. Files were therefore written to the checkout's `pixel-staging/`, not the requested Documents folder. No links or `out/` folder were used. The 30 same-name SVGs in `game/src/modules/not-your-cargo/assets/sprites/` were read and left unchanged; the external copy could not be compared under the workspace restriction.

All art is authored at native resolution with integer pixel geometry. Vehicles and weapon muzzles face right. Gun pivots are (4, 4) for MG/laser and (4, 5) for shotgun/rocket. `turret` is deliberately a gunless base as requested, rather than copying the reference's integrated barrel. `bike_paint` uses achromatic fills with the shared graphite outline for tinting. Repair supplies use graphite/ivory rather than introducing the reference's green.

Sand, dirt road and wall fill their tiles; other sprites have transparent surroundings. The evac landing area remains transparent. Road wear runs along +x. Both opposite edges match exactly on all three tiles. Tile surfaces intentionally omit object-style outlines around individual sand grains.

## Palette counts

Counts below are distinct **opaque RGB colours**, followed by total RGBA values (including full transparency where present). Native and 4x counts are identical. Every RGB value belongs to the explicit generator palette. No partial alpha.

| Sprite | Native | 4x | Opaque colours | RGBA values |
|---|---:|---:|---:|---:|
| bike_blue | 32x24 | 128x96 | 10 | 11 |
| bike_pink | 32x24 | 128x96 | 10 | 11 |
| bike_paint | 32x24 | 128x96 | 5 | 6 |
| raider | 24x24 | 96x96 | 10 | 11 |
| drone | 20x20 | 80x80 | 10 | 11 |
| boss | 64x48 | 256x192 | 13 | 14 |
| truck | 56x28 | 224x112 | 17 | 18 |
| turret | 24x24 | 96x96 | 9 | 10 |
| turret_mg | 24x8 | 96x32 | 7 | 8 |
| turret_shotgun | 24x10 | 96x40 | 9 | 10 |
| turret_laser | 24x8 | 96x32 | 7 | 8 |
| turret_rocket | 24x10 | 96x40 | 8 | 9 |
| cargo | 16x16 | 64x64 | 10 | 11 |
| core | 16x16 | 64x64 | 11 | 12 |
| repair_kit | 16x16 | 64x64 | 8 | 9 |
| target | 20x20 | 80x80 | 7 | 8 |
| rocket | 12x5 | 48x20 | 6 | 7 |
| station | 80x80 | 320x320 | 17 | 18 |
| evac | 80x80 | 320x320 | 11 | 12 |
| terminal | 24x24 | 96x96 | 11 | 12 |
| wall_block | 32x32 | 128x128 | 9 | 9 |
| ground_sand | 64x64 | 256x256 | 4 | 4 |
| ground_road | 64x64 | 256x256 | 4 | 4 |
| icon_cargo | 16x16 | 64x64 | 5 | 6 |
| icon_dash | 16x16 | 64x64 | 4 | 5 |
| icon_hp | 16x16 | 64x64 | 4 | 5 |
| icon_laser | 16x16 | 64x64 | 6 | 7 |
| icon_mg | 16x16 | 64x64 | 5 | 6 |
| icon_rocket | 16x16 | 64x64 | 6 | 7 |
| icon_shotgun | 16x16 | 64x64 | 5 | 6 |
| icon_core | 16x16 | 64x64 | 6 | 7 |

## Art review / weaker assets

- Strongest design intent: the paired hover shoes and interchangeable bike liveries; ribbed convoy container; relay dish and patched solar banks.
- `rocket` is the weakest: at 12x5 its outline leaves only a one-pixel payload interior. It reads as a projectile, but cannot support full material ramps.
- `turret_shotgun` and the small weapon icons sacrifice wear and bevel detail for muzzle separation. The 16px laser/MG silhouettes are similar; emitter colour and muzzle shape carry the distinction.
- `evac` is intentionally sparse to preserve the reference's open landing area; its repeating ring is more utilitarian than the station.
- Dark humour is modest: crossed-out consignment labels, a skull interceptor, a sad offline terminal and a training target hit everywhere but the bullseye. There is no illegible pretend lettering baked into the sprites.
- These are design-level assessments, not a claim of a rendered human review. No in-engine or human visual review was performed; inspect `contact-sheet.png`.

## Verification

The generator checks inventory, dimensions, RGBA mode, explicit palette membership, at most 32 colours including transparency, binary alpha and opposite tile edges before saving. The independent unittest suite additionally reopens every PNG, verifies every 4x pixel block, image inventory, bike masks, open evac centre and contact-sheet dimensions/palette. Test execution results are recorded in the task handoff rather than asserted by this generated file.
