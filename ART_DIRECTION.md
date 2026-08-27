# 《魔药炼装》视觉规范 v1

## 核心风格

黑暗童话剪纸 × 特摄英雄炼装 × 黄铜炼金术。

- 轮廓优先：角色、遗物、敌人必须在 96px 高度仍可凭剪影辨认。
- 材质统一：旧羊皮纸、烟熏木、氧化黄铜、釉面魔药玻璃、黑色呢绒。
- 光源统一：主光来自坩埚下方的青绿魔火，危险与必杀使用朱红逆光。
- 细节尺度：不做写实毛发和高频碎纹，避免移动屏缩小后变脏。
- 童话来源：使用红帽、木偶、魔豆、月狼、黑线、云冠等原型，不复刻现成影视角色。

## 色彩系统

| 用途 | 色值 | 说明 |
| --- | --- | --- |
| 夜幕黑 | `#090B10` | 全局背景与遮罩 |
| 墨紫黑 | `#17131D` | 工作台、弹窗、暗部 |
| 羊皮纸 | `#E5D8B8` | 童话书与主要文字 |
| 黄铜金 | `#D2A950` | 边框、可交互焦点、评级 |
| 魔火青 | `#59BDA8` | 共鸣、搅拌、友方技能 |
| 猩红 | `#C93648` | 红帽、危险、必杀 |
| 月牙蓝 | `#76ADB8` | 闪避、月狼遗物 |
| 谎言紫 | `#815A9B` | 控制、黑线遗物 |

同一画面中，羊皮纸或夜幕黑承担 60% 以上面积；黄铜金只用于边缘和状态；猩红、魔火青作为互补强调色。禁止大面积蓝紫渐变和现代霓虹赛博风。

## UI 语言

- 页面结构像一本被污染的童话书或炼金术工作台，不使用卡片墙。
- 按钮使用 1px 黄铜描边、直角或 4px 内圆角、深色半透明底。
- 图标优先，命令文字保持 2-6 个汉字；危险操作必须二次确认。
- 可操作物必须有稳定命中区、名称、选中光环和状态反馈。
- 字体使用清晰黑体；标题通过字号、颜色和留白建立层级，不使用负字距。

## 角色与怪物

- 无名黑猫药师：性别未知，短斗篷、尖耳剪影、黄铜护目镜、琥珀眼；不是萌宠比例。
- 炼装：保持黑猫耳形头盔这一身份锚点，再混合两件童话遗物的轮廓语言。
- 怪物：黑色童话剪影为主体，局部用章节色揭示眼睛、裂纹、角、丝线或藤蔓。
- 自动战斗：普通攻击保持方向清楚；技能演出允许全屏遮罩、速度线、冲击闪白与大字招式名。

## 首批 AI 位图资产

1. `workshop-background.webp`：横屏女巫塔炼药房，无角色、无文字，中央坩埚留位。
2. `storybook-background.webp`：打开的污染童话书置于黑森林，无文字、无 UI。
3. `forest-red-background.webp`：迷途红林战斗背景，左右角色区保持可读。
4. `cat-alchemist.webp`：无名黑猫药师半身/全身透明切图。
5. `relic-sheet.webp`：六件异形遗物统一透视和材质的图标表。
6. `armor-scarlet-string.webp`、`armor-thorn-wolf.webp`：首批两套炼装透明角色立绘。
7. `boss-moon-wolf.webp`：吞月巨狼透明怪物立绘。
8. `patient-boy.png`：基础病号服小男孩的 Q 版像素透明立绘，供战斗、对白和患者档案共用。
9. `animations/patient-walk-{left,right,up,down}.png`：四向四帧步行精灵图，保持同一脸型、病号服、比例与脚底锚点；对应 GIF 和单帧 PNG 用于验收与替换。`animations/patient-idle-front.png` 是停止移动时使用的正面静止帧。

## 生图通用约束

无文字、无水印、无 UI、无现成 IP 标志；横屏游戏资产；清晰轮廓；有限色盘；绘本级笔触与剪纸边缘；不要照片感、3D 玩具感、Q 版幼儿感、赛博霓虹、复杂装饰边框。

角色步行帧约束：四个方向分别使用严格侧面、正面和背面视角；每个方向至少四个独立步态，按接触、收腿、反向接触、收腿排列，手臂与双腿交替，不能用整体缩放、倾斜或换色冒充走路；精灵帧统一为 `192×192`，脚底线固定，四角保持透明。停止移动时使用独立的正面静止帧，移动时左右方向必须能看出双腿交替。

Weapon slot rule: base sword, gun, whip and cannon images use transparent 160x160 PNGs in `public/assets/art/weapons/`. Remove only edge-connected backdrop pixels, keep the source pixel outlines and metal shading, and preserve the canvas size and pivot padding when replacing an image. Runtime class mapping is `sword -> weapon-sword`, `gun -> weapon-gun`, `whip -> weapon-whip`, `cannon -> weapon-cannon`.
