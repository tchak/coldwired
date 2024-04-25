import { describe, it, expect } from 'vitest';
import { useState, StrictMode } from 'react';

import { createContainer, NAME_ATTRIBUTE, type Manifest } from '.';

const DEFAULT_TAG_NAME = 'turbo-fragment';

describe('@coldwired/react', () => {
  describe('container', () => {
    const Counter = () => {
      const [count, setCount] = useState(0);
      return (
        <div>
          <p>Count: {count}</p>
          <button onClick={() => setCount((count) => count + 1)}>Increment</button>
        </div>
      );
    };
    const manifest: Manifest = { Counter };

    it('render simple fragment', async () => {
      const container = createContainer({
        loader: (name) => Promise.resolve(manifest[name]),
        fragmentTagName: DEFAULT_TAG_NAME,
        loadingClassName: 'loading',
      });
      document.body.innerHTML = `<${DEFAULT_TAG_NAME}><div class="title">Hello</div></${DEFAULT_TAG_NAME}><div id="root"></div>`;
      await container.mount(document.getElementById('root')!, StrictMode);
      await container.render(document.body);

      expect(document.body.innerHTML).toEqual(
        `<${DEFAULT_TAG_NAME}><div class="title">Hello</div></${DEFAULT_TAG_NAME}><div id="root"></div>`,
      );

      await container.render(
        document.body.firstElementChild!,
        `<div class="title">Hello World!</div>`,
      );
      expect(document.body.innerHTML).toEqual(
        `<${DEFAULT_TAG_NAME}><div class="title">Hello World!</div></${DEFAULT_TAG_NAME}><div id="root"></div>`,
      );
      expect(container.getCache().size).toEqual(1);
      container.destroy();
    });

    it('render fragment with component', async () => {
      const container = createContainer({
        loader: (name) => Promise.resolve(manifest[name]),
        fragmentTagName: DEFAULT_TAG_NAME,
        loadingClassName: 'loading',
      });
      document.body.innerHTML = `<${DEFAULT_TAG_NAME}><react-component ${NAME_ATTRIBUTE}="Counter"></react-component></${DEFAULT_TAG_NAME}><div id="root"></div>`;
      await container.mount(document.getElementById('root')!, StrictMode);
      await container.render(document.body);

      expect(document.body.innerHTML).toEqual(
        `<${DEFAULT_TAG_NAME}><div><p>Count: 0</p><button>Increment</button></div></${DEFAULT_TAG_NAME}><div id="root"></div>`,
      );
      container.destroy();
    });
  });
});
