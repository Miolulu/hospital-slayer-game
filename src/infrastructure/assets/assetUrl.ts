/**
 * Resolve a delayed asset through Builda's asset contract. The CDN base is
 * injected by the host and must never be persisted in game code.
 */
export function assetUrl(path: string): string {
  const normalized = path.replace(/^\/+/, '');
  // Catalog modules may resolve paths during startup. Keep a second resolve
  // idempotent so those absolute CDN URLs are safe to pass to the loader.
  if (/^https?:\/\//i.test(path.trim())) return path;
  const remotePath = normalized.startsWith('assets/')
    ? `res/${normalized.slice('assets/'.length)}`
    : normalized.startsWith('res/') ? normalized : `res/${normalized}`;
  const builda = typeof window !== 'undefined' ? window.Builda : undefined;
  if (builda?.assets?.url) return builda.assets.url(remotePath);
  if (typeof document === 'undefined') return `/${normalized}`;
  // Vite's plain dev server has no assets fallback. Keeping the old path here
  // preserves the procedural-art fallback outside builda dev.
  return new URL(normalized, document.baseURI).toString();
}
