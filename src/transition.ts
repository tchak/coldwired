import type {
  RouterState,
  Fetcher,
  RevalidationState,
  Navigation,
  NavigationStates,
} from '@remix-run/router';

import type { Schema } from './schema';
import type { RouteData } from './loader';
import { getRouteData } from './loader';
import { dispatch } from './utils';
import { getMetadata } from './metadata';
import { isButtonElement, isFocused } from './dom';
import { getFetcherElement } from './directives/fetcher';

export type TransitionDelegate = {
  navigationDone(navigation: NavigationStates['Idle'], data?: RouteData): void;
  fetcherDone(fetcherKey: string, fetcher: Fetcher, form: Element): void;
};

export class Transition {
  #element: Element;
  #schema: Schema;
  #debug: boolean;
  #delegate: TransitionDelegate;

  #fetchers = new Map<string, Fetcher>();
  #state?: RouterState;
  #snapshot?: string;

  constructor(element: Element, schema: Schema, delegate: TransitionDelegate, debug = false) {
    this.#element = element;
    this.#schema = schema;
    this.#delegate = delegate;
    this.#debug = debug;
  }

  to(state: RouterState) {
    const previousState = this.#state?.navigation.state;

    if (previousState != state.navigation.state) {
      this.navigationStateChange(state.navigation);

      if (state.navigation.state == 'submitting') {
        for (const form of this.forms) {
          this.disableFormInputs(form);
        }
      } else if (previousState == 'submitting') {
        for (const form of this.forms) {
          this.disableFormInputs(form);
        }
      }
    }

    if (this.#state?.revalidation != state.revalidation) {
      this.revalidationStateChange(state.revalidation);
    }

    for (const [fetcherKey, fetcher] of state.fetchers) {
      const previousState = this.#fetchers.get(fetcherKey)?.state;
      const element = getFetcherElement(fetcherKey);

      if (previousState != fetcher.state) {
        this.fetcherStateChange(fetcherKey, fetcher, element);

        if (fetcher.state == 'submitting') {
          this.disableFormInputs(element);
        } else if (previousState == 'submitting') {
          this.enableFormInputs(element);
        }

        this.#fetchers.set(fetcherKey, fetcher);
      }

      if (fetcher.state == 'idle') {
        this.#delegate.fetcherDone(fetcherKey, fetcher, element);
      }
    }

    if (state.initialized && state.navigation.state == 'idle') {
      const { loaderData, actionData } = getRouteData(state);
      const data = actionData ?? loaderData;

      if (data?.format == 'html') {
        if (data.content != this.#snapshot) {
          this.#delegate.navigationDone(state.navigation, data);
          this.#snapshot = data.content;
        }
      } else {
        this.#delegate.navigationDone(state.navigation, data);
      }
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

  private disableFormInputs(container: Element) {
    for (const element of container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      this.formInputSelectors('enabled')
    )) {
      const disableWith = element.getAttribute(this.#schema.disableWithAttribute);
      const metadata = getMetadata(element, true);

      if (disableWith) {
        if (isButtonElement(element)) {
          metadata.originalContent = element.innerHTML;
          element.innerHTML = disableWith;
        } else {
          metadata.originalContent = element.value;
          element.value = disableWith;
        }
      }

      metadata.originalFocused = isFocused(element);
      element.disabled = true;
    }
  }

  private enableFormInputs(container: Element) {
    for (const element of container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      this.formInputSelectors('disabled')
    )) {
      const metadata = getMetadata(element);
      if (metadata?.originalContent) {
        if (isButtonElement(element)) {
          element.innerHTML = metadata.originalContent;
        } else {
          element.value = metadata.originalContent;
        }
        delete metadata.originalContent;
      }
      element.disabled = false;
      if (isFocused(document.body) && metadata?.originalFocused) {
        element.focus();
        delete metadata.originalFocused;
      }
    }
  }

  private formInputSelectors(pseudoClass: 'enabled' | 'disabled') {
    const selectors: string[] = [];

    for (const tag of ['input', 'button', 'textarea']) {
      for (const attribute of [this.#schema.disableAttribute, this.#schema.disableWithAttribute]) {
        selectors.push(`${tag}[${attribute}]:${pseudoClass}`);
      }
    }

    return selectors.join(', ');
  }
}
