import { describe, it, expect, beforeEach } from 'vitest';
import { useState, useEffect } from 'react';
import {
  ComboBox,
  ListBox,
  ListBoxItem,
  Popover,
  Label,
  Input,
  TextField,
} from 'react-aria-components';
import { encode as htmlEncode } from 'html-entities';
import { getByLabelText, fireEvent, waitFor } from '@testing-library/dom';

import { createRoot, defaultSchema, type Manifest, type Observable } from '.';
import type { ReactComponent } from './react-tree-builder';

const NAME_ATTRIBUTE = defaultSchema.nameAttribute;
const PROPS_ATTRIBUTE = defaultSchema.propsAttribute;
const REACT_COMPONENT_TAG = defaultSchema.componentTagName;
const DEFAULT_TAG_NAME = defaultSchema.fragmentTagName;

function encodeProps(props: ReactComponent['props']): string {
  return htmlEncode(JSON.stringify(props));
}

const Counter = () => {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount((count) => count + 1)}>Increment</button>
    </div>
  );
};
let observedValue = '';
const Greeting = ({ name, nameChanges }: { name: string; nameChanges: Observable<string> }) => {
  useEffect(() => {
    const subscription = nameChanges.subscribe((value) => {
      observedValue = value;
    });
    return subscription.unsubscribe;
  }, [nameChanges]);

  return <div>Hello {name}!</div>;
};
const ComponentWithError = () => {
  throw new Error('Boom!');
};
const manifest: Manifest = {
  Counter,
  Greeting,
  ComponentWithError,
  ComboBox,
  ListBox,
  ListBoxItem,
  Popover,
  Label,
  Input,
  TextField,
};

describe('@coldwired/react', () => {
  beforeEach(() => {
    observedValue = '';
  });
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

    it('render with error boundary', async () => {
      document.body.innerHTML = `<${DEFAULT_TAG_NAME}>
        <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Counter"></${REACT_COMPONENT_TAG}>
      </${DEFAULT_TAG_NAME}> some text <${DEFAULT_TAG_NAME}>
        <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ComponentWithError"></${REACT_COMPONENT_TAG}>
      </${DEFAULT_TAG_NAME}><div id="root"></div>`;
      const root = createRoot(document.getElementById('root')!, {
        loader: (name) => Promise.resolve(manifest[name]),
      });
      await root.mount();
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

    it('render with state', async () => {
      const textFieldProps = {
        onChange: { __type__: '__set__', key: 'textValue' },
      };
      const greetingProps = {
        name: { __type__: '__get__', key: 'textValue', defaultValue: 'Guest' },
        nameChanges: { __type__: '__observe__', key: 'textValue' },
      };
      document.body.innerHTML = `<${DEFAULT_TAG_NAME}>
        <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="TextField" ${PROPS_ATTRIBUTE}="${encodeProps(textFieldProps)}">
          <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Label">My Name</${REACT_COMPONENT_TAG}>
          <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Input"></${REACT_COMPONENT_TAG}>
        </${REACT_COMPONENT_TAG}>
        <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Greeting" ${PROPS_ATTRIBUTE}="${encodeProps(greetingProps)}"></${REACT_COMPONENT_TAG}>
      </${DEFAULT_TAG_NAME}><div id="root"></div>`;
      const root = createRoot(document.getElementById('root')!, {
        loader: (name) => Promise.resolve(manifest[name]),
      });
      await root.mount();
      await root.render(document.body).done;

      expect(document.body.innerHTML).toEqual(
        `<${DEFAULT_TAG_NAME}><div class="react-aria-TextField" data-rac=""><label class="react-aria-Label" id="react-aria-:ro:" for="react-aria-:rn:">My Name</label><input type="text" id="react-aria-:rn:" aria-labelledby="react-aria-:ro:" class="react-aria-Input" data-rac="" value="" title=""></div><div>Hello Guest!</div></${DEFAULT_TAG_NAME}><div id="root"></div>`,
      );
      expect(observedValue).toEqual('');

      fireEvent.change(getByLabelText(document.body, 'My Name'), { target: { value: 'Paul' } });

      await waitFor(() => {
        expect(document.body.innerHTML).toEqual(
          `<${DEFAULT_TAG_NAME}><div class="react-aria-TextField" data-rac=""><label class="react-aria-Label" id="react-aria-:ro:" for="react-aria-:rn:">My Name</label><input type="text" id="react-aria-:rn:" aria-labelledby="react-aria-:ro:" class="react-aria-Input" data-rac="" value="Paul" title=""></div><div>Hello Paul!</div></${DEFAULT_TAG_NAME}><div id="root"></div>`,
        );
        expect(observedValue).toEqual('Paul');
      });

      fireEvent.change(getByLabelText(document.body, 'My Name'), { target: { value: 'Greer' } });

      await waitFor(() => {
        expect(document.body.innerHTML).toEqual(
          `<${DEFAULT_TAG_NAME}><div class="react-aria-TextField" data-rac=""><label class="react-aria-Label" id="react-aria-:ro:" for="react-aria-:rn:">My Name</label><input type="text" id="react-aria-:rn:" aria-labelledby="react-aria-:ro:" class="react-aria-Input" data-rac="" value="Greer" title=""></div><div>Hello Greer!</div></${DEFAULT_TAG_NAME}><div id="root"></div>`,
        );
        expect(observedValue).toEqual('Greer');
      });
      root.destroy();
    });
  });
});
