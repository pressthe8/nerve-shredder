import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { devvit } from '@devvit/start/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwind(),
    devvit(),
    {
      name: 'strip-use-client',
      transform(code, id) {
        if (id.includes('node_modules/@tanstack/react-query')) {
          return {
            code: code.replace(/"use client";?\n?|'use client';?\n?/g, ''),
            map: null,
          };
        }
      },
    },
  ],
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          warning.code === 'MODULE_LEVEL_DIRECTIVE' ||
          warning.code === 'SOURCEMAP_ERROR'
        ) {
          return;
        }
        warn(warning);
      },
    },
  },
});
