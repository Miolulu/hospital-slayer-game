# AI Art Asset Slots

Generated and approved raster assets belong here. Runtime code must reference files from `/assets/art/`; generated files must not remain only in a temporary image-generation directory.

See `../../../ART_DIRECTION.md` for filenames, palette and prompting constraints.

## Company API generation batch

Generated on 2026-08-13 through the company gateway with `gpt-image-2`.
Source prompts are preserved in:

- `../../../../tmp/imagegen/core-assets.jsonl`
- `../../../../tmp/imagegen/relic-assets.jsonl`

Runtime assets currently include three scene backgrounds, the unnamed black cat
alchemist, two transformation armors, the Moon-Eclipsed Moth Queen boss, and
seven standalone irregular relic objects. Character and relic sources were
locally keyed, alpha-checked, cropped, and WebP-optimized before integration.

The `patient-boy.png` sprite is the compact Q-style protagonist in a basic
hospital uniform. The battle scene, patient file, and boy's dialogue portrait
all use this asset key so it can be replaced without changing scene layout.

Directional walk cycles are stored as `animations/patient-walk-left.png`,
`patient-walk-right.png`, `patient-walk-up.png`, and `patient-walk-down.png`.
Each sheet contains four 192x192 frames with a shared foot baseline. Matching
GIF previews and numbered single-frame PNGs are kept beside each sheet for
visual review. The independent `animations/patient-idle-front.png` is the
front-facing neutral pose used whenever the player is not moving. Runtime
selects the sheet from the movement vector's dominant axis, and the left/right
cycles use four explicit contact, passing and opposite-contact poses with
alternating leg positions instead of scaling the whole sprite. Each frame is
rebuilt from the untouched transparent source so moved pixels cannot create an
opaque black block.

## Weapon sprite slots

The four supplied base weapon images are cleaned with edge-connected background removal and normalized to 160x160 transparent PNGs:

- `weapons/weapon-sword.png` - base sword image for `sword` weapons
- `weapons/weapon-gun.png` - base gun image for `gun` weapons
- `weapons/weapon-whip.png` - base whip image for `whip` weapons
- `weapons/weapon-cannon.png` - base cannon image for `cannon` weapons

The runtime maps every weapon class to its slot. The same asset is used by the orbiting battle weapon, weapon selection cards and the battle HUD icon. Keep the 160x160 canvas and transparent padding when replacing a slot so the orbit anchor remains stable.

## Weapon skin batches

The weapon-select shop now loads the remake batch under `weapon-select/` and groups it by weapon class:

- `sword`: refreshed `cthulhu`, `fairytale`, `hero-tech`; new `black-tide`, `old-god-ritual`, `abyss-mouth`, `moon-moth-queen`, `moon-moth-queen-gala`
- `gun`: refreshed `cthulhu`, `fairytale`; new `ritual-relic`, `cthulhu-eye`, `abyss-machinery`, `moon-moth-queen`, `moon-moth-queen-gala`
- `whip`: refreshed `cthulhu`, `fairytale`; new `bone-scale`, `living-crown`, `prism-energy`
- `cannon`: refreshed `cthulhu`, `fairytale`; new `old-god-ring`, `cthulhu-eye`, `abyss-maw`

## Combat feedback slots

- `pickups/xp-drop-cthulhu-v1.png` - Cthulhu-style experience pickup with an eye core.
- `hud/san-frenzy-v1.png` - SAN collapse and manual frenzy skill icon.

Both assets use transparent square canvases and are displayed at runtime size. The battle scene keeps a geometric fallback when an asset cannot be loaded.

## Small enemy attack slots

The six small enemy kinds now use bitmap attack effects instead of vector placeholders:

- `enemies/patients/attacks/chaser-attack.png`
- `enemies/patients/attacks/shooter-attack.png`
- `enemies/patients/attacks/disruptor-attack.png`
- `enemies/patients/attacks/tentacle-attack.png`
- `enemies/patients/attacks/bomber-attack.png`
- `enemies/patients/attacks/eye-attack.png`

These files are loaded directly by the battle scene and tinted or scaled at runtime as needed for warnings, projectiles and impact flashes.

首领资源槽位：

- `enemies/bosses/pill-mouth/*`、`enemies/bosses/bed-boss/*`、`enemies/bosses/mercury-thermometer/*` - 第 10 波小首领的三套随机动效。
- `enemies/bosses/mini-boss-01.png` - 旧版第 10 波小首领兜底图。
- `enemies/bosses/moon-moth-queen/portrait.png` - 月蚀蝶后立绘。
- `enemies/bosses/moon-moth-queen/death.png` - 月蚀蝶后倒地图。
- `enemies/bosses/moon-moth-queen/walk.png` - 月蚀蝶后移动动效。
- `enemies/bosses/moon-moth-queen/attack.png` - 月蚀蝶后攻击动效。
- `enemies/bosses/moon-moth-queen/transform-1.png` 到 `transform-5.png` - 出场变身动效。

月蚀蝶后资源按原始尺寸接入，战斗里会按状态切换立绘、变身、移动、攻击和倒地表现。资源未加载时保留原有几何首领作为兜底。

## Upgrade card slots

The vertical Cthulhu card frames are kept at their source 1024x1536 ratio and selected by upgrade quality:

- `cards/upgrade-card-blue-v1.png` - level 1 / blue quality
- `cards/upgrade-card-purple-v1.png` - level 2 / purple quality
- `cards/upgrade-card-gold-v1.png` - level 3 / gold quality

The upgrade scene draws each type icon into the circular opening and places the title and detail text inside the lower panel. The supplied idle, background and selected-state composition references are archived under `.game-dev/evidence/card-art-references/` and are not loaded at runtime.

## Main menu slots

The main menu uses the supplied hospital background and title artwork. The no-text button sheet was split into three transparent 1024x512 PNGs and is rendered with runtime labels:

- `menu/menu-background-v1.png` - full-screen title background
- `menu/menu-title-v1.png` - cropped title artwork without the sample buttons
- `menu/menu-button-archive-v1.png` - patient records entry
- `menu/menu-button-mainline-v1.png` - mainline entry
- `menu/menu-button-daily-v1.png` - daily challenge entry

## Mainline floor slots

The mainline tower is assembled from one reusable exterior module per floor.
The module and all four window states share a fixed display box so new floors
can be appended without redrawing the building:

- `mainline-building-floor-shell-v1.png` - one modern hospital facade floor shell.
- `mainline-floor-select-background-v1.png` - level-selection backdrop with a left-aligned tower and quiet right side.
- `mainline-floor-locked-v1.png` - locked, unselected window.
- `mainline-floor-locked-selected-v1.png` - locked, selected window.
- `mainline-floor-unlocked-v1.png` - unlocked, unselected room perspective.
- `mainline-floor-selected-v1.png` - unlocked, selected room perspective with lights on.
- `mainline-floor-enemy-frame-v1.png` - reusable Cthulhu pixel frame for floor enemy previews.
