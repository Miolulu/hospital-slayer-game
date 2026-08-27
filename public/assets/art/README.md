# AI Art Asset Slots

Generated and approved raster assets belong here. Runtime code must reference files from `/assets/art/`; generated files must not remain only in a temporary image-generation directory.

See `../../../ART_DIRECTION.md` for filenames, palette and prompting constraints.

## Company API generation batch

Generated on 2026-08-13 through the company gateway with `gpt-image-2`.
Source prompts are preserved in:

- `../../../../tmp/imagegen/core-assets.jsonl`
- `../../../../tmp/imagegen/relic-assets.jsonl`

Runtime assets currently include three scene backgrounds, the unnamed black cat
alchemist, two transformation armors, the Moon-Swallowing Dire Wolf boss, and
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
