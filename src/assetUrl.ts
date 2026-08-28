/** Resolve an asset path against the current HTML entry point. */
export function assetUrl(path: string): string {
  const normalized = path.replace(/^\/+/, '');
  if (typeof document === 'undefined') return `/${normalized}`;
  return new URL(normalized, document.baseURI).toString();
}
