import Phaser from 'phaser';

export type PhaserAssetDefinition =
  | { kind: 'image'; key: string; url: string }
  | { kind: 'spritesheet'; key: string; url: string; frameWidth: number; frameHeight: number };

export interface PhaserAssetLoadResult {
  ok: boolean;
  failedKeys: string[];
}

/**
 * Loads non-essential art after the first screen. The loader is deliberately
 * scene-local so Phaser's texture cache remains the single source of truth.
 */
export class PhaserAssetLoader {
  private readonly loadedGroups = new Set<string>();
  private readonly inFlight = new Map<string, Promise<PhaserAssetLoadResult>>();

  constructor(private readonly scene: Phaser.Scene) {}

  has(group: string) {
    return this.loadedGroups.has(group);
  }

  ensure(
    group: string,
    definitions: readonly PhaserAssetDefinition[],
    onProgress?: (progress: number) => void,
  ): Promise<PhaserAssetLoadResult> {
    if (this.loadedGroups.has(group)) return Promise.resolve({ ok: true, failedKeys: [] });
    const current = this.inFlight.get(group);
    if (current) return current;

    const pending = definitions.filter((definition) => !this.scene.textures.exists(definition.key));
    if (pending.length === 0) {
      this.loadedGroups.add(group);
      return Promise.resolve({ ok: true, failedKeys: [] });
    }

    const promise = new Promise<PhaserAssetLoadResult>((resolve) => {
      const failedKeys: string[] = [];
      const loader = this.scene.load;
      const onFileError = (file: { key?: string }) => {
        const key = file.key;
        if (key && !failedKeys.includes(key)) failedKeys.push(key);
      };
      const cleanup = () => {
        loader.off('loaderror', onFileError);
        loader.off('complete', onComplete);
        this.inFlight.delete(group);
      };
      const onComplete = () => {
        cleanup();
        const result = { ok: failedKeys.length === 0, failedKeys };
        if (result.ok) this.loadedGroups.add(group);
        onProgress?.(result.ok ? 1 : 0);
        resolve(result);
      };

      loader.on('loaderror', onFileError);
      loader.once('complete', onComplete);
      pending.forEach((definition) => {
        if (definition.kind === 'image') loader.image(definition.key, definition.url);
        else loader.spritesheet(definition.key, definition.url, {
          frameWidth: definition.frameWidth,
          frameHeight: definition.frameHeight,
        });
      });
      onProgress?.(0);
      loader.start();
    });
    this.inFlight.set(group, promise);
    return promise;
  }
}
