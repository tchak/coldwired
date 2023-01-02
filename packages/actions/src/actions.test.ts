import { describe, it, expect, beforeEach } from 'vitest';

import { parseHTMLDocument } from '@coldwired/utils';

import { Actions } from '.';

describe('@coldwired/actions', () => {
  let actions: Actions;

  beforeEach(async () => {
    actions?.stop();
    actions = new Actions({ element: document.documentElement });
    document.body.innerHTML = '';
    actions.start();
  });

  it('should morph', () => {
    actions.morph(document, parseHTMLDocument('<div></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    expect(from.outerHTML).toBe('<div></div>');
    actions.morph(from, '<div>World</div>');
    expect(from.outerHTML).toBe('<div>World</div>');
  });

  it('should preserve added classes', async () => {
    actions.morph(document, parseHTMLDocument('<div></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    from.classList.add('foo');
    expect(from.outerHTML).toBe('<div class="foo"></div>');
    await Promise.resolve();

    actions.morph(from, '<div>World</div>');
    expect(from.outerHTML).toBe('<div class="foo">World</div>');

    from.classList.remove('foo');
    await Promise.resolve();

    actions.morph(from, '<div>World</div>');
    expect(from.outerHTML).toBe('<div>World</div>');
  });

  it('should preserve removed classes', async () => {
    actions.morph(document, parseHTMLDocument('<div class="bar"></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    from.classList.remove('bar');
    expect(from.outerHTML).toBe('<div class=""></div>');
    await Promise.resolve();

    actions.morph(from, '<div class="foo bar">World</div>');
    expect(from.outerHTML).toBe('<div class="foo">World</div>');

    from.classList.add('bar');
    await Promise.resolve();

    actions.morph(from, '<div class="foo bar">World</div>');
    expect(from.outerHTML).toBe('<div class="foo bar">World</div>');

    actions.morph(from, '<div class="foo">World</div>');
    expect(from.outerHTML).toBe('<div class="foo bar">World</div>');

    actions.morph(from, '<div>World</div>');
    expect(from.outerHTML).toBe('<div class="bar">World</div>');
  });

  it('should morph one element in to multiple', () => {
    actions.morph(document, parseHTMLDocument('<div id="first" class="bar"></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    expect(from.textContent).toBe('');
    actions.morph(from, '<div id="first" class="bar">Hello</div><div class="foo">World</div>');
    expect(from.textContent).toBe('Hello');
    expect(document.body.querySelectorAll('div').length).toBe(2);
  });

  it('should morph tr', () => {
    actions.morph(
      document,
      parseHTMLDocument('<table><tbody><tr id="row1"><td>Hello</td></tr></tbody></table>')
    );
    const table = document.body.firstElementChild as HTMLTableElement;
    expect(table.outerHTML).toBe('<table><tbody><tr id="row1"><td>Hello</td></tr></tbody></table>');
    const row1 = table.querySelector('#row1') as HTMLTableRowElement;
    actions.morph(row1, '<tr id="row1"><td>Hello</td></tr><tr id="row2"><td>World</td></tr>');
    expect(table.querySelectorAll('tr').length).toBe(2);
  });

  it('should morph to text', () => {
    actions.morph(document, parseHTMLDocument('<div class="bar"></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    actions.morph(from, 'Hello');
    expect(document.body.innerHTML).toBe('Hello');
  });

  it('should morph children to text', () => {
    actions.morph(document, parseHTMLDocument('<div class="bar"></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    actions.morph(from, 'Hello', { childrenOnly: true });
    expect(document.body.innerHTML).toBe('<div class="bar">Hello</div>');
  });

  it('should morph to text and element', () => {
    actions.morph(document, parseHTMLDocument('<div class="bar"></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    actions.morph(from, 'Hello<div class="foo">World</div>World<span>!</span>');
    expect(document.body.innerHTML).toBe('Hello<div class="foo">World</div>World<span>!</span>');
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
    expect(document.body.innerHTML).toBe(
      '<div class="bar">Hello<div class="foo">World</div>World<span>!</span></div>'
    );
    expect(document.body.firstElementChild?.firstChild?.textContent).toEqual('Hello');
  });
});
