/// <reference types="vitest" />

import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    //setupFiles: ['./test/setup-test-browser-env.ts'],
    setupFiles: ['./test/setup-test-env.ts'],
    browser: {
      enabled: false,
      headless: false,
      name: 'firefox',
      provider: 'playwright',
    },
  },
});
