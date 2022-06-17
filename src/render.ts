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
      return true;
    },
  });
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
