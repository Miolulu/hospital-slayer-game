import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
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
