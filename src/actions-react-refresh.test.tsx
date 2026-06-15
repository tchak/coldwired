import { describe, it, expect, beforeEach, afterEach } from 'vite-plus/test';
import { page, userEvent } from 'vite-plus/test/browser';
import { waitFor } from '@testing-library/dom';
import { useState } from 'react';
import { encode as htmlEncode } from 'html-entities';
import { Actions } from './actions';
import { parseHTMLDocument } from './utils';

import {
  ComboBox,
  ListBox,
  ListBoxItem,
  Popover,
  Label,
  Input,
  Button,
} from 'react-aria-components';

import { createRoot, createReactPlugin, defaultSchema, type Manifest, type Root } from './react';

const NAME_ATTRIBUTE = defaultSchema.nameAttribute;
const PROPS_ATTRIBUTE = defaultSchema.propsAttribute;
const REACT_COMPONENT_TAG = defaultSchema.componentTagName;
const FRAGMENT_TAG = defaultSchema.fragmentTagName;

function encodeProps(props: Record<string, unknown>): string {
  return htmlEncode(JSON.stringify(props));
}

const Hello = ({ who = 'world' }: { who?: string }) => <p>hello {who}</p>;

// A controlled input whose value lives in React state. If event delegation is
// broken after a morph, typing no longer updates the rendered value.
const ControlledInput = () => {
  const [value, setValue] = useState('');
  return (
    <div>
      <input aria-label="field" value={value} onChange={(event) => setValue(event.target.value)} />
      <p>value: {value}</p>
    </div>
  );
};
const manifest: Manifest = {
  ControlledInput,
  Hello,
  ComboBox,
  ListBox,
  ListBoxItem,
  Popover,
  Label,
  Input,
  Button,
};

const COMBOBOX_FRAGMENT = `<${FRAGMENT_TAG} id="frag-1"><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ComboBox">
  <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Label">Fruit</${REACT_COMPONENT_TAG}>
  <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Input"></${REACT_COMPONENT_TAG}>
  <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Button">Open</${REACT_COMPONENT_TAG}>
  <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Popover"><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ListBox">
    <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ListBoxItem">Apple</${REACT_COMPONENT_TAG}>
    <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ListBoxItem">Apricot</${REACT_COMPONENT_TAG}>
    <${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ListBoxItem">Banana</${REACT_COMPONENT_TAG}>
  </${REACT_COMPONENT_TAG}></${REACT_COMPONENT_TAG}>
</${REACT_COMPONENT_TAG}></${FRAGMENT_TAG}>`;

describe('coldwired/react full-document morph', () => {
  let actions: Actions;
  let root: Root;

  beforeEach(async () => {
    document.body.innerHTML = `<div id="main"><${FRAGMENT_TAG} id="frag-1" class="loading"><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ControlledInput"></${REACT_COMPONENT_TAG}></${FRAGMENT_TAG}></div>`;
    // No explicit container -> createRoot uses findOrCreateContainerElement('react-root'),
    // appending <div id="react-root"> as a plain <body> child.
    root = createRoot({
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

  afterEach(() => {
    actions?.disconnect();
    root?.destroy();
  });

  it('keeps a fragment-hosted controlled input interactive after a full-document morph that omits the react root container', async () => {
    await waitFor(() => {
      expect(document.querySelector('#frag-1 input')).toBeTruthy();
    });
    expect(document.querySelector('#react-root')).toBeTruthy();

    // The input is interactive before the morph.
    const input = document.querySelector<HTMLInputElement>('#frag-1 input')!;
    await page.getByLabelText('field').fill('hello');
    await waitFor(() => {
      expect(document.querySelector('#frag-1 p')!.textContent).toEqual('value: hello');
    });

    // Server responds with turbo_stream.refresh -> whole-body morph. The server
    // HTML does NOT contain #react-root (it is a client-only container).
    const newDocument = parseHTMLDocument(
      `<div id="main"><${FRAGMENT_TAG} id="frag-1"><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ControlledInput"></${REACT_COMPONENT_TAG}></${FRAGMENT_TAG}></div>`,
    );
    actions.morph(document.body, newDocument.body);
    await actions.ready();

    // 1. The react root container must survive the morph.
    expect(document.querySelector('#react-root')).toBeTruthy();
    expect(root.getCache().size).toEqual(1);

    // 2. The input must still be interactive after the morph.
    await waitFor(() => {
      expect(document.querySelector('#frag-1 input')).toBeTruthy();
    });
    const inputAfter = document.querySelector<HTMLInputElement>('#frag-1 input')!;
    expect(inputAfter).toBe(input);
    await page.getByLabelText('field').fill('world');
    await waitFor(() => {
      expect(document.querySelector('#frag-1 p')!.textContent).toEqual('value: world');
    });
  });

  it('keeps an id-less fragment-hosted controlled input interactive after a full-document morph', async () => {
    document.body.innerHTML = `<div id="main"><${FRAGMENT_TAG} class="loading"><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ControlledInput"></${REACT_COMPONENT_TAG}></${FRAGMENT_TAG}></div>`;
    root.destroy();
    actions.disconnect();
    root = createRoot({ loader: (name) => Promise.resolve(manifest[name]) });
    actions = new Actions({
      element: document.documentElement,
      plugins: [createReactPlugin(root)],
    });
    actions.observe();
    await actions.ready();

    await waitFor(() => {
      expect(document.querySelector(`#main ${FRAGMENT_TAG} input`)).toBeTruthy();
    });
    const input = document.querySelector<HTMLInputElement>(`#main ${FRAGMENT_TAG} input`)!;
    await page.getByLabelText('field').fill('hello');
    await waitFor(() => {
      expect(document.querySelector(`#main ${FRAGMENT_TAG} p`)!.textContent).toEqual(
        'value: hello',
      );
    });

    const newDocument = parseHTMLDocument(
      `<div id="main"><${FRAGMENT_TAG}><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ControlledInput"></${REACT_COMPONENT_TAG}></${FRAGMENT_TAG}></div>`,
    );
    actions.morph(document.body, newDocument.body);
    await actions.ready();

    expect(root.getCache().size).toEqual(1);
    // The fragment element itself must be preserved (not replaced by the server
    // copy), otherwise React's portal/listeners point at a detached node.
    const fragAfter = document.querySelector(`#main ${FRAGMENT_TAG}`)!;
    expect(fragAfter.querySelector('input')).toBe(input);
    expect(document.querySelectorAll(`#main ${FRAGMENT_TAG}`).length).toEqual(1);

    await page.getByLabelText('field').fill('world');
    await waitFor(() => {
      expect(document.querySelector(`#main ${FRAGMENT_TAG} p`)!.textContent).toEqual(
        'value: world',
      );
    });
  });

  it('keeps a react-aria ComboBox interactive after a full-document morph', async () => {
    document.body.innerHTML = `<div id="main">${COMBOBOX_FRAGMENT}</div>`;
    root.destroy();
    actions.disconnect();
    root = createRoot({ loader: (name) => Promise.resolve(manifest[name]) });
    actions = new Actions({
      element: document.documentElement,
      plugins: [createReactPlugin(root)],
    });
    actions.observe();
    await actions.ready();

    await waitFor(() => {
      expect(document.querySelector('#frag-1 input[role="combobox"]')).toBeTruthy();
    });

    // Typing opens the listbox (portaled popover) and filters items before the morph.
    await page.getByRole('combobox').fill('Ap');
    await waitFor(() => {
      const options = Array.from(
        document.querySelectorAll('.react-aria-Popover [role="option"]'),
        (el) => el.textContent,
      );
      expect(options).toEqual(['Apple', 'Apricot']);
    });
    await userEvent.keyboard('{Escape}');

    // Whole-body morph from a turbo refresh; server HTML has no #react-root.
    const newDocument = parseHTMLDocument(`<div id="main">${COMBOBOX_FRAGMENT}</div>`);
    actions.morph(document.body, newDocument.body);
    await actions.ready();

    expect(document.querySelector('#react-root')).toBeTruthy();
    expect(root.getCache().size).toEqual(1);

    // The ComboBox must still react to typing after the morph: typing must
    // update the controlled value and re-filter the (portaled) listbox.
    await waitFor(() => {
      expect(document.querySelector('#frag-1 input[role="combobox"]')).toBeTruthy();
    });
    await page.getByRole('combobox').fill('Ban');
    await waitFor(() => {
      const options = Array.from(
        document.querySelectorAll('.react-aria-Popover [role="option"]'),
        (el) => el.textContent,
      );
      expect(options).toEqual(['Banana']);
    });
  });

  it('does not duplicate a data-turbo-force="browser" fragment during a morph', async () => {
    await waitFor(() => {
      expect(document.querySelector('#frag-1 input')).toBeTruthy();
    });
    const frag = document.querySelector('#frag-1')!;
    frag.setAttribute('data-turbo-force', 'browser');

    const newDocument = parseHTMLDocument(
      `<div id="main"><${FRAGMENT_TAG} id="frag-1"><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="ControlledInput"></${REACT_COMPONENT_TAG}></${FRAGMENT_TAG}></div>`,
    );
    actions.morph(document.body, newDocument.body);
    await actions.ready();

    // The browser-forced fragment is preserved exactly once — the server copy
    // must not be additionally inserted.
    expect(document.querySelectorAll('#frag-1').length).toEqual(1);
    expect(document.querySelector('#frag-1')).toBe(frag);
  });

  it('does not re-render a data-turbo-force="browser" fragment from the server template', async () => {
    document.body.innerHTML = `<div id="main"><${FRAGMENT_TAG} id="frag-1"><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Hello"></${REACT_COMPONENT_TAG}></${FRAGMENT_TAG}></div>`;
    root.destroy();
    actions.disconnect();
    root = createRoot({ loader: (name) => Promise.resolve(manifest[name]) });
    actions = new Actions({
      element: document.documentElement,
      plugins: [createReactPlugin(root)],
    });
    actions.observe();
    await actions.ready();
    await waitFor(() => {
      expect(document.querySelector('#frag-1 p')!.textContent).toEqual('hello world');
    });

    document.querySelector('#frag-1')!.setAttribute('data-turbo-force', 'browser');

    // Server sends different props. A browser-forced subtree must be left alone:
    // the plugin must not re-render it from the server template.
    const props = encodeProps({ who: 'universe' });
    const newDocument = parseHTMLDocument(
      `<div id="main"><${FRAGMENT_TAG} id="frag-1"><${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Hello" ${PROPS_ATTRIBUTE}="${props}"></${REACT_COMPONENT_TAG}></${FRAGMENT_TAG}></div>`,
    );
    actions.morph(document.body, newDocument.body);
    await actions.ready();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.querySelectorAll('#frag-1').length).toEqual(1);
    expect(document.querySelector('#frag-1 p')!.textContent).toEqual('hello world');
  });
});
