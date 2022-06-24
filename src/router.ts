import type { Router, RouteObject, RouteData, RouterInit } from '@remix-run/router';
import { createBrowserRouter, createMemoryRouter, matchRoutes } from '@remix-run/router';
import { Application } from '@hotwired/stimulus';

import type { Schema } from './schema';
import { defaultSchema } from './schema';
import { setupDataFunctions } from './loader';
import { Delegate } from './delegate';

import { FetcherController } from './controllers/fetcher';
import { RevalidateController } from './controllers/revalidate';
import { SubmitOnChangeController } from './controllers/submit-on-change';

type TurboRouterInit = {
  routes: RouteObject[];
  application?: Application;
  schema?: Partial<Schema>;
  fetchOptions?: RequestInit;
  debug?: boolean;
};

export type { RouteObject };

export function createBrowserTurboRouter(init: TurboRouterInit): Router {
  return createTurboRouter({ ...init, routerFactory: createBrowserRouter });
}

export function createMemoryTurboRouter(init: TurboRouterInit): Router {
  return createTurboRouter({ ...init, routerFactory: createMemoryRouter });
}

function createTurboRouter({
  routerFactory,
  routes,
  application,
  schema,
  fetchOptions,
  debug = false,
}: TurboRouterInit & {
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
  application = application ? application : new Application();
  const element = application.element;
  const delegate = new Delegate({
    schema: Object.assign({}, defaultSchema, schema),
    router,
    element,
    debug,
  });

  element.addEventListener('click', delegate);
  element.addEventListener('submit', delegate);
  element.addEventListener('input', delegate);
  element.addEventListener('remix-router-turbo:connect-fetcher', delegate);
  element.addEventListener('remix-router-turbo:disconnect-fetcher', delegate);
  element.addEventListener('remix-router-turbo:revalidate', delegate);

  application.load([
    { identifier: 'fetcher', controllerConstructor: FetcherController },
    { identifier: 'revalidate', controllerConstructor: RevalidateController },
    { identifier: 'submit-on-change', controllerConstructor: SubmitOnChangeController },
  ]);

  router.subscribe((state) => delegate.onRouterStateChange(state));
  router.initialize();
  application.start();
  delegate.connect();

  const dispose = router.dispose;
  router.dispose = () => {
    dispose.call(router);
    delegate.disconnect();
    element.removeEventListener('click', delegate);
    element.removeEventListener('submit', delegate);
    element.removeEventListener('input', delegate);
    element.removeEventListener('remix-router-turbo:connect-fetcher', delegate);
    element.removeEventListener('remix-router-turbo:disconnect-fetcher', delegate);
    element.removeEventListener('remix-router-turbo:revalidate', delegate);
    application?.stop();
  };

  return router;
}
