import type {
  RouterState,
  Fetcher,
  RevalidationState,
  Navigation,
  NavigationStates,
} from '@remix-run/router';

import { dispatch } from '@coldwired/utils';

import type { Schema } from './schema';
import { type RouteData, getRouteData, getFetcherData } from './data';
import { getFetcherElement } from './directives/fetcher';
import { disableFormInputs, enableFormInputs } from './disable';

export type NavigationContextDelegate = {
  navigationDone(
    navigation: NavigationStates['Idle'],
    revalidation: boolean,
    data?: RouteData
  ): void;
  fetcherDone(fetcherKey: string, fetcher: Fetcher, form: Element, data?: RouteData): void;
};

export class NavigationContext {
  #element: Element;
  #schema: Schema;
  #debug: boolean;
  #delegate: NavigationContextDelegate;

  #fetchers = new Map<string, Fetcher>();
  #state?: RouterState;
  #snapshot?: string;

  constructor(
    element: Element,
    schema: Schema,
    delegate: NavigationContextDelegate,
    debug = false
  ) {
    this.#element = element;
    this.#schema = schema;
    this.#delegate = delegate;
    this.#debug = debug;
  }

  to(state: RouterState) {
    const previousState = this.#state?.navigation.state;

    if (previousState != state.navigation.state) {
      if (state.navigation.state == 'submitting') {
        for (const form of this.forms) {
          disableFormInputs(form, {
            disableAttribute: this.#schema.disableAttribute,
            disableWithAttribute: this.#schema.disableWithAttribute,
          });
        }
      } else if (previousState == 'submitting') {
        for (const form of this.forms) {
          enableFormInputs(form, {
            disableAttribute: this.#schema.disableAttribute,
            disableWithAttribute: this.#schema.disableWithAttribute,
          });
        }
      }
    }

    for (const [fetcherKey, fetcher] of state.fetchers) {
      const previousState = this.#fetchers.get(fetcherKey)?.state;
      const element = getFetcherElement(fetcherKey);

      if (previousState != fetcher.state) {
        this.fetcherStateChange(fetcherKey, fetcher, element);

        if (fetcher.state == 'submitting') {
          disableFormInputs(element, {
            disableAttribute: this.#schema.disableAttribute,
            disableWithAttribute: this.#schema.disableWithAttribute,
          });
        } else if (previousState == 'submitting') {
          enableFormInputs(element, {
            disableAttribute: this.#schema.disableAttribute,
            disableWithAttribute: this.#schema.disableWithAttribute,
          });
        }

        this.#fetchers.set(fetcherKey, fetcher);
      }

      if (fetcher.state == 'idle') {
        const data = getFetcherData(fetcher);
        if (data?.format == 'html') {
          if (data.content != this.#snapshot) {
            this.#delegate.fetcherDone(fetcherKey, fetcher, element, data);
            this.#snapshot = data.content;
          }
        } else {
          this.#delegate.fetcherDone(fetcherKey, fetcher, element, data);
        }
      }
    }

    if (state.initialized && state.navigation.state == 'idle') {
      const revalidation = this.#state?.matches.at(-1)?.pathname == state.matches.at(-1)?.pathname;
      const { loaderData, actionData } = getRouteData(state);
      const data = actionData ?? loaderData;

      if (data?.format == 'html') {
        if (data.content != this.#snapshot) {
          this.#delegate.navigationDone(state.navigation, revalidation, data);
          this.#snapshot = data.content;
        }
      } else {
        this.#delegate.navigationDone(state.navigation, revalidation, data);
      }
    }

    if (previousState != state.navigation.state) {
      this.navigationStateChange(state.navigation);
    }
    if (this.#state?.revalidation != state.revalidation) {
      this.revalidationStateChange(state.revalidation);
    }

    this.#state = state;
  }

  private get forms() {
    return this.#element.querySelectorAll(`form:not([${this.#schema.fetcherAttribute}])`);
  }

  private navigationStateChange(navigation: Navigation) {
    if (navigation.state != 'idle' && this.#debug) {
      console.debug('[navigation state change]', navigation.state);
    }
    this.#element.setAttribute(this.#schema.navigationStateAttribute, navigation.state);
    dispatch(this.#schema.navigationStateChangeEvent, {
      target: this.#element,
      detail: { navigation },
    });
  }

  private revalidationStateChange(revalidation: RevalidationState) {
    if (revalidation != 'idle' && this.#debug) {
      console.debug('[revalidation state change]', revalidation);
    }
    this.#element.setAttribute(this.#schema.revalidationStateAttribute, revalidation);
    dispatch(this.#schema.revalidationStateChangeEvent, {
      target: this.#element,
      detail: { revalidation },
    });
  }

  private fetcherStateChange(fetcherKey: string, fetcher: Fetcher, element: Element) {
    if (fetcher.state != 'idle' && this.#debug) {
      console.debug('[fetcher state change]', fetcherKey, fetcher.state);
    }
    element.setAttribute(this.#schema.fetcherStateAttribute, fetcher.state);
    dispatch(this.#schema.fetcherStateChangeEvent, {
      target: element,
      detail: { fetcher },
    });
  }
}
