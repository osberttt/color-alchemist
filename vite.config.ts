/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev:phone` (mode "phone") serves over self-signed HTTPS on the LAN,
// because getUserMedia only works in a secure context.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'phone' ? [basicSsl()] : [],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
}));
