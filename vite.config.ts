import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'builda-static-style-compat',
      enforce: 'post',
      transformIndexHtml(html: string) {
        // Builda's static shell does not send CORS headers. A same-origin
        // stylesheet must therefore use the default request mode.
        return html.replace(/\s+crossorigin(?=[\s>])/gi, '');
      },
    },
  ],
  server: {
    watch: {
      ignored: ['**/builda-web.zip', '**/.game-dev/**'],
    },
  },
  build: {
    modulePreload: false,
    target: 'es2022',
    chunkSizeWarningLimit: 1400,
  },
});
