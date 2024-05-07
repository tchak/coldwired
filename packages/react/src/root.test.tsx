import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { ComboBox, ListBox, ListBoxItem, Popover, Label, Input } from 'react-aria-components';

import { createRoot, defaultSchema, type Manifest } from '.';

const NAME_ATTRIBUTE = defaultSchema.nameAttribute;
const REACT_COMPONENT_TAG = defaultSchema.componentTagName;
const DEFAULT_TAG_NAME = defaultSchema.fragmentTagName;

const Counter = () => {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount((count) => count + 1)}>Increment</button>
    </div>
  );
};
const manifest: Manifest = { Counter, ComboBox, ListBox, ListBoxItem, Popover, Label, Input };

describe('@coldwired/react', () => {
  describe('root', () => {
    it('render simple fragment', async () => {
      document.body.innerHTML = `<${DEFAULT_TAG_NAME}><div class="title">Hello</div></${DEFAULT_TAG_NAME}><div id="root"></div>`;
      const root = createRoot(document.getElementById('root')!, {
        loader: (name) => Promise.resolve(manifest[name]),
      });
      await root.mount();
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
      });
      await root.mount();
      await root.render(document.body).done;

      expect(document.body.innerHTML).toEqual(
        `<${DEFAULT_TAG_NAME}><div><p>Count: 0</p><button>Increment</button></div></${DEFAULT_TAG_NAME}><div id="root"></div>`,
      );
      root.destroy();
    });

    it('render fragment with react aria component', async () => {
      document.body.innerHTML = `<${DEFAULT_TAG_NAME}>
        <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ComboBox">
          <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Label">Test</${REACT_COMPONENT_TAG}>
          <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Input"></${REACT_COMPONENT_TAG}>
          <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Popover">
            <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ListBox">
              <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ListBoxItem">One</${REACT_COMPONENT_TAG}>
              <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ListBoxItem">Two </${REACT_COMPONENT_TAG}>
              <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ListBoxItem">Three</${REACT_COMPONENT_TAG}>
            </${REACT_COMPONENT_TAG}>
          </${REACT_COMPONENT_TAG}>
        </${REACT_COMPONENT_TAG}>
      </${DEFAULT_TAG_NAME}><div id="root"></div>`;
      const root = createRoot(document.getElementById('root')!, {
        loader: (name) => Promise.resolve(manifest[name]),
      });
      await root.mount();
      await root.render(document.body).done;

      expect(document.body.innerHTML).toEqual(
        `<${DEFAULT_TAG_NAME}><div class="react-aria-ComboBox" data-rac=""><label class="react-aria-Label" id="react-aria-:rc:" for="react-aria-:rb:">Test</label><input type="text" aria-autocomplete="list" autocomplete="off" id="react-aria-:rb:" aria-labelledby="react-aria-:rc:" role="combobox" aria-expanded="false" autocorrect="off" spellcheck="false" class="react-aria-Input" data-rac="" value="" title=""></div></${DEFAULT_TAG_NAME}><div id="root"></div>`,
      );
      root.destroy();
    });
  });
});
