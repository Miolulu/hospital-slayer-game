import type {
  BuildaCapsuleMenuRect,
  BuildaPlayer,
  BuildaRankList,
  BuildaResult,
  BuildaRewardAdResult,
  BuildaSafeArea,
  BuildaSDK,
} from '../../../.builda-agent/sdk/web/builda-sdk';

const EMPTY_SAFE_AREA: BuildaSafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
const EMPTY_CAPSULE: BuildaCapsuleMenuRect = { top: 0, right: 0, width: 0, height: 0 };

type RewardAdPayload = BuildaRewardAdResult & {
  completed?: boolean;
  rewarded?: boolean;
};

/**
 * Builda's success flag is authoritative. Older hosts have also returned a
 * completion/reward flag or only a transaction id. A few early hosts returned
 * the payload without the Result envelope, so normalize that shape as well.
 */
export function rewardAdCompleted(result: unknown) {
  if (!result || typeof result !== 'object') return false;
  const envelope = result as { ok?: unknown; data?: unknown };
  const data = 'ok' in envelope
    ? envelope.ok === true ? envelope.data : undefined
    : result;
  if (!data || typeof data !== 'object') return false;
  const payload = data as Partial<RewardAdPayload> & { success?: unknown };
  const success: unknown = payload.success;
  if (success !== undefined) {
    if (success === true) return true;
    if (typeof success === 'string' && success.trim().toLowerCase() === 'true') return true;
    return false;
  }
  if (payload.completed === true || payload.rewarded === true) return true;
  return typeof payload.transId === 'string' && payload.transId.trim().length > 0;
}

/** 统一承接宿主能力，场景只依赖游戏需要的业务动作。 */
export class BuildaPlatformAdapter {
  get sdk(): BuildaSDK | undefined {
    return typeof window !== 'undefined' ? window.Builda : undefined;
  }

  safeArea(): BuildaSafeArea {
    try { return this.sdk?.runtime.safeArea() ?? EMPTY_SAFE_AREA; } catch { return EMPTY_SAFE_AREA; }
  }

  capsuleMenuRect(): BuildaCapsuleMenuRect {
    try { return this.sdk?.runtime.capsuleMenuRect() ?? EMPTY_CAPSULE; } catch { return EMPTY_CAPSULE; }
  }

  async ready(): Promise<BuildaResult<{ available: boolean }> | undefined> {
    // 直开 H5 预览时宿主 SDK 可能只有空壳对象，runtime 也可能尚未注入。
    if (!this.sdk?.runtime?.ready) return undefined;
    try { return await this.sdk.runtime.ready(); } catch { return undefined; }
  }

  async whoami(): Promise<BuildaPlayer | undefined> {
    if (!this.sdk?.whoami) return undefined;
    try {
      const result = await this.sdk.whoami({ timeoutMs: 1200 });
      return result.ok ? result.data : undefined;
    } catch { return undefined; }
  }

  async getRankList(rankId: string, limit = 20): Promise<BuildaRankList | undefined> {
    if (!this.sdk?.rank) return undefined;
    try {
      const result = await this.sdk.rank.getRankList(rankId, { limit, timeoutMs: 1400 });
      return result.ok ? result.data : undefined;
    } catch { return undefined; }
  }

  async submitScore(rankId: string, score: number): Promise<boolean> {
    if (!this.sdk?.rank) return false;
    try { return (await this.sdk.rank.submitScore(rankId, score, { timeoutMs: 1400 })).ok; } catch { return false; }
  }

  async showRewardAd(posId: string): Promise<boolean> {
    if (!this.sdk?.ad?.showRewardAd) return false;
    try {
      const result = await this.sdk.ad.showRewardAd(posId, { timeoutMs: 15000 });
      return rewardAdCompleted(result);
    } catch { return false; }
  }

  async showPayPanel(saleId: string): Promise<{ success: boolean; orderId: string } | undefined> {
    if (!this.sdk?.pay?.showPayPanel) return undefined;
    try {
      const result = await this.sdk.pay.showPayPanel(saleId, { timeoutMs: 15000 });
      return result.ok ? result.data : undefined;
    } catch { return undefined; }
  }
}

export const buildaPlatform = new BuildaPlatformAdapter();
