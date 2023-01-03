import invariant from 'tiny-invariant';

import { dispatch, isFormInputElement, focusElement } from '@coldwired/utils';

import { ClassListObserver, ClassListObserverDelegate } from './class-list-observer';
import { AttributeObserver, AttributeObserverDelegate } from './attribute-observer';
import { Metadata } from './metadata';
import { morph } from './morph';
import { Schema, defaultSchema } from './schema';

type ActionParams = {
  targets: Element[];
  fragment?: DocumentFragment;
};

type Action = (params: ActionParams) => void;

const ActionNames = [
  'after',
  'before',
  'append',
  'prepend',
  'remove',
  'replace',
  'update',
  'focus',
  'enable',
  'disable',
  'hide',
  'show',
] as const;

export class Actions {
  #element: Element;
  #schema: Schema;
  #metadata = new Metadata();
  #classListObserver: ClassListObserver;
  #attributeObserver: AttributeObserver;
  #delegate: EventListenerObject & ClassListObserverDelegate & AttributeObserverDelegate;

  constructor({ element, schema }: { element: Element; schema?: Schema }) {
    this.#element = element;
    this.#schema = { ...defaultSchema, ...schema };
    this.#delegate = {
      handleEvent: this.handleEvent.bind(this),
      classListChanged: this.classListChanged.bind(this),
      attributeChanged: this.attributeChanged.bind(this),
    };
    this.#classListObserver = new ClassListObserver(this.#element, this.#delegate);
    this.#attributeObserver = new AttributeObserver(this.#element, this.#delegate);
  }

  get element() {
    return this.#element;
  }

  start() {
    this.#classListObserver.observe();
    this.#attributeObserver.observe();
    this.#element.addEventListener('input', this.#delegate);
  }

  stop() {
    this.#classListObserver.disconnect();
    this.#attributeObserver.disconnect();
    this.#element.removeEventListener('input', this.#delegate);
  }

  getAction(actionName: string): Action {
    invariant(isActionName(actionName), `[actions] action "${actionName}" is not supported`);
    return (params) => this[actionName](params);
  }

  after({ targets, fragment }: ActionParams) {
    invariant(fragment, '[actions] fragment is required');
    this.#classListObserver.disconnect();
    this.#attributeObserver.disconnect();
    for (const element of targets) {
      element.after(fragment.cloneNode(true));
    }
    this.#classListObserver.observe();
    this.#attributeObserver.observe();
  }

  before({ targets, fragment }: ActionParams) {
    invariant(fragment, '[actions] fragment is required');
    this.#classListObserver.disconnect();
    this.#attributeObserver.disconnect();
    for (const element of targets) {
      element.before(fragment.cloneNode(true));
    }
    this.#classListObserver.observe();
    this.#attributeObserver.observe();
  }

  append({ targets, fragment }: ActionParams) {
    invariant(fragment, '[actions] fragment is required');
    this.#classListObserver.disconnect();
    this.#attributeObserver.disconnect();
    removeDuplicateTargetChildren(targets, fragment);
    for (const element of targets) {
      element.append(fragment.cloneNode(true));
    }
    this.#classListObserver.observe();
    this.#attributeObserver.observe();
  }

  prepend({ targets, fragment }: ActionParams) {
    invariant(fragment, '[actions] fragment is required');
    this.#classListObserver.disconnect();
    this.#attributeObserver.disconnect();
    removeDuplicateTargetChildren(targets, fragment);
    for (const element of targets) {
      element.prepend(fragment.cloneNode(true));
    }
    this.#classListObserver.observe();
    this.#attributeObserver.observe();
  }

  remove({ targets }: ActionParams) {
    this.#classListObserver.disconnect();
    this.#attributeObserver.disconnect();
    for (const element of targets) {
      element.remove();
    }
    this.#classListObserver.observe();
    this.#attributeObserver.observe();
  }

  replace({ targets, fragment }: ActionParams) {
    invariant(fragment, '[actions] fragment is required');
    this.#classListObserver.disconnect();
    this.#attributeObserver.disconnect();
    for (const element of targets) {
      morph(element, fragment.cloneNode(true) as DocumentFragment, {
        forceAttribute: this.#schema.forceAttribute,
        metadata: this.#metadata,
      });
    }
    this.#classListObserver.observe();
    this.#attributeObserver.observe();
  }

  update({ targets, fragment }: ActionParams) {
    invariant(fragment, '[actions] fragment is required');
    this.#classListObserver.disconnect();
    this.#attributeObserver.disconnect();
    for (const element of targets) {
      morph(element, fragment.cloneNode(true) as DocumentFragment, {
        forceAttribute: this.#schema.forceAttribute,
        metadata: this.#metadata,
        childrenOnly: true,
      });
    }
    this.#classListObserver.observe();
    this.#attributeObserver.observe();
  }

  focus({ targets }: ActionParams) {
    for (const element of targets) {
      focusElement(element);
    }
  }

  disable({ targets }: ActionParams) {
    for (const element of targets) {
      if ('disabled' in element) {
        element.disabled = true;
      }
    }
  }

  enable({ targets }: ActionParams) {
    for (const element of targets) {
      if ('disabled' in element) {
        element.disabled = false;
      }
    }
  }

  hide({ targets }: ActionParams) {
    for (const element of targets) {
      element.classList.add(this.#schema.hiddenClassName);
    }
  }

  show({ targets }: ActionParams) {
    for (const element of targets) {
      element.classList.remove(this.#schema.hiddenClassName);
    }
  }

  morph(
    from: Element | Document,
    to: string | Element | Document | DocumentFragment,
    options?: { childrenOnly?: boolean }
  ) {
    this.#classListObserver.disconnect();
    this.#attributeObserver.disconnect();
    morph(from, to, {
      forceAttribute: this.#schema.forceAttribute,
      metadata: this.#metadata,
      ...options,
    });
    this.#classListObserver.observe();
    this.#attributeObserver.observe();
  }

  private handleEvent(event: Event) {
    const target = (event.composedPath && event.composedPath()[0]) || event.target;

    if (event.type == 'input' && isFormInputElement(target)) {
      this.#metadata.getOrCreate(target).touched = true;
    }
  }

  private classListChanged(element: Element, oldClassList: Set<string>) {
    const metadata = this.#metadata.getOrCreate(element);
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
  }

  private attributeChanged(element: Element, attributeName: string, value: string | null) {
    this.#metadata.getOrCreate(element).attributes[attributeName] = value;
  }
}

function removeDuplicateTargetChildren(targets: Element[], fragment: DocumentFragment) {
  for (const element of duplicateChildren(targets, fragment)) {
    element.remove();
  }
}

function duplicateChildren(targets: Element[], fragment: DocumentFragment) {
  const existingChildren = targets
    .flatMap((element) => [...element.children])
    .filter((element) => !!element.id);
  const newChildrenIds = new Set(
    [...fragment.children].filter((element) => !!element.id).map((element) => element.id)
  );

  return existingChildren.filter((element) => newChildrenIds.has(element.id));
}

function difference<T>(a: Set<T>, b: Set<T>) {
  return new Set([...a].filter((x) => !b.has(x)));
}

function isActionName(actionName: unknown): actionName is typeof ActionNames[number] {
  return ActionNames.includes(actionName as any);
}

class DispatchEventElement extends HTMLElement {
  connectedCallback() {
    const type = this.getAttribute('type');
    const target =
      this.parentElement?.tagName == 'BODY'
        ? this.ownerDocument.documentElement
        : this.parentElement;

    invariant(type, '[dispatch-event] must have "type" attribute');
    invariant(target, '[dispatch-event] must be connected to a document');

    dispatch(type, { target });

    this.remove();
  }
}

if (!customElements.get('dispatch-event')) {
  customElements.define('dispatch-event', DispatchEventElement);
}
