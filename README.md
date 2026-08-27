# 我在精神病院斩神

移动端横屏 HTML5 GameJam Demo。使用 Phaser 3、TypeScript 和 Vite，按 Builda 平台规范接入 SDK。

## 运行

```powershell
npm.cmd install
npm.cmd run dev
```

构建与测试：

```powershell
npm.cmd test
npm.cmd run build
```

当前版本按 30 层医院关卡规划，包含对白、自动攻击、武器成长、SAN 异化、补给与首领。主线每层 10 波，第 7 波为本层小首领；每日挑战为 50 波，最终出现月度首领。SAN 低于 30 后自动进入异化模式，提升攻击和出怪压力，降低护盾吸收效率。

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

素材放在 `public/assets/art/`，玩法与界面代码主要位于 `src/main.ts`。提交代码前运行 `npm.cmd test` 和 `npm.cmd run build`。
