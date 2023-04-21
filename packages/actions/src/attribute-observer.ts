import { isElement } from '@coldwired/utils';

const attributes = [
  'role',
  'disabled',
  'hidden',
  'tab-index',
  'aria-autocomplete',
  'aria-checked',
  'aria-disabled',
  'aria-errormessage',
  'aria-expanded',
  'aria-haspopup',
  'aria-hidden',
  'aria-invalid',
  'aria-label',
  'aria-level',
  'aria-modal',
  'aria-multiline',
  'aria-multiselectable',
  'aria-orientation',
  'aria-placeholder',
  'aria-pressed',
  'aria-readonly',
  'aria-required',
  'aria-selected',
  'aria-sort',
  'aria-valuemax',
  'aria-valuemin',
  'aria-valuenow',
  'aria-valuetext',
  'aria-busy',
  'aria-live',
  'aria-relevant',
  'aria-atomic',
  'aria-dropeffect',
  'aria-grabbed',
  'aria-activedescendant',
  'aria-colcount',
  'aria-colindex',
  'aria-colspan',
  'aria-controls',
  'aria-describedby',
  'aria-description',
  'aria-details',
  'aria-errormessage',
  'aria-flowto',
  'aria-labelledby',
  'aria-owns',
  'aria-posinset',
  'aria-rowcount',
  'aria-rowindex',
  'aria-rowspan',
  'aria-setsize',
  'aria-atomic',
  'aria-busy',
  'aria-controls',
  'aria-current',
  'aria-describedby',
  'aria-description',
  'aria-details',
  'aria-disabled',
  'aria-dropeffect',
  'aria-errormessage',
  'aria-flowto',
  'aria-grabbed',
  'aria-haspopup',
  'aria-hidden',
  'aria-invalid',
  'aria-keyshortcuts',
  'aria-label',
  'aria-labelledby',
  'aria-live',
  'aria-owns',
  'aria-relevant',
  'aria-roledescription',
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
      const value = mutation.target.getAttribute(mutation.attributeName);
      this.#delegate.attributeChanged(mutation.target, mutation.attributeName, value);
    }
  }
}
