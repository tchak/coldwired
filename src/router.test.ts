/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, beforeEach, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { getByText, fireEvent } from '@testing-library/dom';

import { createMemoryTurboRouter, ContentType, defaultSchema } from '.';
import type { RouteObject, Router } from '.';

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
          <form method="post" action="/forms">
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
          <form method="post" action="/forms" data-controller="submit-on-change">
            <input name="firstName" value="Paul">
            <input type="checkbox" name="accept" value="true">
          </form>`,
          'Submit on change form'
        )
      )
    );
  }),
  rest.post('/forms', (_, res, ctx) => {
    return res(ctx.status(204), ctx.set('x-remix-redirect', '/about'));
  }),
  rest.get('/forms/fetcher', (_, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('content-type', ContentType.HTML),
      ctx.body(
        html(
          `<h1>Fetcher</h1>
          <div id="item">Item</div>
          <form data-controller="fetcher" id="fetcher1" method="post" action="/forms/fetcher">
            <input name="firstName" value="Paul">
            <input type="submit" value="Submit" data-turbo-disable-with="Submitting">
          </form>
          <form data-controller="fetcher" method="post" action="/turbo-stream">
            <input type="submit" value="Delete">
          </form>`,
          'Fetcher'
        )
      )
    );
  }),
  rest.post('/forms/fetcher', (_, res, ctx) => {
    return res(ctx.status(204), ctx.set('x-remix-redirect', '/about'));
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
];

const server = setupServer(...handlers);

const routes: () => RouteObject[] = () => [
  { path: '/', handle: { method: 'get' } },
  { path: '/about', handle: { method: ['get'] } },
  { path: '/forms/submit-on-change', handle: { method: ['get'] } },
  { path: '/forms', handle: { method: ['get', 'post'] } },
  { path: '/forms/fetcher', handle: { method: ['get', 'post'] } },
  { path: '/turbo-stream', handle: { method: 'post' } },
];

const html = (body: string, title = 'Title') =>
  `<html>
    <head>
      <title>${title}</title>
    </head>
    <body>${body}</body>
  </html>`;

function currentNavigationState() {
  return document.documentElement.getAttribute(defaultSchema.navigationStateAttribute);
}

function currentFetcherState(target: Element | null) {
  return target?.getAttribute(defaultSchema.fetcherStateAttribute);
}

describe('remix router turbo', () => {
  let router: Router;

  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

  afterAll(() => server.close());

  beforeEach(() => {
    document.body.innerHTML = '';
    router?.dispose();
    router = createMemoryTurboRouter({ routes: routes(), debug: false });
  });

  afterEach(() => server.resetHandlers());

  it('should handle link navigation', async () => {
    expect(router.state.location.pathname).toEqual('/');
    expect(document.body.innerHTML).toEqual('');

    router.navigate('/about?foo=bar');
    expect(currentNavigationState()).toEqual('loading');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(router.state.location.pathname).toEqual('/about');
    expect(router.state.location.search).toEqual('?foo=bar');
    expect(document.body.innerHTML).toMatch('<h1>About</h1><a href="/">Home</a>');
    expect(document.querySelector('title')?.textContent).toEqual('About');
    expect(currentNavigationState()).toEqual('idle');

    click(getByText(document.body, 'Home'));
    expect(currentNavigationState()).toEqual('loading');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(router.state.location.pathname).toEqual('/');
    expect(document.body.innerHTML).toMatch('<h1>Hello world!</h1>');
    expect(document.querySelector('title')?.textContent).toEqual('Title');
    expect(currentNavigationState()).toEqual('idle');
  });

  it('should handle not found errors', async () => {
    router.navigate('/yolo');
    expect(currentNavigationState()).toEqual('loading');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(router.state.location.pathname).toEqual('/yolo');
    expect(document.body.innerHTML).toMatch('<h1>Not Found</h1>');
  });

  it('should handle form submits', async () => {
    router.navigate('/forms');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(router.state.location.pathname).toEqual('/forms');

    click(getByText(document.body, 'Submit'));
    expect(currentNavigationState()).toEqual('submitting');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(currentNavigationState()).toEqual('loading');
    expect(router.state.navigation.formData?.get('firstName')).toEqual('Paul');

    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(router.state.location.pathname).toEqual('/about');
    expect(currentNavigationState()).toEqual('idle');
  });

  it('should submit forms with `submit-on-change` directive', async () => {
    router.navigate('/forms/submit-on-change');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(router.state.location.pathname).toEqual('/forms/submit-on-change');

    const checkbox = document.querySelector<HTMLInputElement>('input[name="accept"]');
    click(checkbox!);
    expect(currentNavigationState()).toEqual('submitting');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(currentNavigationState()).toEqual('loading');
    expect(router.state.navigation.formData?.get('firstName')).toEqual('Paul');
    expect(router.state.navigation.formData?.get('accept')).toEqual('true');

    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(router.state.location.pathname).toEqual('/about');
    expect(currentNavigationState()).toEqual('idle');
  });

  it('should handle form submits with `fetcher` directive', async () => {
    router.navigate('/forms/fetcher');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(router.state.location.pathname).toEqual('/forms/fetcher');

    document.querySelector('h1')?.setAttribute(defaultSchema.permanentAttribute, 'client');
    document.querySelector('h1')?.classList.add('active');
    expect(document.body.innerHTML).toMatch(
      '<h1 data-turbo-permanent="client" class="active">Fetcher</h1>'
    );
    const submit = getByText<HTMLInputElement>(document.body, 'Submit');
    click(submit);
    expect(currentFetcherState(document.querySelector('form'))).toEqual('submitting');
    expect(submit.disabled).toEqual(true);
    expect(submit.value).toEqual('Submitting');
    await waitForEvent(defaultSchema.fetcherStateChangeEvent);
    expect(currentFetcherState(document.querySelector('form'))).toEqual('loading');
    expect(router.state.fetchers.get('fetcher1')?.formData?.get('firstName')).toEqual('Paul');
    expect(submit.disabled).toEqual(false);
    expect(submit.value).toEqual('Submit');

    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(document.body.innerHTML).toMatch(
      '<h1 data-turbo-permanent="client" class="active">About</h1>'
    );
    document.querySelector('h1')?.classList.remove('active');
    expect(document.body.innerHTML).toMatch(
      '<h1 data-turbo-permanent="client" class="">About</h1>'
    );
    expect(router.state.location.pathname).toEqual('/about');
    expect(currentNavigationState()).toEqual('idle');
  });

  it('should handle responses with `turbo-stream` actions', async () => {
    router.navigate('/forms/fetcher');
    await waitForEvent(defaultSchema.navigationStateChangeEvent);
    expect(router.state.location.pathname).toEqual('/forms/fetcher');

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
});

const waitForEvent = (event: string) =>
  new Promise((resolve) => addEventListener(event, resolve, { once: true }));

function click(target: HTMLElement & { form?: HTMLFormElement | null }) {
  fireEvent(target, new MouseEvent('click', { bubbles: true }));
}

const waitForNextAnimationFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
