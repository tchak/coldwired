import invariant from 'tiny-invariant';

import { dispatch, isFormInputElement, focusElement } from '../utils';

import { ClassListObserver, ClassListObserverDelegate } from './class-list-observer';
import { Metadata } from './metadata';
import { morph } from './morph';

type ActionParams = {
  stream: Element;
  targets: Element[];
  fragment: DocumentFragment;
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
  'dispatch',
  'focus',
  'enable',
  'disable',
] as const;

type Schema = { forceAttribute?: string };

export class Actions {
  #element: Element;
  #schema: Schema;
  #metadata = new Metadata();
  #classListObserver: ClassListObserver;
  #delegate: EventListenerObject & ClassListObserverDelegate;

  constructor({ element, schema }: { element: Element; schema?: Schema }) {
    this.#element = element;
    this.#schema = schema ?? {};
    this.#delegate = {
      handleEvent: this.handleEvent.bind(this),
      classListChanged: this.classListChanged.bind(this),
    };
    this.#classListObserver = new ClassListObserver(this.#element, this.#delegate);
  }

  get element() {
    return this.#element;
  }

  start() {
    this.#classListObserver.observe();
    this.#element.addEventListener('input', this.#delegate);
  }

  stop() {
    this.#classListObserver.disconnect();
    this.#element.removeEventListener('input', this.#delegate);
  }

  getAction(actionName: string): Action {
    invariant(isActionName(actionName), `Action "${actionName}" is not supported`);
    return (params) => this[actionName](params);
  }

  after({ targets, fragment }: ActionParams) {
    this.#classListObserver.disconnect();
    for (const element of targets) {
      element.after(fragment.cloneNode(true));
    }
    this.#classListObserver.observe();
  }

  before({ targets, fragment }: ActionParams) {
    this.#classListObserver.disconnect();
    for (const element of targets) {
      element.before(fragment.cloneNode(true));
    }
    this.#classListObserver.observe();
  }

  append({ targets, fragment }: ActionParams) {
    this.#classListObserver.disconnect();
    removeDuplicateTargetChildren(targets, fragment);
    for (const element of targets) {
      element.append(fragment.cloneNode(true));
    }
    this.#classListObserver.observe();
  }

  prepend({ targets, fragment }: ActionParams) {
    this.#classListObserver.disconnect();
    removeDuplicateTargetChildren(targets, fragment);
    for (const element of targets) {
      element.prepend(fragment.cloneNode(true));
    }
    this.#classListObserver.observe();
  }

  remove({ targets }: ActionParams) {
    this.#classListObserver.disconnect();
    for (const element of targets) {
      element.remove();
    }
    this.#classListObserver.observe();
  }

  replace({ targets, fragment }: ActionParams) {
    this.#classListObserver.disconnect();
    for (const element of targets) {
      morph(element, fragment.cloneNode(true) as DocumentFragment, {
        forceAttribute: this.#schema.forceAttribute,
        metadata: this.#metadata,
      });
    }
    this.#classListObserver.observe();
  }

  update({ targets, fragment }: ActionParams) {
    this.#classListObserver.disconnect();
    for (const element of targets) {
      morph(element, fragment.cloneNode(true) as DocumentFragment, {
        forceAttribute: this.#schema.forceAttribute,
        metadata: this.#metadata,
        childrenOnly: true,
      });
    }
    this.#classListObserver.observe();
  }

  dispatch({ targets, stream }: ActionParams) {
    const type = stream.getAttribute('event-type');
    invariant(type, '[turbo-stream] event-type must be present');

    const detailJSON = stream.getAttribute('event-detail');
    const detail = detailJSON ? JSON.parse(detailJSON) : {};

    if (targets.length > 0) {
      for (const target of targets) {
        dispatch(type, { target, detail });
      }
    } else {
      dispatch(type, { detail });
    }
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

  morph(
    from: Element | Document,
    to: string | Element | Document | DocumentFragment,
    options?: { childrenOnly?: boolean }
  ) {
    this.#classListObserver.disconnect();
    morph(from, to, {
      forceAttribute: this.#schema.forceAttribute,
      metadata: this.#metadata,
      ...options,
    });
    this.#classListObserver.observe();
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
