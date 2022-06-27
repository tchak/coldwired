import { createBrowserTurboRouter, Application } from '../src';

const routes = [
  { path: '/', id: 'root', handle: { _loader: true } },
  { path: '/about', id: 'about', handle: { _loader: true } },
];

const router = createBrowserTurboRouter({ routes });
Application.start({ router, debug: true });
