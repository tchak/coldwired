import { Directive } from '../directive-controller';
import {
  ClassListObserver,
  ClassListObserverDelegate,
} from '../mutation-observers/class-list-observer';
import { getMetadata } from '../metadata';
import { difference } from '../utils';

export class Permanent extends Directive implements ClassListObserverDelegate {
  #observer?: ClassListObserver;

  connect() {
    this.observer.observe();
  }

  disconnect() {
    this.observer.disconnect();
  }

  private get observer() {
    if (!this.#observer) {
      this.#observer = new ClassListObserver(this.element, this);
    }
    return this.#observer;
  }

  classListChanged(element: Element, oldClassList: Set<string>) {
    const metadata = getMetadata(element, true);
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
