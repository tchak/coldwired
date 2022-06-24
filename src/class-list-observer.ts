import type { Schema } from './schema';
import { getOrCreateMetadata } from './metadata';
import { difference } from './utils';
import { isElement } from './dom';

export class ClassListObserver {
  #element: Element;
  #schema: Schema;
  #observer: MutationObserver;

  constructor(element: Element, schema: Schema) {
    this.#element = element;
    this.#schema = schema;
    this.#observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        this.onAttributeMutation(mutation);
      }
    });
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
    if (
      isElement(mutation.target) &&
      mutation.target.closest(`[${this.#schema.permanentAttribute}]`)
    ) {
      if (mutation.oldValue) {
        this.classListChanged(mutation.target, new Set(mutation.oldValue.split(' ')));
      } else {
        this.classListChanged(mutation.target, new Set([]));
      }
    }
  }

  private classListChanged(element: Element, oldClassList: Set<string>) {
    const metadata = getOrCreateMetadata(element);
    const classList = new Set(element.classList);

    const added = difference(classList, oldClassList);
    const removed = difference(oldClassList, classList);

    for (const className of added) {
      metadata.removedClassNames.delete(className);
    }
    for (const className of removed) {
      metadata.removedClassNames.add(className);
    }
  }
}
