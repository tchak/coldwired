import type {
  LoaderFunction as DataFunction,
  AgnosticRouteObject,
  ShouldRevalidateFunction,
  RouterState,
  Fetcher,
} from '@remix-run/router';
import { json, redirect } from '@remix-run/router';
import { nanoid } from 'nanoid';

import { expandURL } from '@coldwired/utils';

export enum ContentType {
  TurboStream = 'text/vnd.turbo-stream.html',
  HTML = 'text/html, application/xhtml+xml',
  JSON = 'application/json',
}

export type RouteData =
  | { format: 'html'; content: string }
  | { format: 'turbo-stream'; content: string }
  | { format: 'json'; content: unknown };

type RouteHandle = {
  method?: string | string[];
};

export type SetupRequest = (request: Request) => Request;

export function getRouteData(state: RouterState): {
  loaderData?: RouteData;
  actionData?: RouteData;
  errors?: RouteData;
} {
  const leafRoute = state.matches.at(-1)?.route;

  if (leafRoute) {
    const actionData = state.actionData && state.actionData[leafRoute.id];
    const loaderData = state.loaderData[leafRoute.id];
    const errors = state.errors && state.errors[leafRoute.id];

    return { loaderData, actionData, errors };
  }
  return {};
}

export function getFetcherData(fetcher: Fetcher): RouteData | undefined {
  if (fetcher.data?.format) {
    return fetcher.data;
  }
  return;
}

function toLowerCase(str: string) {
  return str.toLowerCase();
}

function isLoader(handle?: RouteHandle) {
  if (handle?.method) {
    if (Array.isArray(handle.method)) {
      return handle.method.map(toLowerCase).includes('get');
    }
    return handle.method.toLowerCase() == 'get';
  }
  return false;
}

function isAction(handle: RouteHandle) {
  if (handle?.method) {
    if (Array.isArray(handle.method)) {
      const method = new Set(handle.method.map(toLowerCase));
      method.delete('get');
      return method.size > 0;
    }
    return handle.method.toLowerCase() != 'get';
  }
  return false;
}

export function setupDataFunctions(options?: {
  routes?: AgnosticRouteObject[];
  setup?: SetupRequest;
}): AgnosticRouteObject[] {
  const dataFunction = makeDataFunction(options?.setup);
  const routes = options?.routes ?? [];

  for (const route of routes) {
    if (isLoader(route.handle)) {
      route.loader = dataFunction;
    }
    if (isAction(route.handle)) {
      route.action = dataFunction;
    }
    route.shouldRevalidate = shouldRevalidate;
    route.id ??= nanoid();
  }
  routes.push({
    id: 'not_found',
    path: '*',
    loader: dataFunction,
    action: dataFunction,
  });
  return routes;
}

const shouldRevalidate: ShouldRevalidateFunction = (args) => {
  // FIXME: actionResult type is wrong
  const format = (args.actionResult as any as RouteData)?.format;
  if (format == 'turbo-stream' || format == 'json') {
    return false;
  }
  return args.defaultShouldRevalidate;
};

const dataFunctionHandler = (response: Response) => onFetchResponse(response);
const makeDataFunction: (setup?: SetupRequest) => DataFunction =
  (setup) =>
  ({ request }) => {
    request.headers.set('x-requested-with', 'coldwire');
    request.headers.set('accept', [ContentType.TurboStream, ContentType.HTML].join(', '));
    return fetch(setup?.(request) ?? request).then(dataFunctionHandler);
  };

function onFetchResponse(response: Response) {
  if (response.ok) {
    const url = response.headers.get('x-coldwire-redirect');
    if (url) {
      const pathname = expandURL(url).pathname;
      return redirect(pathname);
    } else if (isJSON(response)) {
      return response.json().then((content) => json<RouteData>({ format: 'json', content }));
    }
  }
  return response.text().then((content) => processResponse(response, content));
}

function isTurboStream(response: Response) {
  const contentType = response.headers.get('content-type');
  return !!contentType?.startsWith(ContentType.TurboStream);
}

function isJSON(response: Response) {
  const contentType = response.headers.get('content-type');
  return !!contentType?.startsWith(ContentType.JSON);
}

function processResponse(response: Response, content: string) {
  if (isTurboStream(response)) {
    return json<RouteData>({ format: 'turbo-stream', content });
  } else if (response.status == 204) {
    return json(null);
  }
  return json<RouteData>({ format: 'html', content });
}
