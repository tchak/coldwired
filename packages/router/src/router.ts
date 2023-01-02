import type { Router, AgnosticRouteObject as RouteObject } from '@remix-run/router';
import {
  createRouter,
  createBrowserHistory,
  createMemoryHistory,
  matchRoutes,
  History,
} from '@remix-run/router';

import { setupDataFunctions } from './data';

interface RouteData {
  [routeId: string]: any;
}

export type RouterOptions = {
  routes: RouteObject[];
  element?: Element;
  fetchOptions?: RequestInit;
};

export type { RouteObject };

export function createBrowserRouter(init: RouterOptions): Router {
  return createRouterWithHistroy({ ...init, history: createBrowserHistory() });
}

export function createMemoryRouter(init: RouterOptions): Router {
  return createRouterWithHistroy({ ...init, history: createMemoryHistory() });
}

function createRouterWithHistroy({
  history,
  routes,
  element,
  fetchOptions,
}: RouterOptions & { history: History }): Router {
  setupDataFunctions(routes, fetchOptions);

  const matches = matchRoutes(routes, location);
  const routeId = matches && matches[0].route.id;
  const loaderData: RouteData = routeId
    ? {
        [routeId]: {
          format: 'html',
          content: element?.outerHTML ?? '',
        },
      }
    : {};
  const router = createRouter({ routes, hydrationData: { loaderData }, history });

  return router;
}
