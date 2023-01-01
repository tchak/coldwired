import { Application, type RouteObject } from '../src';

const routes: RouteObject[] = [
  { path: '/', id: 'root', handle: { method: ['get'] } },
  { path: '/about', id: 'about', handle: { method: ['get'] } },
];

async function main() {
  await Application.start({ routes, debug: true });
}

main();
