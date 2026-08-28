import type { BuildaSDK } from '../../../.builda-agent/sdk/web/builda-sdk';

/**
 * Builda privateKV 存档仓库。
 *
 * 游戏运行态仍留在场景内，仓库只负责在过关、结算、购买等事件节点
 * 读写完整的进度快照。没有宿主时返回空值，让独立网页预览保持可运行。
 */
export class ProgressRepository<T extends object> {
  static readonly key = 'progress_main_v1';

  private get sdk(): BuildaSDK | undefined {
    return typeof window !== 'undefined' ? window.Builda : undefined;
  }

  async load(): Promise<Partial<T> | undefined> {
    const kv = this.sdk?.privateKV;
    if (!kv) return undefined;
    try {
      const result = await kv.get(ProgressRepository.key);
      if (!result.ok || result.data === null) return undefined;
      const json = this.decode(result.data);
      const parsed: unknown = JSON.parse(json);
      return parsed && typeof parsed === 'object' ? parsed as Partial<T> : undefined;
    } catch {
      return undefined;
    }
  }

  save(value: T): void {
    const kv = this.sdk?.privateKV;
    if (!kv) return;
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    if (bytes.byteLength > 32 * 1024) return;
    void kv.set(ProgressRepository.key, bytes).catch(() => undefined);
  }

  private decode(value: Uint8Array | string): string {
    if (value instanceof Uint8Array) return new TextDecoder().decode(value);
    // SDK 默认返回字节流；字符串只作为兼容 mock/旧 SDK 的 JSON 回退。
    try {
      const decoded = atob(value);
      const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
      const json = new TextDecoder().decode(bytes);
      if (json.trim().startsWith('{')) return json;
    } catch {
      // Fall through to the plain JSON compatibility path.
    }
    return value;
  }
}
