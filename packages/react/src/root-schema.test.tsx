import { describe, it, expect } from 'vitest';
import { useState } from 'react';

import { createRoot, defaultSchema, type Manifest } from '.';

const NAME_ATTRIBUTE = defaultSchema.nameAttribute;
const REACT_COMPONENT_TAG = 'react-component';
const DEFAULT_TAG_NAME = 'react-fragment';

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

describe('@coldwired/react', () => {
  describe('root with custom schema', () => {
    it('render simple fragment', async () => {
      document.body.innerHTML = `<${DEFAULT_TAG_NAME}><div class="title">Hello</div></${DEFAULT_TAG_NAME}><div id="root"></div>`;
      const root = createRoot(document.getElementById('root')!, {
        loader: (name) => Promise.resolve(manifest[name]),
        schema: {
          fragmentTagName: DEFAULT_TAG_NAME,
          componentTagName: REACT_COMPONENT_TAG,
        },
      });
      await root.render(document.body).done;

      expect(document.body.innerHTML).toEqual(
        `<${DEFAULT_TAG_NAME}><div class="title">Hello</div></${DEFAULT_TAG_NAME}><div id="root"></div>`,
      );

      await root.render(document.body.firstElementChild!, `<div class="title">Hello World!</div>`)
        .done;
      expect(document.body.innerHTML).toEqual(
        `<${DEFAULT_TAG_NAME}><div class="title">Hello World!</div></${DEFAULT_TAG_NAME}><div id="root"></div>`,
      );
      expect(root.getCache().size).toEqual(1);
      root.destroy();
    });

    it('render fragment with component', async () => {
      document.body.innerHTML = `<${DEFAULT_TAG_NAME}><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Counter"></${REACT_COMPONENT_TAG}></${DEFAULT_TAG_NAME}><div id="root"></div>`;
      const root = createRoot(document.getElementById('root')!, {
        loader: (name) => Promise.resolve(manifest[name]),
        schema: {
          fragmentTagName: DEFAULT_TAG_NAME,
          componentTagName: REACT_COMPONENT_TAG,
        },
      });
      await root.render(document.body).done;

      expect(document.body.innerHTML).toEqual(
        `<${DEFAULT_TAG_NAME}><div><p>Count: 0</p><button>Increment</button></div></${DEFAULT_TAG_NAME}><div id="root"></div>`,
      );
      root.destroy();
    });
  });
});
