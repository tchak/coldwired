/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, beforeEach, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { getByText, fireEvent } from '@testing-library/dom';

import { ContentType, defaultSchema, Application, type RouteObject } from '.';

export const handlers = [
  rest.get('/', (_, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('content-type', ContentType.HTML),
      ctx.body(html('<h1>Hello world!</h1>'))
    );
  }),
  rest.get('/about', (_, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('content-type', ContentType.HTML),
      ctx.body(html('<h1>About</h1><a href="/">Home</a>', 'About'))
    );
  }),
  rest.get('/yolo', (_, res, ctx) => {
    return res(
      ctx.status(404),
      ctx.set('content-type', ContentType.HTML),
      ctx.body(html('<h1>Not Found</h1>', 'Not Found'))
    );
  }),
  rest.get('/forms', (_, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('content-type', ContentType.HTML),
      ctx.body(
        html(
          `<h1>Form</h1>
          <form method="post">
            <input name="firstName" value="Paul">
            <input type="submit" value="Submit">
          </form>`,
          'Form'
        )
      )
    );
  }),
  rest.get('/forms/submit-on-change', (_, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('content-type', ContentType.HTML),
      ctx.body(
        html(
          `<h1>Submit on change form</h1>
          <form method="post" action="/forms" data-turbo-submit-on-change>
            <input name="firstName" value="Paul">
            <input type="checkbox" name="accept" value="true">
          </form>`,
          'Submit on change form'
        )
      )
    );
  }),
  rest.get('/forms/redirect-to-self', (_, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('content-type', ContentType.HTML),
      ctx.body(
        html(
          `<h1>Form ${Date.now()}</h1>
          <form method="post">
            <input name="firstName" value="Paul">
            <input type="submit" value="Submit">
          </form>`,
          'Form'
        )
      )
    );
  }),
  rest.post('/forms', (_, res, ctx) => {
    return res(ctx.status(204), ctx.set('x-coldwire-redirect', '/about'));
  }),
  rest.post('/forms/redirect-to-self', (_, res, ctx) => {
    return res(ctx.status(204), ctx.set('x-coldwire-redirect', '/forms/redirect-to-self'));
  }),
  rest.get('/forms/fetcher', (_, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('content-type', ContentType.HTML),
      ctx.body(
        html(
          `<h1>Fetcher</h1>
          <div id="item">Item</div>
          <form data-turbo-fetcher id="fetcher1" method="post" action="/forms/fetcher">
            <input name="firstName" value="Paul">
            <input type="submit" value="Submit" data-turbo-disable-with="Submitting">
          </form>
          <form data-turbo-fetcher method="post" action="/turbo-stream">
            <input type="submit" value="Delete">
          </form>`,
          'Fetcher'
        )
      )
    );
  }),
  rest.post('/forms/fetcher', (_, res, ctx) => {
    return res(ctx.status(204), ctx.set('x-coldwire-redirect', '/about'));
  }),
  rest.post('/turbo-stream', (_, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('content-type', ContentType.TurboStream),
      ctx.body(`<turbo-stream target="item" action="remove"></turbo-stream>
      <turbo-stream target="fetcher1" action="after">
        <template>
          <p>A message after</p>
        </template>
      </turbo-stream>
      <turbo-stream target="fetcher1" action="before">
        <template>
          <p>A message before</p>
        </template>
      </turbo-stream>
      <turbo-stream targets="h1" action="update">
        <template>
          Fetcher!
        </template>
      </turbo-stream>`)
    );
  }),
  rest.get('/http-override', (_, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('content-type', ContentType.HTML),
      ctx.body(html('<form method="patch"><button type="submit">Send</button></form>'))
    );
  }),
  rest.post('/http-override', async (req, res, ctx) => {
    const body = await req.text();
    return res(
      ctx.status(200),
      ctx.set('content-type', ContentType.HTML),
      ctx.body(html(`<code>${body}</code>`))
    );
  }),
];

const server = setupServer(...handlers);

const routes: () => RouteObject[] = () => [
  { path: '/', handle: { method: 'get' } },
  { path: '/about', handle: { method: ['get'] } },
  { path: '/forms/submit-on-change', handle: { method: ['get'] } },
  { path: '/forms/redirect-to-self', handle: { method: ['get', 'post'] } },
  { path: '/forms', handle: { method: ['get', 'post'] } },
  { path: '/forms/fetcher', handle: { method: ['get', 'post'] } },
  { path: '/turbo-stream', handle: { method: 'post' } },
];

const html = (body: string, title = 'Title') =>
  `<html>
    <head>
      <title>${title}</title>
    </head>
    <body data-turbo>${body}</body>
  </html>`;

function currentNavigationState() {
  return document.documentElement.getAttribute(defaultSchema.navigationStateAttribute);
}

function currentFetcherState(target: Element | null) {
  return target?.getAttribute(defaultSchema.fetcherStateAttribute);
}

describe('@coldwired/router', () => {
  let application: Application;

  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

  afterAll(() => server.close());

  beforeEach(async () => {
    document.body.innerHTML = '';
    application?.stop();
    application = await Application.start({ routes: routes(), adapter: 'memory' });
  });

  afterEach(() => server.resetHandlers());

  it('should handle link navigation', async () => {
    expect(application.state.location.pathname).toEqual('/');
    expect(document.body.innerHTML).toEqual('');

    application.navigate('/about?foo=bar');
    expect(currentNavigationState()).toEqual('loading');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(application.state.location.pathname).toEqual('/about');
    expect(application.state.location.search).toEqual('?foo=bar');
    expect(document.body.innerHTML).toMatch('<h1>About</h1><a href="/">Home</a>');
    expect(document.querySelector('title')?.textContent).toEqual('About');
    expect(currentNavigationState()).toEqual('idle');

    click(getByText(document.body, 'Home'));
    expect(currentNavigationState()).toEqual('loading');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(application.state.location.pathname).toEqual('/');
    expect(document.body.innerHTML).toMatch('<h1>Hello world!</h1>');
    expect(document.querySelector('title')?.textContent).toEqual('Title');
    expect(currentNavigationState()).toEqual('idle');
  });

  it('should handle not found errors', async () => {
    application.navigate('/yolo');
    expect(currentNavigationState()).toEqual('loading');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(application.state.location.pathname).toEqual('/yolo');
    expect(document.body.innerHTML).toMatch('<h1>Not Found</h1>');
  });

  it('should handle form submits', async () => {
    application.navigate('/forms');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(application.state.location.pathname).toEqual('/forms');

    click(getByText(document.body, 'Submit'));
    expect(currentNavigationState()).toEqual('submitting');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(currentNavigationState()).toEqual('loading');
    expect(application.state.navigation.formData?.get('firstName')).toEqual('Paul');

    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(application.state.location.pathname).toEqual('/about');
    expect(currentNavigationState()).toEqual('idle');
  });

  it('should redirect to self', async () => {
    application.navigate('/forms/redirect-to-self');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(application.state.location.pathname).toEqual('/forms/redirect-to-self');

    click(getByText(document.body, 'Submit'));
    expect(currentNavigationState()).toEqual('submitting');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(application.state.location.pathname).toEqual('/forms/redirect-to-self');

    let text = document.querySelector('h1')?.textContent;
    application.revalidate();
    await waitForEvent(defaultSchema.revalidationStateChangeEvent);
    const newText = document.querySelector('h1')?.textContent;

    expect(text?.startsWith('Form')).toBeTruthy();
    expect(newText?.startsWith('Form')).toBeTruthy();
    expect(text).not.toEqual(newText);

    await application.render(
      '<turbo-stream action="update" targets="h1" pin="last"><template>New Form</template></turbo-stream>'
    );

    await application.render(
      '<turbo-stream action="append" targets="form" pin><template><p class="e">error1</p></template></turbo-stream>'
    );
    await application.render(
      '<turbo-stream action="append" targets="form" pin><template><p class="e">error2</p></template></turbo-stream>'
    );

    await application.render(
      '<turbo-stream action="prepend" targets="form" pin="last"><template><p>warning1</p></template></turbo-stream>'
    );
    await application.render(
      '<turbo-stream action="prepend" targets="form" pin="last"><template><p>warning2</p></template></turbo-stream>'
    );

    text = document.querySelector('h1')?.textContent;
    expect(text).toEqual('New Form');

    let errors = [...document.querySelectorAll('form p.e')].map((p) => p.textContent);
    expect(errors).toEqual(['error1', 'error2']);
    let warnings = [...document.querySelectorAll('form p:not(.e)')].map((p) => p.textContent);
    expect(warnings).toEqual(['warning2', 'warning1']);

    application.revalidate();
    await waitForEvent(defaultSchema.revalidationStateChangeEvent);

    text = document.querySelector('h1')?.textContent;
    expect(text).toEqual('New Form');

    errors = [...document.querySelectorAll('form p.e')].map((p) => p.textContent);
    expect(errors).toEqual(['error1', 'error2']);
    warnings = [...document.querySelectorAll('form p:not(.e)')].map((p) => p.textContent);
    expect(warnings).toEqual(['warning2']);

    application.navigate('/about');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    application.navigate('/forms/redirect-to-self');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);

    text = document.querySelector('h1')?.textContent;
    expect(text).not.toEqual('New Form');
    expect(text?.startsWith('Form')).toBeTruthy();
    errors = [...document.querySelectorAll('form p')].map((p) => p.textContent);
    expect(errors).toEqual([]);
  });

  it('should submit forms with `submit-on-change` directive', async () => {
    application.navigate('/forms/submit-on-change');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(application.state.location.pathname).toEqual('/forms/submit-on-change');

    const checkbox = document.querySelector<HTMLInputElement>('input[name="accept"]');
    click(checkbox!);
    expect(currentNavigationState()).toEqual('submitting');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(currentNavigationState()).toEqual('loading');
    expect(application.state.navigation.formData?.get('firstName')).toEqual('Paul');
    expect(application.state.navigation.formData?.get('accept')).toEqual('true');

    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(application.state.location.pathname).toEqual('/about');
    expect(currentNavigationState()).toEqual('idle');
  });

  it('should handle form submits with `fetcher` directive', async () => {
    application.navigate('/forms/fetcher');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(application.state.location.pathname).toEqual('/forms/fetcher');

    document.querySelector('h1')?.classList.add('active');
    expect(document.body.innerHTML).toMatch('<h1 class="active">Fetcher</h1>');
    const submit = getByText<HTMLInputElement>(document.body, 'Submit');
    click(submit);
    expect(currentFetcherState(document.querySelector('form'))).toEqual('submitting');
    expect(submit.disabled).toEqual(true);
    expect(submit.value).toEqual('Submitting');
    await waitForEvent(defaultSchema.fetcherStateChangeEvent);
    expect(currentFetcherState(document.querySelector('form'))).toEqual('loading');
    expect(application.state.fetchers.get('fetcher1')?.formData?.get('firstName')).toEqual('Paul');
    expect(submit.disabled).toEqual(false);
    expect(submit.value).toEqual('Submit');

    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(document.body.innerHTML).toMatch('<h1>About</h1>');
    expect(application.state.location.pathname).toEqual('/about');
    expect(currentNavigationState()).toEqual('idle');
  });

  it('should handle responses with `turbo-stream` actions', async () => {
    application.navigate('/forms/fetcher');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(application.state.location.pathname).toEqual('/forms/fetcher');

    const body = document.body.innerHTML;
    expect(body).toMatch('Item');
    expect(body).toMatch('<h1>Fetcher</h1>');
    expect(body).not.toMatch('<p>A message after</a>');
    expect(body).not.toMatch('<p>A message before</a>');

    click(getByText(document.body, 'Delete'));
    await waitForEvent(defaultSchema.fetcherStateChangeEvent);
    await waitForEvent(defaultSchema.fetcherStateChangeEvent);
    await waitForNextAnimationFrame();

    const newBody = document.body.innerHTML;
    expect(newBody).not.toMatch('Item');
    expect(newBody).toMatch('Fetcher!');
    expect(newBody).toMatch('<p>A message after</p>');
    expect(newBody).toMatch('<p>A message before</p>');
  });

  it('should use http method override', async () => {
    application.stop();
    application = await Application.start({
      routes: routes(),
      adapter: 'memory',
      httpMethodOverride: true,
    });
    application.navigate('/http-override');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(application.state.location.pathname).toEqual('/http-override');
    await waitForNextAnimationFrame();
    click(getByText(document.body, 'Send'));
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(document.body.firstChild?.textContent).toEqual('_method=patch');
  });
});

const waitForEvent = (event: string) =>
  new Promise((resolve) => addEventListener(event, resolve, { once: true }));

function click(target: HTMLElement & { form?: HTMLFormElement | null }) {
  fireEvent(target, new MouseEvent('click', { bubbles: true }));
}

const waitForNextAnimationFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
