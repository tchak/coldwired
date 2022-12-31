import { isFormInputElement } from '../utils';

import { getMetadata } from './metadata';
import { ClassListObserver, ClassListObserverDelegate } from './class-list-observer';

export class MorphContext {
  #element: Element;
  #classListObserver: ClassListObserver;
  #eventListener: EventListenerObject;

  constructor(element: Element) {
    this.#element = element ?? document.documentElement;
    this.#classListObserver = new ClassListObserver(this.#element, { classListChanged });
    this.#eventListener = { handleEvent };
  }

  static start(element: Element): MorphContext {
    const context = new MorphContext(element);
    return context.start();
  }

  start(): this {
    this.#classListObserver.observe();
    this.#element.addEventListener('input', this.#eventListener);
    return this;
  }

  stop(): this {
    this.#classListObserver.disconnect();
    this.#element.removeEventListener('input', this.#eventListener);
    return this;
  }

  withoutObserver(callback: () => void) {
    this.#classListObserver.disconnect();
    callback();
    this.#classListObserver.observe();
  }
}

const classListChanged: ClassListObserverDelegate['classListChanged'] = (element, oldClassList) => {
  const metadata = getMetadata(element, true);
  const classList = new Set(element.classList);

  const added = difference(classList, oldClassList);
  const removed = difference(oldClassList, classList);

  for (const className of added) {
    metadata.addedClassNames.add(className);
    metadata.removedClassNames.delete(className);
  }
  for (const className of removed) {
    metadata.removedClassNames.add(className);
    metadata.addedClassNames.delete(className);
  }
};

const handleEvent: EventListener = (event) => {
  const target = (event.composedPath && event.composedPath()[0]) || event.target;

  if (event.type == 'input' && isFormInputElement(target)) {
    getMetadata(target, true).touched = true;
  }
};

function difference<T>(a: Set<T>, b: Set<T>) {
  return new Set([...a].filter((x) => !b.has(x)));
}
