# 美术素材接入记录

本次新增四张克苏鲁像素风素材，均为透明背景 PNG，运行时从 `/assets/art/` 加载。

| 文件 | 用途 | 接入位置 |
| --- | --- | --- |
| `public/assets/art/pickups/xp-drop-cthulhu-v1.png` | 经验掉落物 | 战斗场景 `drop()` |
| `public/assets/art/hud/san-frenzy-v1.png` | SAN 归零后的暴走技能图标 | 战斗 HUD `skillIcon` |
| `public/assets/art/enemies/bosses/mini-boss-01.png` | 第 7 波小首领 | `spawnWaveEnemy()` 首领渲染分支 |
| `public/assets/art/enemies/bosses/floor-boss-01.png` | 楼层首领 | `spawnWaveEnemy()` 首领渲染分支 |

经验掉落物显示为青绿色晶体和眼状核心，暴走图标显示为紫蓝色符文和触手。小首领使用紫红色异化病患形象，楼层首领使用月蚀狼与触手融合形象。四张图都保留几何图形兜底，资源加载失败时仍可正常战斗。

首领素材统一为 512x512、32 位带 alpha 的 PNG，边角透明，运行时按小首领和楼层首领分别缩放到 164px 与 216px。
