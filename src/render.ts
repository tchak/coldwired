import type { NavigationStates, Fetcher } from '@remix-run/router';
import morphdom from 'morphdom';

import { dispatch, isHtmlElement } from './dom';
import { syncFormElement } from './form';

type Detail = {
  navigation?: NavigationStates['Idle'];
  fetcher?: Fetcher;
};

export function renderPage(html: string, detail: Detail) {
  try {
    const doc = parseHTML(html);
    beforeRender(doc.documentElement, detail);
    renderHeadElement(document.head, doc.head);
    renderElement(document.body, doc.body);
    afterRender(detail);
  } catch (error) {
    renderError(error as Error, detail);
  }
}

export function renderElement(from: HTMLElement, to: HTMLElement, childrenOnly = false) {
  morphdom(from, to, {
    childrenOnly,
    onBeforeElUpdated(fromEl, toEl) {
      syncFormElement(fromEl, toEl);
      syncClassList(fromEl, toEl);

      return true;
    },
  });
}

class TokenList {
  #classList: DOMTokenList;
  #removed: Set<string> = new Set();

  constructor(classList: DOMTokenList) {
    this.#classList = classList;
  }

  toggle(...classNames: string[]) {
    for (const className of classNames) {
      if (this.#classList.contains(className)) {
        this.remove(className);
      } else {
        this.add(className);
      }
    }
  }

  add(...classNames: string[]) {
    for (const className of classNames) {
      this.#removed.delete(className);
    }
    this.#classList.add(...classNames);
  }

  remove(...classNames: string[]) {
    for (const className of classNames) {
      this.#removed.add(className);
    }
    this.#classList.remove(...classNames);
  }

  get value() {
    return this.#classList.value;
  }

  sync(element: HTMLElement) {
    element.classList.add(...this.#classList);
    element.classList.remove(...this.#removed);
  }
}

const elementTokenList = new WeakMap<HTMLElement, TokenList>();

function syncClassList(fromEl: HTMLElement, toEl: HTMLElement) {
  const classList = elementTokenList.get(fromEl);
  if (classList) {
    classList.sync(toEl);
  }
}

export function classList(element: HTMLElement) {
  const tokenList = elementTokenList.get(element) ?? new TokenList(element.classList);
  elementTokenList.set(element, tokenList);
  return tokenList;
}

function renderHeadElement(from: HTMLElement, to?: HTMLElement) {
  if (!to) {
    return;
  }
  morphdom(from, to, {
    childrenOnly: true,
    onBeforeNodeDiscarded(node) {
      if (isHtmlElement(node) && node.tagName == 'LINK') {
        return false;
      }
      return true;
    },
  });
}

function parseHTML(html: string) {
  return new DOMParser().parseFromString(html, 'text/html');
}

function beforeRender(documentElement: HTMLElement, detail: Detail) {
  dispatch('turbo:before-render', { detail: { ...detail, documentElement } });
}

function afterRender(detail: Detail) {
  dispatch('turbo:render', { detail });
}

function renderError(error: Error, detail: Detail) {
  console.error('[render error]', error.message);
  dispatch('turbo:render-error', { detail: { ...detail, error } });
}
