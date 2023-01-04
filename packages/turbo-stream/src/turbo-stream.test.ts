import { describe, it, expect, beforeEach } from 'vitest';

import { Actions } from '@coldwired/actions';
import { parseHTMLDocument } from '@coldwired/utils';

import { TurboStream } from '.';

describe('@coldwired/turbo-stream', () => {
  let actions: Actions;
  let turboStream: TurboStream;

  beforeEach(async () => {
    actions?.stop();
    actions = new Actions({ element: document.documentElement });
    document.body.innerHTML = '';
    actions.start();
    turboStream = new TurboStream({ actions });
  });

  it('should append', async () => {
    actions.morph(document, parseHTMLDocument('<div id="test1"><h1>Bonjour</h1></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    await turboStream.render(
      '<turbo-stream action="append" target="test1"><template><div id="test2">World</div></template></turbo-stream>'
    );
    expect(from.innerHTML).toBe('<h1>Bonjour</h1><div id="test2">World</div>');
  });

  it('should prepend', async () => {
    actions.morph(document, parseHTMLDocument('<div id="test1"><h1>Bonjour</h1></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    await turboStream.render(
      '<turbo-stream action="prepend" target="test1"><template><div id="test2">World</div></template></turbo-stream>'
    );
    expect(from.innerHTML).toBe('<div id="test2">World</div><h1>Bonjour</h1>');
  });

  it('should add before', async () => {
    actions.morph(document, parseHTMLDocument('<div id="test1"></div><div id="test2"></div>'));

    await turboStream.render(
      '<turbo-stream action="before" target="test2"><template><div id="test2">World</div></template></turbo-stream>'
    );
    expect(document.body.innerHTML).toBe(
      '<div id="test1"></div><div id="test2">World</div><div id="test2"></div>'
    );
  });

  it('should add after', async () => {
    actions.morph(document, parseHTMLDocument('<div id="test1"></div><div id="test2"></div>'));

    await turboStream.render(
      '<turbo-stream action="after" target="test1"><template><div id="test2">World</div></template></turbo-stream>'
    );
    expect(document.body.innerHTML).toBe(
      '<div id="test1"></div><div id="test2">World</div><div id="test2"></div>'
    );
  });

  it('should replace', async () => {
    actions.morph(document, parseHTMLDocument('<div id="test1"><h1>Bonjour</h1></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    await turboStream.render(
      '<turbo-stream action="replace" target="test1"><template><div id="test1">World</div></template></turbo-stream>'
    );
    expect(from.outerHTML).toBe('<div id="test1">World</div>');
  });

  it('should update', async () => {
    actions.morph(document, parseHTMLDocument('<div id="test1"><h1>Bonjour</h1></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    await turboStream.render(
      '<turbo-stream action="update" target="test1"><template><div id="test2">World</div></template></turbo-stream>'
    );
    expect(from.outerHTML).toBe('<div id="test1"><div id="test2">World</div></div>');
  });

  it('should update with text', async () => {
    actions.morph(document, parseHTMLDocument('<div id="test1"><h1>Bonjour</h1></div>'));
    const from = document.body.firstElementChild as HTMLDivElement;

    await turboStream.render(
      '<turbo-stream action="update" target="test1"><template>Hello</template></turbo-stream>'
    );
    expect(from.outerHTML).toBe('<div id="test1">Hello</div>');
  });

  it('should remove', async () => {
    actions.morph(document, parseHTMLDocument('<div id="test1"></div><div id="test2"></div>'));

    await turboStream.render('<turbo-stream action="remove" target="test1"></turbo-stream>');
    expect(document.body.innerHTML).toBe('<div id="test2"></div>');
  });

  it('should remove all', async () => {
    actions.morph(document, parseHTMLDocument('<div id="test1"></div><div id="test2"></div>'));

    await turboStream.render('<turbo-stream action="remove" targets="div"></turbo-stream>');
    expect(document.body.innerHTML).toBe('');
  });

  it('should remove with delay', async () => {
    actions.morph(document, parseHTMLDocument('<div id="test1"></div><div id="test2"></div>'));

    const start = performance.now();
    await turboStream.render(
      '<turbo-stream action="remove" targets="div" delay="20"></turbo-stream>'
    );
    const end = performance.now();
    expect(end - start).toBeGreaterThan(20);
    expect(document.body.innerHTML).toBe('');
  });

  it('should cancel delay', async () => {
    actions.morph(document, parseHTMLDocument('<div id="test1"></div><div id="test2"></div>'));

    expect.assertions(2);

    const start = performance.now();
    const done = turboStream
      .render('<turbo-stream action="remove" target="test1" delay="20"></turbo-stream>')
      .then(() => {
        const end = performance.now();
        expect(end - start).toBeLessThan(20);
        expect(document.body.innerHTML).toBe('<div id="test1"></div><div id="test2"></div>');
      });
    actions.reset();
    return done;
  });
});
