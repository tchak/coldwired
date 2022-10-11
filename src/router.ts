import type { Router, AgnosticRouteObject as RouteObject } from '@remix-run/router';
import {
  createRouter,
  createBrowserHistory,
  createMemoryHistory,
  matchRoutes,
  History,
} from '@remix-run/router';

import { setupDataFunctions } from './loader';

interface RouteData {
  [routeId: string]: any;
}

type RouterOptions = {
  routes: RouteObject[];
  fetchOptions?: RequestInit;
};

export type { RouteObject };

export function createBrowserTurboRouter(init: RouterOptions): Router {
  return createTurboRouter({ ...init, history: createBrowserHistory() });
}

export function createMemoryTurboRouter(init: RouterOptions): Router {
  return createTurboRouter({ ...init, history: createMemoryHistory() });
}

function createTurboRouter({
  history,
  routes,
  fetchOptions,
}: RouterOptions & {
  history: History;
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
  const router = createRouter({ routes, hydrationData: { loaderData }, history });

  return router;
}
