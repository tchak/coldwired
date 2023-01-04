import invariant from 'tiny-invariant';

import {
  dispatch,
  isFormInputElement,
  focusElement,
  nextAnimationFrame,
  wait,
  AbortError,
  groupBy,
  partition,
} from '@coldwired/utils';

import { ClassListObserver, ClassListObserverDelegate } from './class-list-observer';
import { AttributeObserver, AttributeObserverDelegate } from './attribute-observer';
import { Metadata } from './metadata';
import { morph } from './morph';
import { Schema, defaultSchema } from './schema';

const actionNames = [
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

const fragmentActionNames = ['after', 'before', 'append', 'prepend', 'replace', 'update'];

export type ActionName = typeof actionNames[number];

type ActionParams = {
  targets: Element[];
  fragment?: DocumentFragment;
};

export type Action = {
  action: ActionName;
  delay?: number;
  pin?: boolean | 'last';
  targets: string;
  fragment?: DocumentFragment;
};

type PinnedAction = Pick<Action, 'action' | 'targets' | 'fragment'>;

export class Actions {
  #element: Element;
  #schema: Schema;
  #classListObserver: ClassListObserver;
  #attributeObserver: AttributeObserver;
  #delegate: EventListenerObject & ClassListObserverDelegate & AttributeObserverDelegate;

  #metadata = new Metadata();
  #controller = new AbortController();

  #pending: Promise<void>[] = [];
  #pinned = new Map<string, PinnedAction[]>();

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

  async ready() {
    await Promise.all(this.#pending);
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
    this.reset();
    this.#classListObserver.disconnect();
    this.#attributeObserver.disconnect();
    this.#element.removeEventListener('input', this.#delegate);
  }

  reset() {
    this.#controller.abort();
    this.#controller = new AbortController();
    this.#pinned.clear();
    this.#metadata.clear();
  }

  applyActions(actions: Action[]) {
    const immediateActions = actions.filter(isImmediateAction);
    const delayedActions = groupBy(actions.filter(isDelayedAction), ({ delay }) => delay);

    this.scheduleActions(immediateActions);
    for (const [delay, actions] of delayedActions) {
      this.scheduleActions(actions, delay);
    }
  }

  applyPinnedActions(element: Element) {
    const actions = [...this.#pinned].flatMap(([, actions]) => actions);
    this._applyActionsInContext(actions, element);
  }

  after(params: Omit<Action, 'action'>) {
    this.applyActions([{ action: 'after', ...params }]);
  }

  before(params: Omit<Action, 'action'>) {
    this.applyActions([{ action: 'before', ...params }]);
  }

  append(params: Omit<Action, 'action'>) {
    this.applyActions([{ action: 'append', ...params }]);
  }

  prepend(params: Omit<Action, 'action'>) {
    this.applyActions([{ action: 'prepend', ...params }]);
  }

  remove(params: Omit<Action, 'action'>) {
    this.applyActions([{ action: 'remove', ...params }]);
  }

  replace(params: Omit<Action, 'action'>) {
    this.applyActions([{ action: 'replace', ...params }]);
  }

  update(params: Omit<Action, 'action'>) {
    this.applyActions([{ action: 'update', ...params }]);
  }

  focus(params: Omit<Action, 'action'>) {
    this.applyActions([{ action: 'focus', ...params }]);
  }

  disable(params: Omit<Action, 'action'>) {
    this.applyActions([{ action: 'disable', ...params }]);
  }

  enable(params: Omit<Action, 'action'>) {
    this.applyActions([{ action: 'enable', ...params }]);
  }

  hide(params: Omit<Action, 'action'>) {
    this.applyActions([{ action: 'hide', ...params }]);
  }

  show(params: Omit<Action, 'action'>) {
    this.applyActions([{ action: 'show', ...params }]);
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

  private scheduleActions(actions: Action[], delay?: number) {
    this.#pending.push(this._scheduleActions(actions, delay));
  }

  private async _scheduleActions(actions: Action[], delay?: number) {
    if (!delay) {
      await nextAnimationFrame();
    } else {
      try {
        await wait(delay, this.#controller.signal);
      } catch (error) {
        if (error instanceof AbortError) return;
        throw error;
      }
      if (this.#controller.signal?.aborted) return;
    }
    for (const action of actions) {
      validateAction(action);
      this.pinAction(action);
    }
    this._applyActionsInContext(actions, this.#element);
  }

  private _applyActionsInContext(actions: Action[], element: Element) {
    const [observableActions, unobservableActions] = partition(actions, isFragmentAction);
    this._applyActions(unobservableActions, element);
    this.#classListObserver.disconnect();
    this.#attributeObserver.disconnect();
    this._applyActions(observableActions, element);
    this.#classListObserver.observe();
    this.#attributeObserver.observe();
  }

  private _applyActions(actions: Action[], element: Element) {
    for (const action of actions) {
      const targets = getTargetElements(element, action.targets);
      this[`_${action.action}`]({ ...action, targets });
    }
  }

  private pinAction({ delay, pin, ...params }: Action) {
    if (pin && !delay) {
      const key = `${params.action}--${params.targets}`;
      if (pin == 'last') {
        this.#pinned.set(key, [params]);
      } else {
        let streams = this.#pinned.get(key);
        if (!streams) {
          streams = [];
          this.#pinned.set(key, streams);
        }
        streams.push(params);
      }
    }
  }

  private _after({ targets, fragment }: ActionParams) {
    if (!fragment) return;
    for (const element of targets) {
      element.after(fragment.cloneNode(true));
    }
  }

  private _before({ targets, fragment }: ActionParams) {
    if (!fragment) return;
    for (const element of targets) {
      element.before(fragment.cloneNode(true));
    }
  }

  private _append({ targets, fragment }: ActionParams) {
    if (!fragment) return;
    removeDuplicateTargetChildren(targets, fragment);
    for (const element of targets) {
      element.append(fragment.cloneNode(true));
    }
  }

  private _prepend({ targets, fragment }: ActionParams) {
    if (!fragment) return;
    removeDuplicateTargetChildren(targets, fragment);
    for (const element of targets) {
      element.prepend(fragment.cloneNode(true));
    }
  }

  private _replace({ targets, fragment }: ActionParams) {
    if (!fragment) return;
    for (const element of targets) {
      morph(element, fragment.cloneNode(true) as DocumentFragment, {
        forceAttribute: this.#schema.forceAttribute,
        metadata: this.#metadata,
      });
    }
  }

  private _update({ targets, fragment }: ActionParams) {
    if (!fragment) return;
    for (const element of targets) {
      morph(element, fragment.cloneNode(true) as DocumentFragment, {
        forceAttribute: this.#schema.forceAttribute,
        metadata: this.#metadata,
        childrenOnly: true,
      });
    }
  }

  private _remove({ targets }: ActionParams) {
    for (const element of targets) {
      element.remove();
    }
  }

  private _focus({ targets }: ActionParams) {
    for (const element of targets) {
      focusElement(element);
    }
  }

  private _show({ targets }: ActionParams) {
    for (const element of targets) {
      element.classList.remove(this.#schema.hiddenClassName);
    }
  }

  private _hide({ targets }: ActionParams) {
    for (const element of targets) {
      element.classList.add(this.#schema.hiddenClassName);
    }
  }

  private _enable({ targets }: ActionParams) {
    for (const element of targets) {
      if ('disabled' in element) {
        element.disabled = false;
      }
    }
  }

  private _disable({ targets }: ActionParams) {
    for (const element of targets) {
      if ('disabled' in element) {
        element.disabled = true;
      }
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

export function isValidActionName(actionName: unknown): actionName is ActionName {
  return !!actionName && actionNames.includes(actionName as any);
}

function isImmediateAction(action: Action): action is Action & { delay: undefined } {
  return !action.delay;
}

function isDelayedAction(action: Action): action is Action & { delay: number } {
  return !!action.delay;
}

function isFragmentAction(action: Action): boolean {
  return fragmentActionNames.includes(action.action);
}

function getTargetElements(element: Element, selector: string) {
  return [...element.querySelectorAll(selector)];
}

function validateAction(action: Action) {
  invariant(!(action.delay && action.pin), '[actions] a delayed action cannot be pinned');
  invariant(!isFragmentAction(action) || action.fragment, '[actions] fragment is required');
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
