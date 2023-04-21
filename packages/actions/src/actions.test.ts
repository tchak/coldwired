import { describe, it, expect, beforeEach } from 'vitest';
import { getByLabelText, fireEvent } from '@testing-library/dom';

import { parseHTMLDocument, parseHTMLFragment, isFocused } from '@coldwired/utils';

import { Actions } from '.';

describe('@coldwired/actions', () => {
  let actions: Actions;

  beforeEach(async () => {
    actions?.observe();
    actions = new Actions({ element: document.documentElement });
    document.body.innerHTML = '';
    actions.disconnect();
  });

  it('should morph', () => {
    actions.morph(document, parseHTMLDocument('<div></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    expect(from.outerHTML).toEqual('<div></div>');
    actions.morph(from, '<div>World</div>');
    expect(from.outerHTML).toEqual('<div>World</div>');
  });

  it('should preserve added classes', async () => {
    actions.morph(document, parseHTMLDocument('<div></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    from.classList.add('foo');
    expect(from.outerHTML).toEqual('<div class="foo"></div>');
    await Promise.resolve();

    actions.morph(from, '<div>World</div>');
    expect(from.outerHTML).toEqual('<div class="foo">World</div>');

    from.classList.remove('foo');
    await Promise.resolve();

    actions.morph(from, '<div>World</div>');
    expect(from.outerHTML).toEqual('<div>World</div>');
  });

  it('should preserve removed classes', async () => {
    actions.morph(document, parseHTMLDocument('<div class="bar"></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    from.classList.remove('bar');
    expect(from.outerHTML).toEqual('<div class=""></div>');
    await Promise.resolve();

    actions.morph(from, '<div class="foo bar">World</div>');
    expect(from.outerHTML).toEqual('<div class="foo">World</div>');

    from.classList.add('bar');
    await Promise.resolve();

    actions.morph(from, '<div class="foo bar">World</div>');
    expect(from.outerHTML).toEqual('<div class="foo bar">World</div>');

    actions.morph(from, '<div class="foo">World</div>');
    expect(from.outerHTML).toEqual('<div class="foo bar">World</div>');

    actions.morph(from, '<div>World</div>');
    expect(from.outerHTML).toEqual('<div class="bar">World</div>');

    actions.morph(from, '<div data-turbo-force>World</div>');
    expect(from.outerHTML).toEqual('<div>World</div>');
  });

  it('should morph one element in to multiple', () => {
    actions.morph(document, parseHTMLDocument('<div id="first" class="bar"></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    expect(from.textContent).toEqual('');
    actions.morph(from, '<div id="first" class="bar">Hello</div><div class="foo">World</div>');
    expect(from.textContent).toEqual('Hello');
    expect(document.body.querySelectorAll('div').length).toEqual(2);
  });

  it('should morph tr', () => {
    actions.morph(
      document,
      parseHTMLDocument('<table><tbody><tr id="row1"><td>Hello</td></tr></tbody></table>')
    );
    const table = document.body.firstElementChild as HTMLTableElement;
    expect(table.outerHTML).toEqual(
      '<table><tbody><tr id="row1"><td>Hello</td></tr></tbody></table>'
    );
    const row1 = table.querySelector('#row1') as HTMLTableRowElement;
    actions.morph(row1, '<tr id="row1"><td>Hello</td></tr><tr id="row2"><td>World</td></tr>');
    expect(table.querySelectorAll('tr').length).toEqual(2);
  });

  it('should morph to text', () => {
    actions.morph(document, parseHTMLDocument('<div class="bar"></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    actions.morph(from, 'Hello');
    expect(document.body.innerHTML).toEqual('Hello');
  });

  it('should morph children to text', () => {
    actions.morph(document, parseHTMLDocument('<div class="bar"></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    actions.morph(from, 'Hello', { childrenOnly: true });
    expect(document.body.innerHTML).toEqual('<div class="bar">Hello</div>');
  });

  it('should morph to text and element', () => {
    actions.morph(document, parseHTMLDocument('<div class="bar"></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    actions.morph(from, 'Hello<div class="foo">World</div>World<span>!</span>');
    expect(document.body.innerHTML).toEqual('Hello<div class="foo">World</div>World<span>!</span>');
    expect(document.body.firstChild?.textContent).toEqual('Hello');
    expect(document.body.firstElementChild).toEqual(from);
    expect(from.outerHTML).toEqual('<div class="foo">World</div>');
  });

  it('should morph children to text and element', () => {
    actions.morph(document, parseHTMLDocument('<div class="bar"></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    actions.morph(from, 'Hello<div class="foo">World</div>World<span>!</span>', {
      childrenOnly: true,
    });
    expect(document.body.innerHTML).toEqual(
      '<div class="bar">Hello<div class="foo">World</div>World<span>!</span></div>'
    );
    expect(document.body.firstElementChild?.firstChild?.textContent).toEqual('Hello');
  });

  it('should morph turbo-frame element', () => {
    actions.morph(
      document,
      parseHTMLDocument(
        '<turbo-frame id="test-frame" data-turbo-action="advance">Hello World</turbo-frame>'
      )
    );
    const frame = document.body.firstElementChild as HTMLElement;

    actions.morph(
      frame,
      '<turbo-frame id="test-frame" data-turbo-action="advance"><div>Hello new World</div></turbo-frame>'
    );

    expect(document.body.innerHTML).toEqual(
      '<turbo-frame id="test-frame" data-turbo-action="advance"><div>Hello new World</div></turbo-frame>'
    );
  });

  it('should focus element after applying actions', async () => {
    actions.morph(document, parseHTMLDocument('<div><button>Click me</button></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    actions.applyActions([
      {
        action: 'update',
        targets: [from],
        fragment: parseHTMLFragment(
          '<button data-turbo-focus>First</button><button data-turbo-focus>Click me</button>',
          document
        ),
      },
    ]);
    await actions.ready();
    const firstButton = from.firstElementChild as HTMLButtonElement;
    expect(isFocused(firstButton)).toBeTruthy();

    actions.applyActions([
      {
        action: 'update',
        targets: [from],
        fragment: parseHTMLFragment(
          '<button>First</button><button data-turbo-focus>Click me</button>',
          document
        ),
      },
    ]);
    await actions.ready();
    expect(isFocused(firstButton)).toBeTruthy();

    actions.applyActions([
      {
        action: 'update',
        targets: [from],
        fragment: parseHTMLFragment(
          '<button>First</button><button>Click me</button><button data-turbo-focus="force">Last</button>',
          document
        ),
      },
    ]);
    await actions.ready();
    const lastButton = from.lastElementChild as HTMLButtonElement;
    expect(isFocused(lastButton)).toBeTruthy();
  });

  it('should show/hide element', async () => {
    actions.morph(document, parseHTMLDocument('<div class="bar"></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    actions.hide({ targets: '.bar' });
    await actions.ready();
    expect(from.classList.contains('hidden')).toBeTruthy();

    actions.show({ targets: '.bar' });
    await actions.ready();
    expect(from.classList.contains('hidden')).toBeFalsy();
  });

  it('should focus/disable/enable element', async () => {
    actions.morph(document, parseHTMLDocument('<button>Click me</button>'));
    const from = document.body.firstElementChild as HTMLButtonElement;

    expect(isFocused(from)).toBeFalsy();
    expect(from.disabled).toBeFalsy();

    actions.focus({ targets: 'button' });
    await actions.ready();
    expect(isFocused(from)).toBeTruthy();

    actions.disable({ targets: 'button' });
    await actions.ready();
    expect(from.disabled).toBeTruthy();

    actions.enable({ targets: 'button' });
    await actions.ready();
    expect(from.disabled).toBeFalsy();
    expect(isFocused(from)).toBeTruthy();
  });

  it('should preserve value', () => {
    actions.morph(
      document,
      parseHTMLDocument(
        '<label for="test">Test</label><input id="test" name="test" type="text" value="test" />'
      )
    );
    const input = getByLabelText<HTMLInputElement>(document.body, 'Test');
    fireEvent.change(input, { target: { value: 'Hello World' } });
    input.setSelectionRange(5, 7);
    expect(input.value).toEqual('Hello World');
    actions.morph(
      document,
      parseHTMLDocument(
        '<label for="test">Test</label><input id="test" name="test" type="text" value="test" />'
      )
    );
    expect(input.value).toEqual('Hello World');
    expect(input.selectionStart).toEqual(5);
    expect(input.selectionEnd).toEqual(7);
    actions.morph(
      document,
      parseHTMLDocument(
        '<label for="test">Test</label><input data-turbo-force id="test" name="test" type="text" value="test" />'
      )
    );
    expect(input.value).toEqual('test');
  });

  it('should preserve aria attributes', async () => {
    actions.morph(document, parseHTMLDocument('<div hidden>Menu</div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    expect(from.hidden).toBeTruthy();
    from.setAttribute('aria-expanded', 'true');
    from.hidden = false;
    await Promise.resolve();

    actions.morph(document, parseHTMLDocument('<div hidden>New Menu</div>'));
    expect(from.getAttribute('aria-expanded')).toEqual('true');
    expect(from.hidden).toBeFalsy();

    from.removeAttribute('aria-expanded');
    await Promise.resolve();

    actions.morph(document, parseHTMLDocument('<div hidden aria-expanded>New Menu</div>'));
    expect(from.hasAttribute('aria-expanded')).toBeFalsy();
    expect(from.hidden).toBeFalsy();

    actions.morph(
      document,
      parseHTMLDocument('<div hidden aria-expanded data-turbo-force>New Menu</div>')
    );
    expect(from.getAttribute('aria-expanded')).toEqual('');
    expect(from.hidden).toBeTruthy();
  });

  it('should preserve html if permanent attribute is set', async () => {
    actions.morph(document, parseHTMLDocument('<div>Hello world</div>'));
    const from = document.body.firstElementChild as HTMLDivElement;
    from.setAttribute('data-turbo-permanent', '');
    actions.morph(document, parseHTMLDocument('<div>Bye world!</div>'));
    expect(from.textContent).toEqual('Hello world');
    actions.morph(document, parseHTMLDocument('<div>Encore !</div>'));
    expect(from.textContent).toEqual('Hello world');
    expect(from.hasAttribute('data-turbo-permanent')).toBeTruthy();
    actions.morph(document, parseHTMLDocument('<div data-turbo-force>Bye world!</div>'));
    expect(from.textContent).toEqual('Bye world!');
    expect(from.hasAttribute('data-turbo-permanent')).toBeFalsy();
  });

  it('should dispatch event', async () => {
    expect.assertions(5);
    actions.morph(document, parseHTMLDocument('<div></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    document.documentElement.addEventListener('toto', () => {
      expect(true).toBeTruthy();
    });
    document.documentElement.addEventListener('data', (event) => {
      expect(true).toBeTruthy();
      expect((event as CustomEvent).detail).toEqual({ 'the answer': 42, 'more >': '&<t>' });
    });
    from.addEventListener('tata', () => {
      expect(true).toBeTruthy();
    });

    actions.append({
      targets: 'head',
      fragment: parseHTMLFragment('<dispatch-event type="toto" />', document),
    });
    actions.after({
      targets: 'body > div',
      fragment: parseHTMLFragment('<dispatch-event type="tata" />', document),
    });
    actions.append({
      targets: 'head',
      fragment: parseHTMLFragment(
        '<dispatch-event type="data"><script type="application/json"><![CDATA[{ "the answer": 42, "more >": "&<t>" }]]></script></dispatch-event>',
        document
      ),
    });
    await actions.ready();
    expect(document.body.innerHTML).toEqual('<div></div>');
  });

  it('#applyActions with meterialized action', async () => {
    actions.morph(document, parseHTMLDocument('<div></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    expect(from.outerHTML).toEqual('<div></div>');
    actions.applyActions([
      { action: 'update', targets: [from], fragment: parseHTMLFragment('World', document) },
    ]);
    await actions.ready();
    expect(from.outerHTML).toEqual('<div>World</div>');
  });
});
