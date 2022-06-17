import { describe, test, beforeEach, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { getByText, fireEvent } from '@testing-library/dom';

import { createMemoryTurboRouter, ContentType } from '.';
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
            <input type="submit" value="Submit">
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
  { path: '/', handle: { _loader: true } },
  { path: '/about', handle: { _loader: true } },
  { path: '/forms/submit-on-change', handle: { _loader: true } },
  { path: '/forms', handle: { _loader: true, _action: true } },
  { path: '/forms/fetcher', handle: { _loader: true, _action: true } },
  { path: '/turbo-stream', handle: { _action: true } },
];

const html = (body: string, title = 'Title') =>
  `<html>
    <head>
      <title>${title}</title>
    </head>
    <body>${body}</body>
  </html>`;

describe('remix router turbo', () => {
  let router: Router;

  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

  afterAll(() => server.close());

  beforeEach(() => {
    router?.dispose();
    router = createMemoryTurboRouter({ routes: routes(), debug: false });
  });

  afterEach(() => server.resetHandlers());

  test('navigate', async () => {
    expect(router.state.location.pathname).toEqual('/');
    expect(document.body.innerHTML).toEqual('');

    router.navigate('/about');
    expect(document.documentElement.dataset.turboNavigationState).toEqual('loading');
    await waitForEvent('turbo:navigation');
    expect(router.state.location.pathname).toEqual('/about');
    expect(document.body.innerHTML).toEqual('<h1>About</h1><a href="/">Home</a>');
    expect(document.querySelector('title')?.textContent).toEqual('About');
    expect(document.documentElement.dataset.turboNavigationState).toEqual('idle');

    click(getByText(document.body, 'Home'));
    expect(document.documentElement.dataset.turboNavigationState).toEqual('loading');
    await waitForEvent('turbo:navigation');
    expect(router.state.location.pathname).toEqual('/');
    expect(document.body.innerHTML).toEqual('<h1>Hello world!</h1>');
    expect(document.querySelector('title')?.textContent).toEqual('Title');
    expect(document.documentElement.dataset.turboNavigationState).toEqual('idle');
  });

  test('not found', async () => {
    router.navigate('/yolo');
    expect(document.documentElement.dataset.turboNavigationState).toEqual('loading');
    await waitForEvent('turbo:navigation');
    expect(router.state.location.pathname).toEqual('/yolo');
    expect(document.body.innerHTML).toEqual('<h1>Not Found</h1>');
  });

  test('submit', async () => {
    router.navigate('/forms');
    await waitForEvent('turbo:navigation');
    expect(router.state.location.pathname).toEqual('/forms');

    click(getByText(document.body, 'Submit'));
    expect(document.documentElement.dataset.turboNavigationState).toEqual('submitting');
    await waitForEvent('turbo:navigation');
    expect(document.documentElement.dataset.turboNavigationState).toEqual('loading');
    expect(router.state.navigation.formData?.get('firstName')).toEqual('Paul');

    await waitForEvent('turbo:navigation');
    expect(router.state.location.pathname).toEqual('/about');
    expect(document.documentElement.dataset.turboNavigationState).toEqual('idle');
  });

  test('submit-on-change', async () => {
    router.navigate('/forms/submit-on-change');
    await waitForEvent('turbo:navigation');
    expect(router.state.location.pathname).toEqual('/forms/submit-on-change');

    const checkbox = document.querySelector<HTMLInputElement>('input[name="accept"]');
    change(checkbox!);
    expect(document.documentElement.dataset.turboNavigationState).toEqual('submitting');
    await waitForEvent('turbo:navigation');
    expect(document.documentElement.dataset.turboNavigationState).toEqual('loading');
    expect(router.state.navigation.formData?.get('firstName')).toEqual('Paul');
    expect(router.state.navigation.formData?.get('accept')).toEqual('true');

    await waitForEvent('turbo:navigation');
    expect(router.state.location.pathname).toEqual('/about');
    expect(document.documentElement.dataset.turboNavigationState).toEqual('idle');
  });

  test('fetcher', async () => {
    router.navigate('/forms/fetcher');
    await waitForEvent('turbo:navigation');
    expect(router.state.location.pathname).toEqual('/forms/fetcher');

    click(getByText(document.body, 'Submit'));
    expect(document.querySelector('form')?.dataset.turboFetcherState).toEqual('submitting');
    await waitForEvent('turbo:fetcher');
    expect(document.querySelector('form')?.dataset.turboFetcherState).toEqual('loading');
    expect(router.state.fetchers.get('fetcher1')?.formData?.get('firstName')).toEqual('Paul');

    await waitForEvent('turbo:navigation');
    expect(router.state.location.pathname).toEqual('/about');
    expect(document.documentElement.dataset.turboNavigationState).toEqual('idle');
  });

  test('fetcher turbo-stream', async () => {
    router.navigate('/forms/fetcher');
    await waitForEvent('turbo:navigation');
    expect(router.state.location.pathname).toEqual('/forms/fetcher');

    const body = document.body.innerHTML;
    expect(body).toMatch('Item');
    expect(body).toMatch('<h1>Fetcher</h1>');
    expect(body).not.toMatch('<p>A message after</a>');
    expect(body).not.toMatch('<p>A message before</a>');

    click(getByText(document.body, 'Delete'));
    await waitForEvent('turbo:fetcher');
    await waitForEvent('turbo:fetcher');
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

function click(target: HTMLElement & { form?: HTMLFormElement }) {
  document.documentElement.addEventListener('click', onClickSubmitter, {
    once: true,
  });
  fireEvent(target, new MouseEvent('click', { bubbles: true }));
  document.documentElement.removeEventListener('click', onClickSubmitter);
}

function change(target: HTMLInputElement) {
  fireEvent(target, new CustomEvent('change', { bubbles: true }));
}

const waitForNextAnimationFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

function onClickSubmitter(event: Event) {
  const target = event.target as { form?: HTMLFormElement };
  if (target.form) {
    const event = new CustomEvent('submit', { bubbles: true });
    Object.assign(event, { submitter: target });
    fireEvent(target.form, event);
  }
}
