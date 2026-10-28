/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Test deployments (GitHub Pages, `npm run build:pages`) ask search engines to
// skip the pre-release build. The jam build (`npm run build`) leaves it out.
function noindex(): Plugin {
  return {
    name: 'noindex',
    transformIndexHtml: (html) => html.replace('</head>', '    <meta name="robots" content="noindex, nofollow" />\n  </head>'),
  };
}

// `npm run dev:phone` (mode "phone") serves over self-signed HTTPS on the LAN,
// because getUserMedia only works in a secure context.
export default defineConfig(({ mode }) => ({
  // Relative asset paths: works at github.io/<repo>/ and on any jam host sub-path.
  base: './',
  plugins: [...(mode === 'phone' ? [basicSsl()] : []), ...(mode === 'pages' ? [noindex()] : [])],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    // The scoring tuner ships only with the test deployment, never in the jam build.
    rollupOptions: mode === 'pages' ? { input: { main: 'index.html', tuner: 'tuner.html' } } : undefined,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
}));
