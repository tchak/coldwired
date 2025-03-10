import { describe, it, expect, beforeEach } from 'vitest';
import { getByText, fireEvent, waitFor } from '@testing-library/dom';
import { useState } from 'react';
import { Actions } from '@coldwired/actions';
import { encode as htmlEncode } from 'html-entities';

import {
  createRoot,
  createReactPlugin,
  defaultSchema,
  type Manifest,
  type Root,
  type ReactComponent,
} from '.';

const NAME_ATTRIBUTE = defaultSchema.nameAttribute;
const PROPS_ATTRIBUTE = defaultSchema.propsAttribute;
const REACT_COMPONENT_TAG = defaultSchema.componentTagName;
const DEFAULT_TAG_NAME = defaultSchema.fragmentTagName;

function encodeProps(props: ReactComponent['props']): string {
  return htmlEncode(JSON.stringify(props));
}

const Counter = ({ label }: { label?: string }) => {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>
        {label ?? 'Count'}: {count}
      </p>
      <button onClick={() => setCount((count) => count + 1)}>Increment</button>
    </div>
  );
};
const manifest: Manifest = { Counter };

describe('@coldwired/react', () => {
  let actions: Actions;
  let root: Root;

  beforeEach(async () => {
    actions?.disconnect();
    document.body.innerHTML = `<div id="main"><${DEFAULT_TAG_NAME} id="frag-1" class="loading"><div class="title">Hello</div></${DEFAULT_TAG_NAME}></div><div id="root"></div>`;
    root = createRoot(document.getElementById('root')!, {
      loader: (name) => Promise.resolve(manifest[name]),
    });
    const plugin = createReactPlugin(root);
    actions = new Actions({
      element: document.documentElement,
      plugins: [plugin],
    });

    actions.observe();
    await actions.ready();
  });

  function layout(content: string) {
    return `<div id="main">${content}</div><div id="root"></div>`;
  }

  it('actions plugin', async () => {
    expect(document.body.innerHTML).toEqual(
      layout(
        `<${DEFAULT_TAG_NAME} id="frag-1"><div class="title">Hello</div></${DEFAULT_TAG_NAME}>`,
      ),
    );
    expect(root.getCache().size).toEqual(1);

    actions.update({
      targets: '#main',
      fragment: `<${DEFAULT_TAG_NAME} id="frag-1">Yolo</${DEFAULT_TAG_NAME}>`,
    });
    await actions.ready();

    expect(document.body.innerHTML).toEqual(
      layout(`<${DEFAULT_TAG_NAME} id="frag-1">Yolo</${DEFAULT_TAG_NAME}>`),
    );

    actions.replace({
      targets: '#frag-1',
      fragment: `<${DEFAULT_TAG_NAME} id="frag-1"><p>plop</p></${DEFAULT_TAG_NAME}>`,
    });
    await actions.ready();

    expect(document.body.innerHTML).toEqual(
      layout(`<${DEFAULT_TAG_NAME} id="frag-1"><p>plop</p></${DEFAULT_TAG_NAME}>`),
    );

    actions.update({
      targets: '#frag-1',
      fragment: `<${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Counter"></${REACT_COMPONENT_TAG}>`,
    });
    await actions.ready();
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<${DEFAULT_TAG_NAME} id="frag-1"><div><p>Count: 0</p><button>Increment</button></div></${DEFAULT_TAG_NAME}>`,
        ),
      );
    });

    fireEvent.click(getByText(document.body, 'Increment'));
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<${DEFAULT_TAG_NAME} id="frag-1"><div><p>Count: 1</p><button>Increment</button></div></${DEFAULT_TAG_NAME}>`,
        ),
      );
    });
    fireEvent.click(getByText(document.body, 'Increment'));
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<${DEFAULT_TAG_NAME} id="frag-1"><div><p>Count: 2</p><button>Increment</button></div></${DEFAULT_TAG_NAME}>`,
        ),
      );
    });

    actions.update({
      targets: '#main',
      fragment: `<${DEFAULT_TAG_NAME} id="frag-1"><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Counter"></${REACT_COMPONENT_TAG}></${DEFAULT_TAG_NAME}><${DEFAULT_TAG_NAME} id="frag-2">Test</${DEFAULT_TAG_NAME}>`,
    });
    await actions.ready();
    expect(root.getCache().size).toEqual(2);
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<${DEFAULT_TAG_NAME} id="frag-1"><div><p>Count: 2</p><button>Increment</button></div></${DEFAULT_TAG_NAME}><${DEFAULT_TAG_NAME} id="frag-2">Test</${DEFAULT_TAG_NAME}>`,
        ),
      );
    });

    actions.update({
      targets: '#main',
      fragment: `<${DEFAULT_TAG_NAME} id="frag-1"><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Counter"></${REACT_COMPONENT_TAG}></${DEFAULT_TAG_NAME}><${DEFAULT_TAG_NAME} id="frag-2">Test</${DEFAULT_TAG_NAME}><div><${DEFAULT_TAG_NAME} id="frag-3">Encore un</${DEFAULT_TAG_NAME}></div>`,
    });
    await actions.ready();
    expect(root.getCache().size).toEqual(3);
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<${DEFAULT_TAG_NAME} id="frag-1"><div><p>Count: 2</p><button>Increment</button></div></${DEFAULT_TAG_NAME}><${DEFAULT_TAG_NAME} id="frag-2">Test</${DEFAULT_TAG_NAME}><div><${DEFAULT_TAG_NAME} id="frag-3">Encore un</${DEFAULT_TAG_NAME}></div>`,
        ),
      );
    });

    actions.update({
      targets: '#main',
      fragment: `<${DEFAULT_TAG_NAME} id="frag-1"><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Counter"></${REACT_COMPONENT_TAG}></${DEFAULT_TAG_NAME}><${DEFAULT_TAG_NAME} id="frag-2">Test 23</${DEFAULT_TAG_NAME}>`,
    });
    await actions.ready();
    expect(root.getCache().size).toEqual(2);
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<${DEFAULT_TAG_NAME} id="frag-1"><div><p>Count: 2</p><button>Increment</button></div></${DEFAULT_TAG_NAME}><${DEFAULT_TAG_NAME} id="frag-2">Test 23</${DEFAULT_TAG_NAME}>`,
        ),
      );
    });

    actions.update({
      targets: '#main',
      fragment: `<${DEFAULT_TAG_NAME} id="frag-1"><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Counter"></${REACT_COMPONENT_TAG}></${DEFAULT_TAG_NAME}>`,
    });
    await actions.ready();
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<${DEFAULT_TAG_NAME} id="frag-1"><div><p>Count: 2</p><button>Increment</button></div></${DEFAULT_TAG_NAME}>`,
        ),
      );
      expect(root.getCache().size).toEqual(1);
    });

    actions.update({
      targets: '#main',
      fragment: `<input name="age" /><${DEFAULT_TAG_NAME} id="frag-1"><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Counter"></${REACT_COMPONENT_TAG}></${DEFAULT_TAG_NAME}>`,
    });
    await actions.ready();
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<input name="age"><${DEFAULT_TAG_NAME} id="frag-1"><div><p>Count: 2</p><button>Increment</button></div></${DEFAULT_TAG_NAME}>`,
        ),
      );
      expect(root.getCache().size).toEqual(1);
    });

    actions.update({
      targets: '#main',
      fragment: `<section><input name="age" /></section><${DEFAULT_TAG_NAME} id="frag-1"><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Counter"></${REACT_COMPONENT_TAG}></${DEFAULT_TAG_NAME}>`,
    });
    await actions.ready();
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<section><input name="age"></section><${DEFAULT_TAG_NAME} id="frag-1"><div><p>Count: 2</p><button>Increment</button></div></${DEFAULT_TAG_NAME}>`,
        ),
      );
      expect(root.getCache().size).toEqual(1);
    });

    actions.update({
      targets: '#main',
      fragment: `<section><${DEFAULT_TAG_NAME} id="frag-1"><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Counter" ${PROPS_ATTRIBUTE}="${encodeProps({ label: 'My Count' })}"></${REACT_COMPONENT_TAG}></${DEFAULT_TAG_NAME}></section>`,
    });
    await actions.ready();
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<section><${DEFAULT_TAG_NAME} id="frag-1"><div><p>My Count: 2</p><button>Increment</button></div></${DEFAULT_TAG_NAME}></section>`,
        ),
      );
      expect(root.getCache().size).toEqual(1);
    });

    fireEvent.click(getByText(document.body, 'Increment'));
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<section><${DEFAULT_TAG_NAME} id="frag-1"><div><p>My Count: 3</p><button>Increment</button></div></${DEFAULT_TAG_NAME}></section>`,
        ),
      );
    });

    actions.update({
      targets: '#main',
      fragment: `<section><${DEFAULT_TAG_NAME} id="frag-1"><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Counter" ${PROPS_ATTRIBUTE}="${encodeProps({ label: 'My New Count' })}"></${REACT_COMPONENT_TAG}></${DEFAULT_TAG_NAME}></section>`,
    });
    await actions.ready();
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<section><${DEFAULT_TAG_NAME} id="frag-1"><div><p>My New Count: 3</p><button>Increment</button></div></${DEFAULT_TAG_NAME}></section>`,
        ),
      );
      expect(root.getCache().size).toEqual(1);
    });

    actions.append({
      targets: 'section',
      fragment: `<div>toto <${DEFAULT_TAG_NAME}><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Counter" ${PROPS_ATTRIBUTE}="${encodeProps({ label: 'One more Count' })}"></${REACT_COMPONENT_TAG}></${DEFAULT_TAG_NAME}></div>`,
    });
    await actions.ready();
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<section><${DEFAULT_TAG_NAME} id="frag-1"><div><p>My New Count: 3</p><button>Increment</button></div></${DEFAULT_TAG_NAME}><div>toto <${DEFAULT_TAG_NAME}><div><p>One more Count: 0</p><button>Increment</button></div></${DEFAULT_TAG_NAME}></div></section>`,
        ),
      );
      expect(root.getCache().size).toEqual(2);
    });

    actions.update({
      targets: 'section',
      fragment: '<p>hello</p>',
    });
    await actions.ready();

    actions.prepend({
      targets: 'section',
      fragment: `<${DEFAULT_TAG_NAME}><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Counter" ${PROPS_ATTRIBUTE}="${encodeProps({ label: 'One more Count' })}"></${REACT_COMPONENT_TAG}></${DEFAULT_TAG_NAME}>`,
    });
    await actions.ready();
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<section><${DEFAULT_TAG_NAME}><div><p>One more Count: 0</p><button>Increment</button></div></${DEFAULT_TAG_NAME}><p>hello</p></section>`,
        ),
      );
      expect(root.getCache().size).toEqual(1);
    });

    actions.update({
      targets: 'section',
      fragment: '<p>hello</p>',
    });
    await actions.ready();

    actions.after({
      targets: 'p',
      fragment: `<${DEFAULT_TAG_NAME}><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Counter" ${PROPS_ATTRIBUTE}="${encodeProps({ label: 'One more Count' })}"></${REACT_COMPONENT_TAG}></${DEFAULT_TAG_NAME}>`,
    });
    await actions.ready();
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<section><p>hello</p><${DEFAULT_TAG_NAME}><div><p>One more Count: 0</p><button>Increment</button></div></${DEFAULT_TAG_NAME}></section>`,
        ),
      );
      expect(root.getCache().size).toEqual(1);
    });

    actions.update({
      targets: 'section',
      fragment: '<p>hello</p>',
    });
    await actions.ready();

    actions.before({
      targets: 'p',
      fragment: `<${DEFAULT_TAG_NAME}><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Counter" ${PROPS_ATTRIBUTE}="${encodeProps({ label: 'One more Count' })}"></${REACT_COMPONENT_TAG}></${DEFAULT_TAG_NAME}>`,
    });
    await actions.ready();
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<section><${DEFAULT_TAG_NAME}><div><p>One more Count: 0</p><button>Increment</button></div></${DEFAULT_TAG_NAME}><p>hello</p></section>`,
        ),
      );
      expect(root.getCache().size).toEqual(1);
    });
  });
});
