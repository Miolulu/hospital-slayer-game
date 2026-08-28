import Phaser from 'phaser';

/** Shared local face and fallback stack for every Phaser text object. */
export const UI_FONT_FACE = 'HospitalPixel';
export const UI_FONT_STACK = '"HospitalPixel", "Noto Sans SC", "Microsoft YaHei", sans-serif';
export const UI_MONO_STACK = '"HospitalPixel", "Noto Sans SC", "Courier New", monospace';

let installed = false;

/**
 * Phaser call sites historically supplied several different system fonts.
 * Normalize them at the factory boundary so existing screens keep their
 * layout while sharing one locally bundled Chinese-capable face.
 */
export function installUiTextTheme() {
  if (installed) return;
  const factory = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
    text: (
      x: number,
      y: number,
      value: string | string[],
      style?: Phaser.Types.GameObjects.Text.TextStyle,
    ) => Phaser.GameObjects.Text;
  };
  const originalText = factory.text;
  factory.text = function themedText(
    this: Phaser.GameObjects.GameObjectFactory,
    x: number,
    y: number,
    value: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle,
  ) {
    const next = { ...(style ?? {}) } as Phaser.Types.GameObjects.Text.TextStyle;
    const requestedFamily = typeof next.fontFamily === 'string' ? next.fontFamily : '';
    next.fontFamily = requestedFamily.includes('Courier') ? UI_MONO_STACK : UI_FONT_STACK;
    next.letterSpacing = next.letterSpacing ?? 0;
    next.stroke = next.stroke ?? '#071015';
    next.strokeThickness = next.strokeThickness ?? 1;
    next.shadow = next.shadow ?? {
      offsetX: 1,
      offsetY: 2,
      color: '#05090f',
      blur: 0,
      stroke: true,
      fill: true,
    };
    return originalText.call(this, x, y, value, next);
  };
  installed = true;
}
