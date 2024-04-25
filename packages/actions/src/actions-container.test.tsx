import { describe, it, expect, beforeEach } from 'vitest';
import { getByText, fireEvent, waitFor } from '@testing-library/dom';
import { StrictMode, useState } from 'react';

import { NAME_ATTRIBUTE, PROPS_ATTRIBUTE, Manifest, encodeProps } from '@coldwired/react';

import { Actions } from '.';

describe('@coldwired/actions', () => {
  let actions: Actions;

  const DEFAULT_TAG_NAME = 'turbo-fragment';
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

  beforeEach(async () => {
    actions?.disconnect();
    actions = new Actions({
      element: document.documentElement,
      container: { loader: (name) => Promise.resolve(manifest[name]) },
    });

    document.body.innerHTML = `<div id="main"><${DEFAULT_TAG_NAME} id="frag-1" class="loading"><div class="title">Hello</div></${DEFAULT_TAG_NAME}></div><div id="root"></div>`;
    actions.observe();
    await actions.ready();
    await actions.mount(document.getElementById('root')!, StrictMode);
  });

  function layout(content: string) {
    return `<div id="main">${content}</div><div id="root"></div>`;
  }

  it('render with container', async () => {
    expect(document.body.innerHTML).toEqual(
      layout(
        `<${DEFAULT_TAG_NAME} id="frag-1"><div class="title">Hello</div></${DEFAULT_TAG_NAME}>`,
      ),
    );
    expect(actions.container?.getCache().size).toEqual(1);

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
      fragment: `<react-component ${NAME_ATTRIBUTE}="Counter"></react-component>`,
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
      fragment: `<${DEFAULT_TAG_NAME} id="frag-1"><react-component ${NAME_ATTRIBUTE}="Counter"></react-component></${DEFAULT_TAG_NAME}><${DEFAULT_TAG_NAME} id="frag-2">Test</${DEFAULT_TAG_NAME}>`,
    });
    await actions.ready();
    expect(actions.container?.getCache().size).toEqual(2);
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<${DEFAULT_TAG_NAME} id="frag-1"><div><p>Count: 2</p><button>Increment</button></div></${DEFAULT_TAG_NAME}><${DEFAULT_TAG_NAME} id="frag-2">Test</${DEFAULT_TAG_NAME}>`,
        ),
      );
    });

    actions.update({
      targets: '#main',
      fragment: `<${DEFAULT_TAG_NAME} id="frag-1"><react-component ${NAME_ATTRIBUTE}="Counter"></react-component></${DEFAULT_TAG_NAME}><${DEFAULT_TAG_NAME} id="frag-2">Test 23</${DEFAULT_TAG_NAME}>`,
    });
    await actions.ready();
    expect(actions.container?.getCache().size).toEqual(2);
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<${DEFAULT_TAG_NAME} id="frag-1"><div><p>Count: 2</p><button>Increment</button></div></${DEFAULT_TAG_NAME}><${DEFAULT_TAG_NAME} id="frag-2">Test 23</${DEFAULT_TAG_NAME}>`,
        ),
      );
    });

    actions.update({
      targets: '#main',
      fragment: `<${DEFAULT_TAG_NAME} id="frag-1"><react-component ${NAME_ATTRIBUTE}="Counter"></react-component></${DEFAULT_TAG_NAME}>`,
    });
    await actions.ready();
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<${DEFAULT_TAG_NAME} id="frag-1"><div><p>Count: 2</p><button>Increment</button></div></${DEFAULT_TAG_NAME}>`,
        ),
      );
      expect(actions.container?.getCache().size).toEqual(1);
    });

    actions.update({
      targets: '#main',
      fragment: `<input name="age" /><${DEFAULT_TAG_NAME} id="frag-1"><react-component ${NAME_ATTRIBUTE}="Counter"></react-component></${DEFAULT_TAG_NAME}>`,
    });
    await actions.ready();
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<input name="age"><${DEFAULT_TAG_NAME} id="frag-1"><div><p>Count: 2</p><button>Increment</button></div></${DEFAULT_TAG_NAME}>`,
        ),
      );
      expect(actions.container?.getCache().size).toEqual(1);
    });

    actions.update({
      targets: '#main',
      fragment: `<section><input name="age" /></section><${DEFAULT_TAG_NAME} id="frag-1"><react-component ${NAME_ATTRIBUTE}="Counter"></react-component></${DEFAULT_TAG_NAME}>`,
    });
    await actions.ready();
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<section><input name="age"></section><${DEFAULT_TAG_NAME} id="frag-1"><div><p>Count: 2</p><button>Increment</button></div></${DEFAULT_TAG_NAME}>`,
        ),
      );
      expect(actions.container?.getCache().size).toEqual(1);
    });

    actions.update({
      targets: '#main',
      fragment: `<section><${DEFAULT_TAG_NAME} id="frag-1"><react-component ${NAME_ATTRIBUTE}="Counter" label="My Count"></react-component></${DEFAULT_TAG_NAME}></section>`,
    });
    await actions.ready();
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<section><${DEFAULT_TAG_NAME} id="frag-1"><div><p>My Count: 2</p><button>Increment</button></div></${DEFAULT_TAG_NAME}></section>`,
        ),
      );
      expect(actions.container?.getCache().size).toEqual(1);
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
      fragment: `<section><${DEFAULT_TAG_NAME} id="frag-1"><react-component ${NAME_ATTRIBUTE}="Counter" ${PROPS_ATTRIBUTE}="${encodeProps({ label: 'My New Count' })}"></react-component></${DEFAULT_TAG_NAME}></section>`,
    });
    await actions.ready();
    await waitFor(() => {
      expect(document.body.innerHTML).toEqual(
        layout(
          `<section><${DEFAULT_TAG_NAME} id="frag-1"><div><p>My New Count: 3</p><button>Increment</button></div></${DEFAULT_TAG_NAME}></section>`,
        ),
      );
      expect(actions.container?.getCache().size).toEqual(1);
    });
  });
});
