import { describe, expect, it } from 'vitest';
import type { BuildaRewardAdResult } from '../../../.builda-agent/sdk/web/builda-sdk';
import { rewardAdCompleted } from './BuildaPlatformAdapter';

describe('Builda reward ad result normalization', () => {
  it('accepts the documented success flag', () => {
    const result = { ok: true as const, data: { success: true, transId: 'tx-1', adCoin: null } satisfies BuildaRewardAdResult };
    expect(rewardAdCompleted(result)).toBe(true);
  });

  it('rejects an explicitly incomplete ad even when the request succeeded', () => {
    const result = { ok: true as const, data: { success: false, transId: '', adCoin: null } satisfies BuildaRewardAdResult };
    expect(rewardAdCompleted(result)).toBe(false);
  });

  it('accepts completion and transaction-id variants used by older hosts', () => {
    expect(rewardAdCompleted({ ok: true, data: { completed: true } })).toBe(true);
    expect(rewardAdCompleted({ ok: true, data: { rewarded: true } })).toBe(true);
    expect(rewardAdCompleted({ ok: true, data: { transId: 'legacy-tx' } })).toBe(true);
  });

  it('accepts an unwrapped host payload and a string success flag', () => {
    expect(rewardAdCompleted({ success: true, transId: 'direct-tx' })).toBe(true);
    expect(rewardAdCompleted({ success: 'true', transId: 'string-tx' })).toBe(true);
  });

  it('rejects failed SDK results and empty payloads', () => {
    expect(rewardAdCompleted({ ok: false, error: { code: 'CANCELLED', message: 'cancelled' } })).toBe(false);
    expect(rewardAdCompleted({ ok: true, data: {} })).toBe(false);
    expect(rewardAdCompleted({ ok: true, data: { success: false, transId: 'stale-tx' } })).toBe(false);
  });
});
