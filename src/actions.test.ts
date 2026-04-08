import { beforeEach, describe, expect, it } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser';

import { isFocused, parseHTMLDocument, parseHTMLFragment } from './utils';

import {
  Actions,
  after,
  append,
  before,
  disable,
  enable,
  hide,
  prepend,
  remove,
  replace,
  show,
  update,
} from './actions';

describe('coldwired/actions', () => {
  let actions: Actions;

  beforeEach(async () => {
    actions?.disconnect();
    actions = new Actions({ element: document.documentElement });
    document.body.innerHTML = '';
    actions.observe();
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
    expect(from.textContent).toEqual('World');
    expect(from.classList.length).toEqual(0);
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

    actions.morph(from, '<div data-turbo-force="server">World</div>');
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
      parseHTMLDocument('<table><tbody><tr id="row1"><td>Hello</td></tr></tbody></table>'),
    );
    const table = document.body.firstElementChild as HTMLTableElement;
    expect(table.outerHTML).toEqual(
      '<table><tbody><tr id="row1"><td>Hello</td></tr></tbody></table>',
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
      '<div class="bar">Hello<div class="foo">World</div>World<span>!</span></div>',
    );
    expect(document.body.firstElementChild?.firstChild?.textContent).toEqual('Hello');
  });

  it('should morph with comments', () => {
    actions.morph(document, parseHTMLDocument('<div class="bar"></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    actions.morph(
      from,
      `<!-- BEGIN app/components/editable_champ/editable_champ_component/editable_champ_component.html.haml -->

      <div class="foo">World</div>
      <!-- BEGIN app/components/editable_champ/editable_champ_component/editable_champ_component.html.haml -->`,
    );
    expect(from.outerHTML).toEqual('<div class="foo">World</div>');
  });

  it('should morph turbo-frame element', () => {
    actions.morph(
      document,
      parseHTMLDocument(
        '<turbo-frame id="test-frame" data-turbo-action="advance">Hello World</turbo-frame>',
      ),
    );
    const frame = document.body.firstElementChild as HTMLElement;

    actions.morph(
      frame,
      '<turbo-frame id="test-frame" data-turbo-action="advance"><div>Hello new World</div></turbo-frame>',
    );

    expect(document.body.innerHTML).toEqual(
      '<turbo-frame id="test-frame" data-turbo-action="advance"><div>Hello new World</div></turbo-frame>',
    );
  });

  it('should focus element after applying actions', async () => {
    actions.morph(
      document,
      parseHTMLDocument(
        `<div id="main">
          <button>First</button>
          <button>Click me</button>
        </div>
        <input name="name" />`,
      ),
    );
    const from = document.body.firstElementChild as HTMLDivElement;
    const firstButton = from.firstElementChild as HTMLButtonElement;
    const lastButton = from.lastElementChild as HTMLButtonElement;
    const input = document.querySelector('input') as HTMLInputElement;
    lastButton.focus();

    actions.applyActions([
      {
        action: 'update',
        targets: [from],
        fragment: parseHTMLFragment('<button>First</button>', document),
      },
    ]);
    await actions.ready();
    expect(isFocused(firstButton)).toBeTruthy();

    actions.applyActions([
      {
        action: 'update',
        targets: [from],
        fragment: parseHTMLFragment('yolo', document),
      },
    ]);
    await actions.ready();
    expect(isFocused(input)).toBeTruthy();

    actions.applyActions([
      {
        action: 'update',
        targets: [from],
        fragment: parseHTMLFragment(
          `<input name="firstName" />
          <input name="lastName" />`,
          document,
        ),
      },
      {
        action: 'focus',
        targets: 'input[name="lastName"]',
      },
      {
        action: 'remove',
        targets: 'input[name="lastName"]',
      },
    ]);
    await actions.ready();
    const firstNameInput = document.querySelector('input[name="firstName"]') as HTMLInputElement;
    expect(isFocused(firstNameInput)).toBeTruthy();

    actions.applyActions([
      {
        action: 'update',
        targets: [from],
        fragment: parseHTMLFragment(
          `<input name="firstName" />
          <input name="lastName" />`,
          document,
        ),
      },
      {
        action: 'focus',
        targets: 'input[name="lastName"]',
      },
      {
        action: 'remove',
        targets: '#main',
      },
    ]);
    await actions.ready();
    expect(isFocused(input)).toBeTruthy();

    actions.applyActions([
      {
        action: 'update',
        targets: [document.body],
        fragment: parseHTMLFragment(
          `<button name="firstButton"></button>
          <div data-turbo-focus-group>
            <input name="firstName" />
            <input name="lastName" />
          </div>
          <button name="lastButton"></button>`,
          document,
        ),
      },
      {
        action: 'focus',
        targets: 'input[name="firstName"]',
      },
      {
        action: 'remove',
        targets: 'input[name="firstName"]',
      },
    ]);
    await actions.ready();
    const lastNameInput = document.querySelector('input[name="lastName"]') as HTMLInputElement;
    expect(isFocused(lastNameInput)).toBeTruthy();

    actions.applyActions([
      {
        action: 'remove',
        targets: 'input[name="lastName"]',
      },
    ]);
    await actions.ready();
    {
      const firstButton = document.querySelector('button[name="firstButton"]') as HTMLButtonElement;
      expect(isFocused(firstButton)).toBeTruthy();
    }

    actions.applyActions([
      {
        action: 'update',
        targets: [document.body],
        fragment: parseHTMLFragment(
          `<div data-turbo-focus-direction="next">
            <input name="firstName" />
            <input name="lastName" />
            <input name="middleName" />
          </div>`,
          document,
        ),
      },
      {
        action: 'focus',
        targets: 'input[name="lastName"]',
      },
      {
        action: 'remove',
        targets: 'input[name="lastName"]',
      },
    ]);
    await actions.ready();
    const middleNameInput = document.querySelector('input[name="middleName"]') as HTMLInputElement;
    expect(isFocused(middleNameInput)).toBeTruthy();

    actions.applyActions([
      {
        action: 'hide',
        targets: 'input[name="middleName"]',
      },
    ]);
    await actions.ready();
    {
      const firstNameInput = document.querySelector('input[name="firstName"]') as HTMLButtonElement;
      expect(isFocused(firstNameInput)).toBeTruthy();
    }

    actions.applyActions([
      {
        action: 'update',
        targets: [document.body],
        fragment: parseHTMLFragment(
          `<div data-turbo-focus-direction="prev">
            <input name="firstName" />
            <input name="lastName" />
            <input name="middleName" />
          </div>`,
          document,
        ),
      },
      {
        action: 'focus',
        targets: 'input[name="lastName"]',
      },
      {
        action: 'remove',
        targets: 'input[name="lastName"]',
      },
    ]);
    await actions.ready();
    {
      const firstNameInput = document.querySelector('input[name="firstName"]') as HTMLInputElement;
      expect(isFocused(firstNameInput)).toBeTruthy();
    }

    actions.applyActions([
      {
        action: 'disable',
        targets: 'input[name="firstName"]',
      },
    ]);
    await actions.ready();
    {
      const middleNameInput = document.querySelector(
        'input[name="middleName"]',
      ) as HTMLButtonElement;
      expect(isFocused(middleNameInput)).toBeTruthy();
    }

    actions.applyActions([
      {
        action: 'update',
        targets: [document.body],
        fragment: parseHTMLFragment(
          `<div data-turbo-focus-direction="next">
            <input name="firstName" />
            <input name="lastName" />
            <input name="middleName" />
          </div>`,
          document,
        ),
      },
      {
        action: 'focus',
        targets: 'input[name="middleName"]',
      },
      {
        action: 'remove',
        targets: 'input[name="middleName"]',
      },
    ]);
    await actions.ready();
    {
      const lastNameInput = document.querySelector('input[name="lastName"]') as HTMLInputElement;
      expect(isFocused(lastNameInput)).toBeTruthy();
    }

    // FIXME: Implement replacing focusable element
    // actions.applyActions([
    //   {
    //     action: 'update',
    //     targets: [document.body],
    //     fragment: parseHTMLFragment('<input name="firstName" />', document),
    //   },
    //   {
    //     action: 'focus',
    //     targets: 'input[name="firstName"]',
    //   },
    //   {
    //     action: 'update',
    //     targets: [document.body],
    //     fragment: parseHTMLFragment('<textarea name="lastName" />', document),
    //   },
    // ]);
    // await actions.ready();
    // {
    //   const lastNameInput = document.querySelector(
    //     'textarea[name="lastName"]'
    //   ) as HTMLTextAreaElement;
    //   expect(isFocused(lastNameInput)).toBeTruthy();
    // }
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

  it.skip('should focus/disable/enable element', async () => {
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

  it('should reset form', async () => {
    actions.morph(
      document,
      parseHTMLDocument(
        '<form id="form-1"><input /> <input value="yolo" /></form> <input form="form-1" /> <input />',
      ),
    );
    const [input1, input2, input3, input4] = document.querySelectorAll('input');

    await page.elementLocator(input1).fill('test 1');
    await page.elementLocator(input3).fill('test 3');
    await page.elementLocator(input4).fill('test 4');

    expect(input1.value).toEqual('test 1');
    expect(input2.value).toEqual('yolo');
    expect(input3.value).toEqual('test 3');
    expect(input4.value).toEqual('test 4');

    actions.reset({ targets: '#form-1' });
    await actions.ready();

    expect(input1.value).toEqual('');
    expect(input2.value).toEqual('yolo');
    expect(input3.value).toEqual('');
    expect(input4.value).toEqual('test 4');
  });

  it('should preserve value', async () => {
    actions.morph(
      document,
      parseHTMLDocument(
        '<label for="test">Test</label><input id="test" name="test" type="text" value="test" />',
      ),
    );
    const input = page.getByLabelText('Test');
    await input.fill('Hello World');
    const element = input.element() as HTMLInputElement;

    element.setSelectionRange(5, 7);
    expect(element.value).toEqual('Hello World');
    actions.morph(
      document,
      parseHTMLDocument(
        '<label for="test">Test</label><input id="test" name="test" type="text" value="test" />',
      ),
    );
    expect(element.value).toEqual('Hello World');
    expect(element.selectionStart).toEqual(5);
    expect(element.selectionEnd).toEqual(7);
    actions.morph(
      document,
      parseHTMLDocument(
        '<label for="test">Test</label><input data-turbo-force="server" id="test" name="test" type="text" value="test" />',
      ),
    );
    expect(element.value).toEqual('test');
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
      parseHTMLDocument('<div hidden aria-expanded data-turbo-force="server">New Menu</div>'),
    );
    expect(from.getAttribute('aria-expanded')).toEqual('');
    expect(from.hidden).toBeTruthy();
  });

  it('should preserve style attribute', async () => {
    actions.morph(document, parseHTMLDocument('<div style="color: red;">Menu</div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    expect(from.style.cssText).toEqual('color: red;');
    from.style.backgroundColor = 'blue';
    from.style.color = '';
    await Promise.resolve();

    actions.morph(document, parseHTMLDocument('<div style="color: red;">New Menu</div>'));
    expect(from.style.cssText).toEqual('background-color: blue;');
  });

  it('should preserve html if force="client" attribute is set', async () => {
    actions.morph(document, parseHTMLDocument('<div>Hello world</div>'));
    const from = document.body.firstElementChild as HTMLDivElement;
    from.setAttribute('data-turbo-force', 'browser');
    actions.morph(document, parseHTMLDocument('<div>Bye world!</div>'));
    expect(from.textContent).toEqual('Hello world');
    actions.morph(document, parseHTMLDocument('<div>Encore !</div>'));
    expect(from.textContent).toEqual('Hello world');
    expect(from.hasAttribute('data-turbo-force')).toBeTruthy();
    actions.morph(document, parseHTMLDocument('<div data-turbo-force="server">Bye world!</div>'));
    expect(from.textContent).toEqual('Bye world!');
    expect(from.hasAttribute('data-turbo-force')).toBeFalsy();
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
        document,
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

  it('hide / show / remove global helpers', async () => {
    actions.morph(document, parseHTMLDocument('<button id="button">Click me</button>'));

    hide('#button');
    await actions.ready();
    expect(document.querySelector('#button')?.classList.contains('hidden')).toBeTruthy();

    show('#button');
    await actions.ready();
    expect(document.querySelector('#button')?.classList.contains('hidden')).toBeFalsy();

    remove('#button');
    await actions.ready();
    expect(document.querySelector('#button')).toBeNull();
  });

  it('disable / enable global helpers accept selector, element, array and null targets', async () => {
    actions.morph(document, parseHTMLDocument('<button id="button">Click me</button>'));
    const button = document.querySelector<HTMLButtonElement>('#button')!;

    disable('#button');
    await actions.ready();
    expect(button.disabled).toBeTruthy();

    enable(button);
    await actions.ready();
    expect(button.disabled).toBeFalsy();

    disable([button]);
    await actions.ready();
    expect(button.disabled).toBeTruthy();

    // Null targets must be a no-op (covers getTargets() null branch).
    enable(null);
    await actions.ready();
    expect(button.disabled).toBeTruthy();

    enable('#button');
    await actions.ready();
    expect(button.disabled).toBeFalsy();
  });

  it('append / prepend / after / before / update / replace global helpers', async () => {
    actions.morph(
      document,
      parseHTMLDocument('<div id="root"><span id="child">middle</span></div>'),
    );
    const root = document.querySelector<HTMLDivElement>('#root')!;

    append('#root', '<i class="appended">a</i>');
    await actions.ready();
    expect(root.querySelector('.appended')?.textContent).toEqual('a');

    prepend(root, '<i class="prepended">p</i>');
    await actions.ready();
    expect(root.firstElementChild?.classList.contains('prepended')).toBeTruthy();

    after('#child', '<i class="after">af</i>');
    await actions.ready();
    expect(document.querySelector('.after')).toBeTruthy();

    before('#child', '<i class="before">bf</i>');
    await actions.ready();
    expect(document.querySelector('.before')).toBeTruthy();

    update('#root', '<span>updated</span>');
    await actions.ready();
    expect(root.innerHTML).toEqual('<span>updated</span>');

    replace('#root', '<div id="root">replaced</div>');
    await actions.ready();
    expect(document.querySelector('#root')?.textContent).toEqual('replaced');
  });

  it('should preserve touched checkbox state across morph', async () => {
    actions.morph(document, parseHTMLDocument('<input id="cb" type="checkbox" name="cb" />'));
    const checkbox = document.querySelector<HTMLInputElement>('#cb')!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    expect(checkbox.checked).toBeTruthy();

    actions.morph(document, parseHTMLDocument('<input id="cb" type="checkbox" name="cb" />'));
    expect(checkbox.checked).toBeTruthy();

    actions.morph(
      document,
      parseHTMLDocument('<input id="cb" data-turbo-force="server" type="checkbox" name="cb" />'),
    );
    expect(checkbox.checked).toBeFalsy();
  });

  it('should preserve touched radio state across morph', async () => {
    actions.morph(
      document,
      parseHTMLDocument(
        '<input id="r1" type="radio" name="r" value="a" /><input id="r2" type="radio" name="r" value="b" />',
      ),
    );
    const r2 = document.querySelector<HTMLInputElement>('#r2')!;
    r2.checked = true;
    r2.dispatchEvent(new Event('change', { bubbles: true }));
    expect(r2.checked).toBeTruthy();

    actions.morph(
      document,
      parseHTMLDocument(
        '<input id="r1" type="radio" name="r" value="a" /><input id="r2" type="radio" name="r" value="b" />',
      ),
    );
    expect(r2.checked).toBeTruthy();
  });

  it('should preserve touched select option across morph', async () => {
    actions.morph(
      document,
      parseHTMLDocument(
        '<select id="s" name="s"><option value="a">A</option><option value="b">B</option></select>',
      ),
    );
    const select = document.querySelector<HTMLSelectElement>('#s')!;
    select.value = 'b';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(select.value).toEqual('b');

    actions.morph(
      document,
      parseHTMLDocument(
        '<select id="s" name="s"><option value="a">A</option><option value="b">B</option></select>',
      ),
    );
    expect(select.value).toEqual('b');
  });

  it('should short-circuit morphHead when head is identical', () => {
    const html =
      '<html><head><title>Same</title><meta name="x" content="y"></head><body><p id="p">Hello</p></body></html>';
    actions.morph(document, parseHTMLDocument(html));
    expect(document.querySelector('#p')?.textContent).toEqual('Hello');

    actions.morph(
      document,
      parseHTMLDocument(
        '<html><head><title>Same</title><meta name="x" content="y"></head><body><p id="p">World</p></body></html>',
      ),
    );
    expect(document.querySelector('#p')?.textContent).toEqual('World');
    expect(document.title).toEqual('Same');
  });
});
