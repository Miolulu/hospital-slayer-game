export {};

declare global {
  interface Window {
    __GAME_TEST_API__: {
      snapshot: () => object;
      bossPreview?: () => void;
      workshop?: () => object;
      developerMode?: () => object;
      setDeveloperControls?: (controls: { floor?: number; wave?: number; godMode?: boolean; autoClear?: boolean; gameSpeed?: number }) => object;
    };
    __BOSS_PREVIEW__?: () => void;
  }
}
