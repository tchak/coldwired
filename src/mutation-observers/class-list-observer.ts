import { isElement } from '../dom';

export type ClassListObserverDelegate = {
  classListChanged(element: Element, oldClassList: Set<string>): void;
};

export class ClassListObserver {
  #element: Element;
  #observer: MutationObserver;
  #delegate: ClassListObserverDelegate;

  constructor(element: Element, delegate: ClassListObserverDelegate) {
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
      attributeFilter: ['class'],
      attributeOldValue: true,
      subtree: true,
    });
  }

  disconnect() {
    this.#observer.disconnect();
  }

  private onAttributeMutation(mutation: MutationRecord) {
    if (isElement(mutation.target)) {
      if (mutation.oldValue) {
        const classList = new Set(mutation.oldValue.split(/\s/).filter(Boolean));
        this.#delegate.classListChanged(mutation.target, classList);
      } else {
        this.#delegate.classListChanged(mutation.target, new Set([]));
      }
    }
  }
}
