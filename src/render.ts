import type { NavigationStates, Navigation } from '@remix-run/router';
import morphdom from 'morphdom';

import {
  dispatch,
  isCheckboxOrRadioInputElement,
  isHtmlElement,
  isInputOrTextAreaElement,
} from './dom';

export function renderPage(html: string, navigation: NavigationStates['Idle']) {
  try {
    const doc = parseHTML(html);
    beforeRender(navigation, doc.body);
    renderHeadElement(document.head, doc.head);
    renderElement(document.body, doc.body);
    afterRender(navigation);
  } catch (error) {
    renderError(navigation, error as Error);
  }
}

export function renderElement(from: HTMLElement, to: HTMLElement, childrenOnly = false) {
  morphdom(from, to, {
    childrenOnly,
    onBeforeElUpdated(fromEl, toEl) {
      if (document.activeElement == fromEl) {
        if (isCheckboxOrRadioInputElement(fromEl) && isCheckboxOrRadioInputElement(toEl)) {
          toEl.checked = fromEl.checked;
        } else if (isInputOrTextAreaElement(fromEl) && isInputOrTextAreaElement(toEl)) {
          toEl.value = fromEl.value;
        }
      }
      const classNames = classList(fromEl).value;
      if (classNames) {
        toEl.classList.value = classNames;
      }
      return true;
    },
  });
}

class TokenList {
  #element: Element;
  #current: Set<string> = new Set();
  #removed: Set<string> = new Set();

  constructor(element: Element) {
    this.#element = element;
    this.#current = new Set(element.classList);
  }

  toggle(...classNames: string[]) {
    for (const className of classNames) {
      if (this.#current.has(className)) {
        this.remove(className);
      } else {
        this.add(className);
      }
    }
  }

  add(...classNames: string[]) {
    for (const className of classNames) {
      this.#current.add(className);
    }
    this.#element.classList.add(...classNames);
  }

  remove(...classNames: string[]) {
    for (const className of classNames) {
      this.#current.delete(className);
      this.#removed.add(className);
    }
    this.#element.classList.remove(...classNames);
    if (this.#element.classList.length == 0) {
      this.#element.removeAttribute('class');
    }
  }

  get value() {
    return [...this.#current].join(' ');
  }
}

const elementTokenList = new WeakMap<HTMLElement, TokenList>();

export function classList(element: HTMLElement) {
  const tokenList = elementTokenList.get(element) ?? new TokenList(element);
  elementTokenList.set(element, tokenList);
  return tokenList;
}

export function renderHeadElement(from: HTMLElement, to: HTMLElement) {
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

function beforeRender(navigation: Navigation, element: HTMLElement) {
  dispatch('turbo:before-render', { detail: { navigation, element } });
}

function afterRender(navigation: Navigation) {
  dispatch('turbo:render', { detail: { navigation } });
}

function renderError(navigation: Navigation, error: Error) {
  console.error('[render error]', navigation.location, error.message);
  dispatch('turbo:render-error', { detail: { navigation, error } });
}
