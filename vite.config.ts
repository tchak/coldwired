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
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      'no-floating-promises': 'off',
      'unbound-method': 'off',
    },
  },
  fmt: {
    singleQuote: true,
  },
  test: {
    browser: {
      provider: playwright(),
      enabled: true,
      headless: true,
      instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
    },
  },
});
