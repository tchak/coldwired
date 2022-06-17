import { describe, test, beforeEach, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { getByText, fireEvent } from '@testing-library/dom';

import { createMemoryTurboRouter } from '.';
import type { RouteObject, Router } from '.';

export const handlers = [
  rest.get('/', (_, res, ctx) => {
    return res(ctx.status(200), ctx.text(html('<h1>Hello world!</h1>')));
  }),
  rest.get('/about', (_, res, ctx) => {
    return res(ctx.status(200), ctx.text(html('<h1>About</h1><a href="/">Home</a>', 'About')));
  }),
  rest.get('/form', (_, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.text(
        html(
          '<h1>Form</h1><form method="post" action="/form"><input name="firstName" value="Paul"><input type="submit" value="Submit"></form>',
          'Form'
        )
      )
    );
  }),
  rest.post('/form', (_, res, ctx) => {
    return res(ctx.status(204), ctx.set('x-remix-redirect', '/about'));
  }),
  rest.get('/fetcher', (_, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.text(
        html(
          '<h1>Form</h1><form data-controller="fetcher" id="fetcher1" method="post" action="/fetcher"><input name="firstName" value="Paul"><input type="submit" value="Submit"></form>',
          'Form'
        )
      )
    );
  }),
  rest.post('/fetcher', (_, res, ctx) => {
    return res(ctx.status(204), ctx.set('x-remix-redirect', '/about'));
  }),
];

const server = setupServer(...handlers);

const routes: () => RouteObject[] = () => [
  { path: '/', id: 'root', handle: { _loader: true } },
  { path: '/about', id: 'about', handle: { _loader: true } },
  { path: '/form', id: 'form', handle: { _loader: true, _action: true } },
  { path: '/fetcher', id: 'fetcher', handle: { _loader: true, _action: true } },
];

const html = (body: string, title = 'Title') =>
  `<html><head><title>${title}</title></head><body>${body}</body></html>`;

describe('remix router turbo', () => {
  let router: Router;

  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

  afterAll(() => server.close());

  beforeEach(() => {
    router?.dispose();
    router = createMemoryTurboRouter({ routes: routes() });
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

  test('submit', async () => {
    router.navigate('/form');
    await waitForEvent('turbo:navigation');
    expect(router.state.location.pathname).toEqual('/form');

    click(getByText(document.body, 'Submit'));
    expect(document.documentElement.dataset.turboNavigationState).toEqual('submitting');
    await waitForEvent('turbo:navigation');
    expect(document.documentElement.dataset.turboNavigationState).toEqual('loading');
    expect(router.state.navigation.formData?.get('firstName')).toEqual('Paul');

    await waitForEvent('turbo:navigation');
    expect(router.state.location.pathname).toEqual('/about');
    expect(document.documentElement.dataset.turboNavigationState).toEqual('idle');
  });

  test('fetcher', async () => {
    router.navigate('/fetcher');
    await waitForEvent('turbo:navigation');
    expect(router.state.location.pathname).toEqual('/fetcher');

    click(getByText(document.body, 'Submit'));
    expect(document.querySelector('form')?.dataset.turboFetcherState).toEqual('submitting');
    await waitForEvent('turbo:fetcher');
    expect(document.querySelector('form')?.dataset.turboFetcherState).toEqual('loading');
    expect(router.state.navigation.formData?.get('firstName')).toEqual('Paul');

    await waitForEvent('turbo:navigation');
    expect(router.state.location.pathname).toEqual('/about');
    expect(document.documentElement.dataset.turboNavigationState).toEqual('idle');
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

function onClickSubmitter(event: Event) {
  const target = event.target as { form?: HTMLFormElement };
  if (target.form) {
    const event = new CustomEvent('submit', { bubbles: true });
    Object.assign(event, { submitter: target });
    fireEvent(target.form, event);
  }
}
