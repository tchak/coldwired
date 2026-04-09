import { isElement, isHTMLElement } from '../utils';

const attributes = [
  'role',
  'disabled',
  'hidden',
  'tab-index',
  'style',
  'aria-activedescendant',
  'aria-atomic',
  'aria-autocomplete',
  'aria-busy',
  'aria-checked',
  'aria-colcount',
  'aria-colindex',
  'aria-colspan',
  'aria-controls',
  'aria-current',
  'aria-describedby',
  'aria-description',
  'aria-details',
  'aria-disabled',
  'aria-dropeffect',
  'aria-errormessage',
  'aria-expanded',
  'aria-flowto',
  'aria-grabbed',
  'aria-haspopup',
  'aria-hidden',
  'aria-invalid',
  'aria-keyshortcuts',
  'aria-label',
  'aria-labelledby',
  'aria-level',
  'aria-live',
  'aria-modal',
  'aria-multiline',
  'aria-multiselectable',
  'aria-orientation',
  'aria-owns',
  'aria-placeholder',
  'aria-posinset',
  'aria-pressed',
  'aria-readonly',
  'aria-relevant',
  'aria-required',
  'aria-roledescription',
  'aria-rowcount',
  'aria-rowindex',
  'aria-rowspan',
  'aria-selected',
  'aria-setsize',
  'aria-sort',
  'aria-valuemax',
  'aria-valuemin',
  'aria-valuenow',
  'aria-valuetext',
];

export type AttributeObserverDelegate = {
  attributeChanged(element: Element, attribute: string, value: string | null): void;
};

export class AttributeObserver {
  #element: Element;
  #observer: MutationObserver;
  #delegate: AttributeObserverDelegate;

  constructor(element: Element, delegate: AttributeObserverDelegate) {
    this.#element = element;
    this.#observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        this.onAttributeMutation(mutation);
      }
    });
    this.#delegate = delegate;
  }

  observe() {
    this.#observer.observe(this.#element, {
      attributes: true,
      attributeFilter: attributes,
      subtree: true,
    });
  }

  disconnect() {
    this.#observer.disconnect();
  }

  private onAttributeMutation(mutation: MutationRecord) {
    if (isElement(mutation.target) && mutation.attributeName) {
      if (mutation.attributeName == 'style') {
        if (isHTMLElement(mutation.target)) {
          this.#delegate.attributeChanged(
            mutation.target,
            mutation.attributeName,
            mutation.target.style.cssText,
          );
        }
      } else {
        const value = mutation.target.getAttribute(mutation.attributeName);
        this.#delegate.attributeChanged(mutation.target, mutation.attributeName, value);
      }
    }
  }
}
