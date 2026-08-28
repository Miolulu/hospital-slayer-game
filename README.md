# 我在精神病院斩神

移动端横屏 HTML5 GameJam Demo。使用 Phaser 3、TypeScript 和 Vite，按 Builda 平台规范接入 SDK。

## 运行

```powershell
npm.cmd install
npm.cmd run dev
```

或者直接运行根目录的 `start.cmd`。

构建与测试：

```powershell
npm.cmd test
npm.cmd run build
```

当前版本按 30 层医院关卡规划，包含对白、自动攻击、武器成长、SAN 异化、补给与首领。主线每层 10 波，第 7 波为本层小首领；每日挑战为 50 波，最终出现月度首领。SAN 低于 30 后自动进入异化模式，提升攻击和出怪压力，降低护盾吸收效率。

## 分层入口

`src/main.ts` 是唯一应用入口，只加载 `src/presentation/scenes/MainScene.ts`。场景表现层、领域规则、基础设施和平台适配分别位于 `src/presentation/`、`src/domain/`、`src/infrastructure/` 和 `src/types/`。旧版单体实现保存在 `src/legacy/main-monolith.ts`，仅用于追溯，不能作为新功能入口。

创游世界草稿的后续构建统一从 `D:\zhanshen` 执行。该目录保留 Builda 工具链、懒加载配置和 `assets/res` CDN 资源源。Git 的 `main` 分支与这个分层入口同步，草稿不接受其他目录直接上传的产物。

首屏只加载必要资源，武器、主线、档案、每日挑战和战斗资源在进入对应界面时按组加载。宿主提供 `Builda.assets.url()` 时，资源会从已绑定的 CDN 清单读取；本地预览由项目根目录的 `assets/res` 兜底，不把 CDN 地址写入游戏逻辑。

开发者模式仅在显式参数下开启：`?dev=1`。它拥有最高测试权限，默认解锁全部楼层和皮肤，并可在战斗面板调整波次、切换无敌和自动清场。也可使用 `devFloor`、`devWave`、`devGod`、`devAutoClear` 参数指定初始状态。

## Builda 本地验证

项目级工具链位于 `.builda-agent/`。完成构建后可运行：

```powershell
.builda-agent\builda.cmd dev --web dist
```

正式上传前再按工具链提示执行授权和草稿同步。SDK 文件由 Builda 宿主注入，不要复制进发布压缩包。

## 协作开发

```powershell
git clone https://github.com/Miolulu/hospital-slayer-game.git
cd hospital-slayer-game
npm.cmd install
npm.cmd run dev
```

素材放在 `public/assets/art/`；需要走 CDN 的资源放在 `D:\zhanshen\assets\res\`，不复制进发布构建目录。玩法与界面代码从 `src/main.ts` 进入分层场景。提交代码前运行 `npm.cmd test` 和 `npm.cmd run build`。
