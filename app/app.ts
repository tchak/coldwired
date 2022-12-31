import { createBrowserTurboRouter, Application } from '../src';

const routes = [
  { path: '/', id: 'root', handle: { method: ['get'] } },
  { path: '/about', id: 'about', handle: { method: ['get'] } },
];

const router = createBrowserTurboRouter({ routes });

async function main() {
  await Application.start({ router, debug: true });
}

main();
