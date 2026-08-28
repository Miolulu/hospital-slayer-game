import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isValidSaleId, paymentOrderKey, skinSaleId, weaponSkinSaleId } from './payment';
import { SKINS } from './domain/catalog/skinCatalog';

const manifest = JSON.parse(readFileSync(new URL('../builda.publish.json', import.meta.url), 'utf8')) as {
  payPoints: Array<{ payId: string; price: number }>;
};

describe('Builda payment catalog', () => {
  it('declares every store player skin at a 3-5 RMB equivalent price', () => {
    const points = new Map(manifest.payPoints.map((point) => [point.payId, point]));
    const storeSkins = SKINS.filter((skin) => skin.category === 'store');
    expect(storeSkins).toHaveLength(6);
    storeSkins.forEach((skin) => {
      const point = points.get(skinSaleId(skin.id));
      expect(point).toBeDefined();
      expect(point?.price).toBeGreaterThanOrEqual(30000);
      expect(point?.price).toBeLessThanOrEqual(50000);
    });
  });

  it('declares all weapon skin products with legal stable IDs', () => {
    const weaponPoints = manifest.payPoints.filter((point) => point.payId.startsWith('weapon_skin_'));
    expect(weaponPoints).toHaveLength(25);
    expect(new Set(weaponPoints.map((point) => point.payId)).size).toBe(weaponPoints.length);
    weaponPoints.forEach((point) => {
      expect(isValidSaleId(point.payId)).toBe(true);
      expect(point.price).toBeGreaterThanOrEqual(30000);
      expect(point.price).toBeLessThanOrEqual(50000);
      expect(point.payId).toBe(weaponSkinSaleId(point.payId.slice('weapon_skin_'.length)));
    });
  });

  it('hashes opaque order IDs into the documented idempotency key', async () => {
    await expect(paymentOrderKey('order-1')).resolves.toBe('pay_order_0bafe22156d2698c143b86040446d366ead863ba600d5c92');
    await expect(paymentOrderKey(' order-1 ')).resolves.toBe('pay_order_0bafe22156d2698c143b86040446d366ead863ba600d5c92');
    await expect(paymentOrderKey('')).resolves.toBe('');
  });
});
