import { createBrowserTurboRouter } from '..';

const routes = [
  { path: '/', id: 'root', handle: { _loader: true } },
  { path: '/about', id: 'about', handle: { _loader: true } },
];

createBrowserTurboRouter({ routes });
