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

type ActionName = typeof ActionNames[number];

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

  render(params: ({ action: ActionName } & ActionParams)[]) {
    this.withoutObservers(() => {
      for (const { action: actionName, ...actionParams } of params) {
        this[actionName](actionParams);
      }
    });
  }

  after(params: ActionParams) {
    this.withoutObservers(() => this._after(params));
  }

  before(params: ActionParams) {
    this.withoutObservers(() => this._before(params));
  }

  append(params: ActionParams) {
    this.withoutObservers(() => this._append(params));
  }

  prepend(params: ActionParams) {
    this.withoutObservers(() => this._prepend(params));
  }

  remove(params: ActionParams) {
    this.withoutObservers(() => this._remove(params));
  }

  replace(params: ActionParams) {
    this.withoutObservers(() => this._replace(params));
  }

  update(params: ActionParams) {
    this.withoutObservers(() => this._update(params));
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
    this.withoutObservers(() => {
      morph(from, to, {
        forceAttribute: this.#schema.forceAttribute,
        metadata: this.#metadata,
        ...options,
      });
    });
  }

  private withoutObservers(callback: () => void) {
    this.#classListObserver.disconnect();
    this.#attributeObserver.disconnect();
    callback();
    this.#classListObserver.observe();
    this.#attributeObserver.observe();
  }

  private _after({ targets, fragment }: ActionParams) {
    invariant(fragment, '[actions] fragment is required');
    for (const element of targets) {
      element.after(fragment.cloneNode(true));
    }
  }

  private _before({ targets, fragment }: ActionParams) {
    invariant(fragment, '[actions] fragment is required');
    for (const element of targets) {
      element.before(fragment.cloneNode(true));
    }
  }

  private _append({ targets, fragment }: ActionParams) {
    invariant(fragment, '[actions] fragment is required');
    removeDuplicateTargetChildren(targets, fragment);
    for (const element of targets) {
      element.append(fragment.cloneNode(true));
    }
  }

  private _prepend({ targets, fragment }: ActionParams) {
    invariant(fragment, '[actions] fragment is required');
    removeDuplicateTargetChildren(targets, fragment);
    for (const element of targets) {
      element.prepend(fragment.cloneNode(true));
    }
  }

  private _remove({ targets }: ActionParams) {
    for (const element of targets) {
      element.remove();
    }
  }

  private _replace({ targets, fragment }: ActionParams) {
    invariant(fragment, '[actions] fragment is required');
    for (const element of targets) {
      morph(element, fragment.cloneNode(true) as DocumentFragment, {
        forceAttribute: this.#schema.forceAttribute,
        metadata: this.#metadata,
      });
    }
  }

  private _update({ targets, fragment }: ActionParams) {
    invariant(fragment, '[actions] fragment is required');
    for (const element of targets) {
      morph(element, fragment.cloneNode(true) as DocumentFragment, {
        forceAttribute: this.#schema.forceAttribute,
        metadata: this.#metadata,
        childrenOnly: true,
      });
    }
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

function isActionName(actionName: unknown): actionName is ActionName {
  return ActionNames.includes(actionName as any);
}

class DispatchEventElement extends HTMLElement {
  constructor() {
    super();
    this.style.display = 'none';
  }

  connectedCallback() {
    const type = this.getAttribute('type');
    const target =
      this.parentElement?.tagName == 'HEAD'
        ? this.ownerDocument.documentElement
        : this.previousElementSibling;

    invariant(type, '[dispatch-event] must have "type" attribute');
    invariant(target, '[dispatch-event] must have a target element');

    dispatch(type, { target });

    this.remove();
  }
}

if (!customElements.get('dispatch-event')) {
  customElements.define('dispatch-event', DispatchEventElement);
}

export function parseActionName(actionName: string): ActionName {
  invariant(isActionName(actionName), `[actions] action "${actionName}" is not supported`);
  return actionName;
}
