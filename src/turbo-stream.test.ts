import { describe, it, expect, beforeEach } from 'vitest';
//import { getByText, getByTestId, fireEvent } from '@testing-library/dom';

import { morph, observe } from './morph';
import { parseHTMLDocument } from './utils';
import { renderTurboStream } from './turbo-stream';

describe('@coldwired/turbo-stream', () => {
  let dispose: (() => void) | undefined;

  beforeEach(async () => {
    dispose?.();
    document.body.innerHTML = '';
    dispose = observe();
  });

  it('should append', async () => {
    morph(document, parseHTMLDocument('<div id="test1"><h1>Bonjour</h1></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    await renderTurboStream(
      '<turbo-stream action="append" target="test1"><template><div id="test2">World</div></template></turbo-stream>',
      document.body
    );
    expect(from.innerHTML).toBe('<h1>Bonjour</h1><div id="test2">World</div>');
  });

  it('should prepend', async () => {
    morph(document, parseHTMLDocument('<div id="test1"><h1>Bonjour</h1></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    await renderTurboStream(
      '<turbo-stream action="prepend" target="test1"><template><div id="test2">World</div></template></turbo-stream>',
      document.body
    );
    expect(from.innerHTML).toBe('<div id="test2">World</div><h1>Bonjour</h1>');
  });

  it('should add before', async () => {
    morph(document, parseHTMLDocument('<div id="test1"></div><div id="test2"></div>'));

    await renderTurboStream(
      '<turbo-stream action="before" target="test2"><template><div id="test2">World</div></template></turbo-stream>',
      document.body
    );
    expect(document.body.innerHTML).toBe(
      '<div id="test1"></div><div id="test2">World</div><div id="test2"></div>'
    );
  });

  it('should add after', async () => {
    morph(document, parseHTMLDocument('<div id="test1"></div><div id="test2"></div>'));

    await renderTurboStream(
      '<turbo-stream action="after" target="test1"><template><div id="test2">World</div></template></turbo-stream>',
      document.body
    );
    expect(document.body.innerHTML).toBe(
      '<div id="test1"></div><div id="test2">World</div><div id="test2"></div>'
    );
  });

  it('should replace', async () => {
    morph(document, parseHTMLDocument('<div id="test1"><h1>Bonjour</h1></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    await renderTurboStream(
      '<turbo-stream action="replace" target="test1"><template><div id="test1">World</div></template></turbo-stream>',
      document.body
    );
    expect(from.outerHTML).toBe('<div id="test1">World</div>');
  });

  it('should update', async () => {
    morph(document, parseHTMLDocument('<div id="test1"><h1>Bonjour</h1></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    await renderTurboStream(
      '<turbo-stream action="update" target="test1"><template><div id="test2">World</div></template></turbo-stream>',
      document.body
    );
    expect(from.outerHTML).toBe('<div id="test1"><div id="test2">World</div></div>');
  });

  it('should update with text', async () => {
    morph(document, parseHTMLDocument('<div id="test1"><h1>Bonjour</h1></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    await renderTurboStream(
      '<turbo-stream action="update" target="test1"><template>Hello</template></turbo-stream>',
      document.body
    );
    expect(from.outerHTML).toBe('<div id="test1">Hello</div>');
  });

  it('should remove', async () => {
    morph(document, parseHTMLDocument('<div id="test1"></div><div id="test2"></div>'));

    await renderTurboStream(
      '<turbo-stream action="remove" target="test1"></turbo-stream>',
      document.body
    );
    expect(document.body.innerHTML).toBe('<div id="test2"></div>');
  });

  it('should remove all', async () => {
    morph(document, parseHTMLDocument('<div id="test1"></div><div id="test2"></div>'));

    await renderTurboStream(
      '<turbo-stream action="remove" targets="div"></turbo-stream>',
      document.body
    );
    expect(document.body.innerHTML).toBe('');
  });

  it('should remove with delay', async () => {
    morph(document, parseHTMLDocument('<div id="test1"></div><div id="test2"></div>'));

    const start = performance.now();
    await renderTurboStream(
      '<turbo-stream action="remove" targets="div" delay="20"></turbo-stream>',
      document.body
    );
    const end = performance.now();
    expect(end - start).toBeGreaterThan(20);
    expect(document.body.innerHTML).toBe('');
  });

  it('should cancel delay', async () => {
    morph(document, parseHTMLDocument('<div id="test1"></div><div id="test2"></div>'));

    expect.assertions(2);

    const controller = new AbortController();
    const start = performance.now();
    const done = renderTurboStream(
      '<turbo-stream action="remove" target="test1" delay="20"></turbo-stream>',
      document.body,
      {
        signal: controller.signal,
      }
    ).then(() => {
      const end = performance.now();
      expect(end - start).toBeLessThan(20);
      expect(document.body.innerHTML).toBe('<div id="test1"></div><div id="test2"></div>');
    });
    controller.abort();
    return done;
  });
});
