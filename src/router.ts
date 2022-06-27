import type { Router, RouteObject, RouteData, RouterInit } from '@remix-run/router';
import { createBrowserRouter, createMemoryRouter, matchRoutes } from '@remix-run/router';

import { setupDataFunctions } from './loader';

type RouterOptions = {
  routes: RouteObject[];
  fetchOptions?: RequestInit;
};

export type { RouteObject };

export function createBrowserTurboRouter(init: RouterOptions): Router {
  return createTurboRouter({ ...init, routerFactory: createBrowserRouter });
}

export function createMemoryTurboRouter(init: RouterOptions): Router {
  return createTurboRouter({ ...init, routerFactory: createMemoryRouter });
}

function createTurboRouter({
  routerFactory,
  routes,
  fetchOptions,
}: RouterOptions & {
  routerFactory: (init: Omit<RouterInit, 'history'>) => Router;
}): Router {
  setupDataFunctions(routes, fetchOptions);

  const matches = matchRoutes(routes, location);
  const routeId = matches && matches[0].route.id;
  const loaderData: RouteData = routeId
    ? {
        [routeId]: {
          format: 'html',
          content: document.documentElement.outerHTML,
        },
      }
    : {};
  const router = routerFactory({ routes, hydrationData: { loaderData } });

  return router;
}
