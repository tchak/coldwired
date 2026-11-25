import react from '@vitejs/plugin-react';
import { transform } from 'oxc-transform-react';
import { defineConfig, type Plugin } from 'vite-plus';
import { playwright } from 'vite-plus/test/browser-playwright';

const SOURCE_FILE = /\/src\/.*\.[jt]sx?$/;
const NODE_MODULES = /\/node_modules\//;
const DECLARATION_FILE = /\.d\.[cm]?ts$/;
// Same pre-filter as @vitejs/plugin-react: only modules that may hold components or hooks.
const MAYBE_REACT_CODE = /forwardRef|memo|\b(?:[A-Z]|use[A-Z0-9])/;

// `plugins` below only feed Vite (`vp test`); `vp pack` builds with Rolldown and
// ignores them. This runs the same Rust React Compiler as
// `react({ compiler: true })` on the published code, with production JSX.
function reactCompiler(): Plugin {
  return {
    name: 'coldwired:react-compiler',
    transform: {
      filter: {
        id: { include: SOURCE_FILE, exclude: [NODE_MODULES, DECLARATION_FILE] },
        code: MAYBE_REACT_CODE,
      },
      async handler(code, id) {
        const result = await transform(id, code, {
          jsx: { runtime: 'automatic', development: false, importSource: 'react' },
          reactCompiler: true,
        });
        const diagnostics = result.errors.map((error) =>
          error.codeframe ? `${error.message}\n${error.codeframe}` : error.message,
        );
        if (result.fatal)
          this.error(diagnostics.join('\n\n') || 'React Compiler transform failed.');
        for (const diagnostic of diagnostics) this.warn(diagnostic);
        return { code: result.code, moduleType: 'js' };
      },
    },
  };
}

export default defineConfig({
  plugins: [react({ compiler: true })],
  pack: {
    plugins: [reactCompiler()],
    dts: {
      generator: 'tsgo',
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
    plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'react', 'import', 'promise', 'vitest'],
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
