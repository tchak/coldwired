import type { RouterState, Fetcher, RevalidationState, Navigation } from '@remix-run/router';
import invariant from 'tiny-invariant';

import type { Schema } from './schema';
import { dispatch } from './utils';
import { getElementByKey } from './metadata';

export class Transition {
  #element: Element;
  #schema: Schema;
  #debug: boolean;
  #fetchers = new Map<string, Fetcher>();
  #state?: RouterState;

  constructor(element: Element, schema: Schema, debug: boolean) {
    this.#element = element;
    this.#schema = schema;
    this.#debug = debug;
  }

  stateChange(state: RouterState) {
    if (this.#state?.navigation?.state != state.navigation.state) {
      this.navigationStateChange(state.navigation);
    }

    if (this.#state?.revalidation != state.revalidation) {
      this.revalidationStateChange(state.revalidation);
    }

    for (const [fetcherKey, fetcher] of state.fetchers) {
      const target = getElementByKey(fetcherKey);
      invariant(target, `No fetcher frame found for "${fetcherKey}"`);

      if (this.#fetchers.get(fetcherKey)?.state != fetcher.state) {
        this.fetcherStateChange(fetcherKey, fetcher, target);
        this.#fetchers.set(fetcherKey, fetcher);
      }
    }

    this.#state = state;
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

  private fetcherStateChange(fetcherKey: string, fetcher: Fetcher, target: Element) {
    if (fetcher.state != 'idle' && this.#debug) {
      console.debug('[fetcher state change]', fetcherKey, fetcher.state);
    }
    target.setAttribute(this.#schema.fetcherStateAttribute, fetcher.state);
    dispatch(this.#schema.fetcherStateChangeEvent, {
      target,
      detail: { fetcher },
    });
  }
}
