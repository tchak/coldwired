import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import {
  ComboBox,
  ListBox,
  ListBoxItem,
  Popover,
  Label,
  Input,
  TextField,
  Button,
} from 'react-aria-components';
import { getByText, getByRole, fireEvent, waitFor } from '@testing-library/dom';

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
const ComponentWithError = () => {
  throw new Error('Boom!');
};
const manifest: Manifest = {
  Counter,
  ComponentWithError,
  ComboBox,
  ListBox,
  ListBoxItem,
  Popover,
  Label,
  Input,
  TextField,
  Button,
};

describe('@coldwired/react', () => {
  describe('root', () => {
    it('render simple fragment', async () => {
      document.body.innerHTML = `<${DEFAULT_TAG_NAME}><div class="title">Hello</div></${DEFAULT_TAG_NAME}>`;
      const root = createRoot({ loader: (name) => Promise.resolve(manifest[name]) });
      await root.render(document.body).done;

      expect(document.body.innerHTML).toEqual(
        `<${DEFAULT_TAG_NAME}><div class="title">Hello</div></${DEFAULT_TAG_NAME}><div id="react-root"></div>`,
      );

      await root.render(document.body.firstElementChild!, `<div class="title">Hello World!</div>`)
        .done;
      expect(document.body.innerHTML).toEqual(
        `<${DEFAULT_TAG_NAME}><div class="title">Hello World!</div></${DEFAULT_TAG_NAME}><div id="react-root"></div>`,
      );
      expect(root.getCache().size).toEqual(1);
      root.destroy();
    });

    it('render fragment with component', async () => {
      document.body.innerHTML = `<${DEFAULT_TAG_NAME}><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Counter"></${REACT_COMPONENT_TAG}></${DEFAULT_TAG_NAME}><div id="root"></div>`;
      const root = createRoot(document.getElementById('root')!, {
        loader: (name) => Promise.resolve(manifest[name]),
      });
      await root.render(document.body).done;

      expect(document.body.innerHTML).toEqual(
        `<${DEFAULT_TAG_NAME}><div><p>Count: 0</p><button>Increment</button></div></${DEFAULT_TAG_NAME}><div id="root"></div>`,
      );
      root.destroy();
    });

    it('render with error boundary', async () => {
      document.body.innerHTML = `<${DEFAULT_TAG_NAME}>
        <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Counter"></${REACT_COMPONENT_TAG}>
      </${DEFAULT_TAG_NAME}> some text <${DEFAULT_TAG_NAME}>
        <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ComponentWithError"></${REACT_COMPONENT_TAG}>
      </${DEFAULT_TAG_NAME}><div id="root"></div>`;
      const root = createRoot(document.getElementById('root')!, {
        loader: (name) => Promise.resolve(manifest[name]),
      });
      await root.render(document.body).done;

      expect(document.body.innerHTML).toEqual(
        `<${DEFAULT_TAG_NAME}><div><p>Count: 0</p><button>Increment</button></div></${DEFAULT_TAG_NAME}> some text <${DEFAULT_TAG_NAME}><div role="alert"><pre style="color: red;">Boom!</pre></div></${DEFAULT_TAG_NAME}><div id="root"></div>`,
      );
      root.destroy();
    });

    it('render fragment with react aria component', async () => {
      document.body.innerHTML = `<${DEFAULT_TAG_NAME}>
        <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ComboBox">
          <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Label">Test</${REACT_COMPONENT_TAG}>
          <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Input"></${REACT_COMPONENT_TAG}>
          <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Button">Open</${REACT_COMPONENT_TAG}>
          <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Popover">
            <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ListBox">
              <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ListBoxItem">One</${REACT_COMPONENT_TAG}>
              <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ListBoxItem">Two </${REACT_COMPONENT_TAG}>
              <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ListBoxItem">Three</${REACT_COMPONENT_TAG}>
            </${REACT_COMPONENT_TAG}>
          </${REACT_COMPONENT_TAG}>
        </${REACT_COMPONENT_TAG}>
      </${DEFAULT_TAG_NAME}><div id="root"></div>`;
      let root = createRoot(document.getElementById('root')!, {
        loader: (name) => Promise.resolve(manifest[name]),
      });
      await root.render(document.body).done;

      expect(document.body.innerHTML.replaceAll('type="text" ', '')).toEqual(
        `<${DEFAULT_TAG_NAME}><div class="react-aria-ComboBox" data-rac=""><label class="react-aria-Label" id="react-aria-:r3:" for="react-aria-:r2:">Test</label><input type="text" aria-autocomplete="list" autocomplete="off" autocorrect="off" spellcheck="false" id="react-aria-:r2:" aria-labelledby="react-aria-:r3:" role="combobox" aria-expanded="false" class="react-aria-Input" data-rac="" value="" title=""><button id="react-aria-:r0:" type="button" tabindex="-1" aria-label="Show suggestions" aria-labelledby="react-aria-:r0: react-aria-:r3:" aria-haspopup="listbox" aria-expanded="false" class="react-aria-Button" data-rac="">Open</button></div></${DEFAULT_TAG_NAME}><div id="root"></div>`.replaceAll(
          'type="text" ',
          '',
        ),
      );

      fireEvent.click(getByText(document.body, 'Open'));
      fireEvent.input(getByRole(document.body, 'combobox'), { target: { value: 'One' } });

      expect(document.body.querySelector('.react-aria-Popover')).toBeTruthy();

      root.destroy();
      waitFor(() => {
        expect(root.getCache().size).toEqual(0);
      });
      document.body.innerHTML = '';

      document.body.innerHTML = `<${DEFAULT_TAG_NAME}>
        <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ComboBox">
          <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Label">Test</${REACT_COMPONENT_TAG}>
          <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Input"></${REACT_COMPONENT_TAG}>
          <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Button">Open</${REACT_COMPONENT_TAG}>
          <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Popover">
            <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ListBox">
              <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ListBoxItem">One</${REACT_COMPONENT_TAG}>
              <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ListBoxItem">Two </${REACT_COMPONENT_TAG}>
              <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ListBoxItem">Three</${REACT_COMPONENT_TAG}>
            </${REACT_COMPONENT_TAG}>
          </${REACT_COMPONENT_TAG}>
        </${REACT_COMPONENT_TAG}>
      </${DEFAULT_TAG_NAME}><div id="root"></div>`;

      root = createRoot(document.getElementById('root')!, {
        loader: (name) => Promise.resolve(manifest[name]),
      });
      await root.render(document.body).done;

      expect(document.body.innerHTML.replaceAll('type="text" ', '')).toEqual(
        `<${DEFAULT_TAG_NAME}><div class="react-aria-ComboBox" data-rac=""><label class="react-aria-Label" id="react-aria-:rs:" for="react-aria-:rr:">Test</label><input type="text" aria-autocomplete="list" autocomplete="off" autocorrect="off" spellcheck="false" id="react-aria-:rr:" aria-labelledby="react-aria-:rs:" role="combobox" aria-expanded="false" class="react-aria-Input" data-rac="" value="" title=""><button id="react-aria-:rp:" type="button" tabindex="-1" aria-label="Show suggestions" aria-labelledby="react-aria-:rp: react-aria-:rs:" aria-haspopup="listbox" aria-expanded="false" class="react-aria-Button" data-rac="">Open</button></div></${DEFAULT_TAG_NAME}><div id="root"></div>`.replaceAll(
          'type="text" ',
          '',
        ),
      );

      fireEvent.click(getByText(document.body, 'Open'));
      fireEvent.input(getByRole(document.body, 'combobox'), { target: { value: 'One' } });

      expect(document.body.querySelector('.react-aria-Popover')).toBeTruthy();

      root.destroy();
    });
  });
});
