import type {
  Router,
  RouteObject,
  RouterState,
  Navigation,
  Fetcher,
  RevalidationState,
  RouteData,
  RouterInit,
} from '@remix-run/router';
import { createBrowserRouter, createMemoryRouter, matchRoutes } from '@remix-run/router';
import invariant from 'tiny-invariant';
import type { Application } from '@hotwired/stimulus';

import { getStimulusApplication } from './stimulus';
import { registerEventListeners } from './event-listeners';
import { renderPage } from './render';
import { setupDataFunctions, getRouteData } from './loader';
import { renderStream } from './turbo-stream';
import { dispatch } from './dom';
import { getFetcherForm, disableForm, enableForm } from './form';

import { FetcherController } from './controllers/fetcher';
import { RevalidateController } from './controllers/revalidate';
import { SubmitOnChangeController } from './controllers/submit-on-change';

type Context = {
  state?: RouterState;
  fetchers: Map<string, Fetcher>;
  snapshot?: string;
};

type TurboRouterInit = {
  routes: RouteObject[];
  application?: Application;
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
  fetchOptions,
  debug = false,
}: TurboRouterInit & {
  routerFactory: (init: Omit<RouterInit, 'history'>) => Router;
}): Router {
  const context: Context = { fetchers: new Map() };

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

  router.initialize();
  router.subscribe((state) => {
    onRouterStateChange(state, context, debug);
    context.state = state;
  });

  application = getStimulusApplication(router, application);
  application.start();

  const unsubscribe = registerEventListeners(router);

  const dispose = router.dispose;
  router.dispose = () => {
    dispose.call(router);
    unsubscribe();
    application?.stop();
  };

  application.register('fetcher', FetcherController);
  application.register('revalidate', RevalidateController);
  application.register('submit-on-change', SubmitOnChangeController);

  return router;
}

function onRouterStateChange(state: RouterState, context: Context, debug: boolean) {
  if (context.state?.navigation?.state != state.navigation.state) {
    navigationStateChange(state.navigation, debug);
  }

  if (context.state?.revalidation != state.revalidation) {
    revalidationStateChange(state.revalidation, debug);
  }

  for (const [fetcherKey, fetcher] of state.fetchers) {
    const form = getFetcherForm(fetcherKey);

    if (context.fetchers.get(fetcherKey)?.state != fetcher.state) {
      fetcherStateChange(fetcherKey, fetcher, form, debug);
      context.fetchers.set(fetcherKey, fetcher);
    }

    if (fetcher.state == 'submitting') {
      disableForm(form);
    } else {
      enableForm(form);
    }

    if (fetcher.state == 'idle') {
      switch (fetcher.data?.format) {
        case 'turbo-stream':
          renderStream(fetcher.data.content);
          break;
        case 'json':
          dispatch('turbo:fetcher:json', {
            target: form,
            detail: { key: fetcherKey, data: fetcher.data.content },
          });
          break;
        case 'html':
          invariant(false, 'Fetcher can not return html');
      }
    }
  }

  if (state.initialized && state.navigation.state == 'idle') {
    const { loaderData, actionData } = getRouteData(state);
    const routeData = actionData ?? loaderData;
    switch (routeData?.format) {
      case 'html':
        if (routeData.content != context.snapshot) {
          renderPage(routeData.content, state.navigation);
          context.snapshot = routeData.content;
        }
        break;
      case 'turbo-stream':
        invariant(false, 'Navigation can not return turbo-stream');
      case 'json':
        invariant(false, 'Navigation can not return json');
    }
  }
}

function navigationStateChange(navigation: Navigation, debug: boolean) {
  if (navigation.state != 'idle' && debug) {
    console.log('[navigation state change]', navigation.state);
  }
  document.documentElement.setAttribute('data-turbo-navigation-state', navigation.state);
  dispatch('turbo:navigation', { detail: { navigation } });
}

function revalidationStateChange(state: RevalidationState, debug: boolean) {
  if (state != 'idle' && debug) {
    console.log('[revalidation state change]', state);
  }
  document.documentElement.setAttribute('data-turbo-revalidation-state', state);
  dispatch('turbo:revalidation', { detail: { revalidation: state } });
}

function fetcherStateChange(
  fetcherKey: string,
  fetcher: Fetcher,
  form: HTMLFormElement,
  debug: boolean
) {
  if (fetcher.state != 'idle' && debug) {
    console.log('[fetcher state change]', fetcherKey, fetcher.state);
  }
  form.setAttribute('data-turbo-fetcher-state', fetcher.state);
  dispatch('turbo:fetcher', {
    target: form,
    detail: { key: fetcherKey, fetcher },
  });
}
