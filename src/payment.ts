export const PAYMENT_PRICE_MIN = 30000;
export const PAYMENT_PRICE_MAX = 50000;

const SALE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function skinSaleId(skinId: string) {
  return `skin_${skinId}`;
}

export function weaponSkinSaleId(skinId: string) {
  return `weapon_skin_${skinId}`;
}

export function isValidSaleId(saleId: string) {
  return SALE_ID_PATTERN.test(saleId);
}

/**
 * Builda order IDs are opaque. Hash them before storing the idempotency key so
 * raw platform identifiers never become part of the game's persistent data.
 */
export async function paymentOrderKey(orderId: string) {
  const normalized = orderId.trim();
  if (!normalized) return '';
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) return '';
  const bytes = new TextEncoder().encode(normalized);
  const digest = await cryptoApi.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
  return `pay_order_${hash.slice(0, 48)}`;
}
