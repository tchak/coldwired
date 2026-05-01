import { defineConfig } from 'vite-plus';
import { playwright } from 'vite-plus/test/browser-playwright';

export default defineConfig({
  pack: {
    dts: {
      tsgo: true,
    },
    exports: true,
    entry: {
      actions: 'src/actions.ts',
      react: 'src/react.ts',
      'turbo-stream': 'src/turbo-stream.ts',
      utils: 'src/utils.ts',
    },
    attw: { profile: 'esm-only' },
    publint: true,
    deps: { onlyBundle: false },
  },
  lint: {
    jsPlugins: ['@e18e/eslint-plugin'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      'no-floating-promises': 'off',
      'unbound-method': 'off',
      'e18e/prefer-array-at': 'error',
      'e18e/prefer-array-fill': 'error',
      'e18e/prefer-includes': 'error',
      'e18e/prefer-array-to-reversed': 'error',
      'e18e/prefer-array-to-sorted': 'error',
      'e18e/prefer-array-to-spliced': 'error',
      'e18e/prefer-nullish-coalescing': 'error',
      'e18e/prefer-object-has-own': 'error',
      'e18e/prefer-spread-syntax': 'error',
      'e18e/prefer-url-canparse': 'error',
      'e18e/prefer-array-from-map': 'error',
      'e18e/prefer-timer-args': 'error',
      'e18e/prefer-date-now': 'error',
      'e18e/prefer-regex-test': 'error',
      'e18e/prefer-array-some': 'error',
      'e18e/prefer-static-regex': 'error',
    },
  },
  fmt: {
    singleQuote: true,
  },
  test: {
    coverage: { provider: 'istanbul' },
    browser: {
      provider: playwright(),
      enabled: true,
      headless: true,
      instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
    },
  },
});
