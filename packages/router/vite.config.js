const path = require('path');
const { defineConfig } = require('vite');

module.exports = defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      fileName: (format) => `index.${format}.js`,
      formats: ['cjs', 'es'],
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: [
        '@remix-run/router',
        'nanoid',
        '@coldwired/utils',
        '@coldwired/actions',
        '@coldwired/turbo-stream',
      ],
    },
  },
});
