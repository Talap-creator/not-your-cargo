# NOT YOUR CARGO — sprite assets

Hand-written SVG, original, licence: project-owned.

Chunky overhead artwork with dark outlines and the project palette. All SVGs are standalone, contain no text, fonts, external resources or gradients, and are under 6 KB. Backgrounds are transparent except the three fully opaque tiles.

Open `contact-sheet.html` directly in a browser: every file is shown on graphite and sand at 2× its native dimensions. The bottom section repeats each terrain tile at 2× for seam review. Browser zoom should be 100% to judge CSS pixel sizes.

## Coordinates and pivots

Coordinates below are SVG/viewBox units, measured from the top-left. Forward is **right (+x), angle 0**. Vehicles, weapons, the dish feed arm and dash arrow follow this convention. Crates, health symbols and terrain are non-directional overhead objects, not perspective drawings. Rotate around the listed pivot, not automatically around the center of a turret's bounding box.

| File | viewBox | Pivot / placement notes |
| --- | --- | --- |
| `bike_blue.svg` | `0 0 64 48` | Hull center `(32,24)`; suggested turret mount `(28,24)`; no built-in gun. |
| `bike_pink.svg` | `0 0 64 48` | Same geometry and pivots as blue, pink accent replacement only. |
| `turret_mg.svg` | `0 0 48 16` | Bearing pivot **`(8,8)`**; muzzle at `(46,8)`, long single barrel. |
| `turret_shotgun.svg` | `0 0 48 20` | Bearing pivot **`(8,10)`**; muzzles at `(41,5.5)` and `(41,14.5)`, short double barrel. |
| `raider.svg` | `0 0 48 48` | Center `(24,24)`; integrated gun exits near `(46,24)`; rust-red armor and spikes. |
| `cargo.svg` | `0 0 32 32` | Center `(16,16)`; orange container, one puncture, slashed-label brand symbol. |
| `repair_kit.svg` | `0 0 32 32` | Center `(16,16)`; green supply crate with ivory cross. |
| `target.svg` | `0 0 40 40` | Bullseye `(20,20)`; horizontal red/ivory plate over a support footprint. |
| `wall_block.svg` | `0 0 64 64` | Tile origin `(0,0)`; matching metal edge bands, concrete inset and rust. |
| `ground_sand.svg` | `0 0 128 128` | Tile origin `(0,0)`; matching flat edges, low-contrast cracks and pebbles. |
| `ground_road.svg` | `0 0 128 128` | Tile origin `(0,0)`; wear runs along +x and continues across the x seam; y edges match. |
| `station.svg` | `0 0 160 160` | Pad center `(80,80)`; dish center `(61,80)`; feed arm and entry chevron point right. |
| `icon_mg.svg` | `0 0 24 24` | UI center `(12,12)`; right-facing single-barrel weapon. |
| `icon_shotgun.svg` | `0 0 24 24` | UI center `(12,12)`; right-facing double-barrel weapon. |
| `icon_dash.svg` | `0 0 24 24` | UI center `(12,12)`; right-facing dash chevron and speed marks. |
| `icon_cargo.svg` | `0 0 24 24` | UI center `(12,12)`; ivory container with slashed label. |
| `icon_hp.svg` | `0 0 24 24` | UI center `(12,12)`; ivory health cross. |

To attach a turret, translate to the hull's mount, apply the desired turret rotation, then draw the turret offset by its negative bearing pivot. Normalize pivots by viewBox width/height if the engine uses normalized anchors. Muzzle coordinates describe artwork, not collision bounds.

Tiles repeat in both axes with no transparent gutters. Use their exact native dimensions (or integer multiples) and disable texture-atlas bleeding in the game renderer. Road and sand are separate repeating surfaces, not transition-edge tiles.

## Validation

The set was checked using Python's XML parser for standalone SVG roots, exact viewBoxes, dimensions, inventory, palette and byte limits. Contact-sheet image references and 2× dimensions were checked as well. Browser/raster visual review was not run: no local Playwright, Puppeteer, resvg, Sharp or CairoSVG package was available. The contact sheet is provided for that review. To recheck basic XML and size constraints from the assets directory:

```bash
python - <<'PY'
from pathlib import Path
import xml.etree.ElementTree as ET
files = sorted(Path('sprites').glob('*.svg'))
assert len(files) == 29
for path in files:
    root = ET.parse(path).getroot()
    assert root.tag == '{http://www.w3.org/2000/svg}svg'
    assert path.stat().st_size < 6000
    print(path.name, root.attrib['viewBox'], path.stat().st_size)
PY
```

## Additional sprites

Original hand-written additions using the same 2-unit dark outlines, flat palette and right-facing convention. Glow is represented by flat bright accents, without filters or gradients.

| File | viewBox | Pivot / placement notes |
| --- | --- | --- |
| `turret.svg` | `0 0 48 48` | Base center `(23,24)`; stationary rust-red gun, muzzle at `(46,24)`. |
| `drone.svg` | `0 0 40 40` | Center `(20,20)`; four rotors, orange eye on the right-facing nose. |
| `boss.svg` | `0 0 128 96` | Hull center `(64,48)`; right-facing interceptor with rocket pods along both flanks. |
| `truck.svg` | `0 0 112 56` | Center `(56,28)`; orange container bed, friendly graphite cab at the right end. |
| `terminal.svg` | `0 0 48 48` | Center `(24,24)`; cyan display with controls along its right edge. |
| `core.svg` | `0 0 32 32` | Center `(16,16)`; sealed orange canister, cyan energy window. |
| `evac.svg` | `0 0 160 160` | Pad center `(80,80)`; orange hazard ring, ivory circle marker, transparent landing area. |
| `turret_laser.svg` | `0 0 48 16` | Bearing pivot **`(8,8)`**; right-facing emitter, cyan tip at `(44,8)`. |
| `turret_rocket.svg` | `0 0 48 20` | Bearing pivot **`(8,10)`**; right-facing launcher, muzzle at `(46,10)`. |
| `rocket.svg` | `0 0 24 10` | Center `(12,5)`; nose at `(22,5)`, orange exhaust to the left. |
| `icon_laser.svg` | `0 0 24 24` | UI center `(12,12)`; ivory right-facing laser emitter on transparent. |
| `icon_rocket.svg` | `0 0 24 24` | UI center `(12,12)`; ivory right-facing rocket launcher on transparent. |
