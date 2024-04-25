/// <reference types="vitest" />

import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: true,
    browser: {
      enabled: true,
      headless: true,
      name: 'chromium',
      provider: 'playwright',
    },
  },
});
