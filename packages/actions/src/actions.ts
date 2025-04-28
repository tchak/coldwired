import invariant from 'tiny-invariant';

import {
  AbortError,
  dispatch,
  focusElement,
  focusNextElement,
  groupBy,
  isFormElement,
  isFormInputElement,
  nextAnimationFrame,
  parseHTMLDocument,
  parseHTMLFragment,
  partition,
  wait,
} from '@coldwired/utils';

import { AttributeObserver, type AttributeObserverDelegate } from './attribute-observer';
import { ClassListObserver, type ClassListObserverDelegate } from './class-list-observer';
import { Metadata } from './metadata';
import { morph } from './morph';
import type { Plugin } from './plugin';
import { type Schema, defaultSchema } from './schema';

const voidActionNames = [
  'remove',
  'focus',
  'enable',
  'disable',
  'hide',
  'show',
  'reset',
  'refresh',
] as const;
const fragmentActionNames = ['after', 'before', 'append', 'prepend', 'replace', 'update'] as const;
const actionNames = [...voidActionNames, ...fragmentActionNames];

type VoidActionName = (typeof voidActionNames)[number];
type FragmentActionName = (typeof fragmentActionNames)[number];
export type ActionName = VoidActionName | FragmentActionName;

type VoidAction = {
  action: VoidActionName;
  delay?: number;
  pin?: boolean | 'last';
  targets: string;
};
type FragmentAction = {
  action: FragmentActionName;
  delay?: number;
  pin?: boolean | 'last';
  targets: string;
  fragment: DocumentFragment | string;
};
type MaterializedVoidAction = Pick<VoidAction, 'action'> & { targets: Element[] };
type MaterializedFragmentAction = Pick<FragmentAction, 'action' | 'fragment'> & {
  targets: Element[];
};

export type Action = VoidAction | FragmentAction;
export type MaterializedAction = MaterializedVoidAction | MaterializedFragmentAction;

type PinnedAction =
  | Pick<VoidAction, 'action' | 'targets'>
  | Pick<FragmentAction, 'action' | 'targets' | 'fragment'>;

export type ActionsOptions = {
  element?: Element;
  schema?: Partial<Schema>;
  debug?: boolean;
  plugins?: Plugin[];
};

export class Actions {
  #element: Element;
  #schema: Schema;
  #classListObserver: ClassListObserver;
  #attributeObserver: AttributeObserver;
  #delegate: EventListenerObject & ClassListObserverDelegate & AttributeObserverDelegate;

  #metadata = new Metadata();
  #controller = new AbortController();
  #plugins: Plugin[] = [];
  #refreshRequestController?: AbortController;

  #pending = new Set<Promise<void>>();
  #pinned = new Map<string, PinnedAction[]>();

  #debug: boolean;

  constructor(options?: ActionsOptions) {
    this.#element = options?.element ?? document.documentElement;
    this.#schema = { ...defaultSchema, ...options?.schema };
    this.#debug = options?.debug ?? false;
    this.#plugins = options?.plugins ?? [];
    this.#delegate = {
      handleEvent: this.handleEvent.bind(this),
      classListChanged: this.classListChanged.bind(this),
      attributeChanged: this.attributeChanged.bind(this),
    };
    this.#classListObserver = new ClassListObserver(this.#element, this.#delegate);
    this.#attributeObserver = new AttributeObserver(this.#element, this.#delegate);
  }

  async ready() {
    const pendingPlugins = this.#plugins.map((plugin) => plugin.ready());
    await Promise.all([...this.#pending, ...pendingPlugins]);
  }

  get element() {
    return this.#element;
  }

  get plugins() {
    return this.#plugins;
  }

  observe() {
    this.#classListObserver.observe();
    this.#attributeObserver.observe();
    this.#element.addEventListener('input', this.#delegate);
    this.#element.addEventListener('change', this.#delegate);
    this.#element.addEventListener(ACTIONS_EVENT_TYPE, this.#delegate);
    this.#plugins.forEach((plugin) => plugin.init(this.#element));
  }

  disconnect() {
    this.clear();
    this.#classListObserver.disconnect();
    this.#attributeObserver.disconnect();
    this.#element.removeEventListener('input', this.#delegate);
    this.#element.removeEventListener('change', this.#delegate);
    this.#element.removeEventListener(ACTIONS_EVENT_TYPE, this.#delegate);
  }

  clear() {
    this.#controller.abort();
    this.#controller = new AbortController();
    this.#pending.clear();
    this.#pinned.clear();
    this.#metadata.clear();
  }

  applyActions(actions: (Action | MaterializedAction)[]) {
    const materializedActions: MaterializedAction[] = [];
    const unmaterializedActions: Action[] = [];
    for (const action of actions) {
      if (isMaterializedAction(action)) {
        materializedActions.push(action);
      } else {
        unmaterializedActions.push(action);
      }
    }
    this.scheduleMaterializedActions(materializedActions);

    const immediateActions = unmaterializedActions.filter(isImmediateAction);
    const delayedActions = groupBy(
      unmaterializedActions.filter(isDelayedAction),
      ({ delay }) => delay,
    );

    this.scheduleActions(immediateActions);
    for (const [delay, actions] of delayedActions) {
      this.scheduleActions(actions, delay);
    }
  }

  applyPinnedActions(element: Element) {
    const actions = [...this.#pinned].flatMap(([, actions]) => actions);
    this._applyActionsInContext(this.materializeActions(actions, element));
  }

  after(params: Omit<FragmentAction, 'action'> | Omit<MaterializedFragmentAction, 'action'>) {
    this.applyActions([{ action: 'after', ...params }]);
  }

  before(params: Omit<FragmentAction, 'action'> | Omit<MaterializedFragmentAction, 'action'>) {
    this.applyActions([{ action: 'before', ...params }]);
  }

  append(params: Omit<FragmentAction, 'action'> | Omit<MaterializedFragmentAction, 'action'>) {
    this.applyActions([{ action: 'append', ...params }]);
  }

  prepend(params: Omit<FragmentAction, 'action'> | Omit<MaterializedFragmentAction, 'action'>) {
    this.applyActions([{ action: 'prepend', ...params }]);
  }

  replace(params: Omit<FragmentAction, 'action'> | Omit<MaterializedFragmentAction, 'action'>) {
    this.applyActions([{ action: 'replace', ...params }]);
  }

  update(params: Omit<FragmentAction, 'action'> | Omit<MaterializedFragmentAction, 'action'>) {
    this.applyActions([{ action: 'update', ...params }]);
  }

  remove(params: Omit<VoidAction, 'action'> | Omit<MaterializedVoidAction, 'action'>) {
    this.applyActions([{ action: 'remove', ...params }]);
  }

  focus(params: Omit<VoidAction, 'action'> | Omit<MaterializedVoidAction, 'action'>) {
    this.applyActions([{ action: 'focus', ...params }]);
  }

  disable(params: Omit<VoidAction, 'action'> | Omit<MaterializedVoidAction, 'action'>) {
    this.applyActions([{ action: 'disable', ...params }]);
  }

  enable(params: Omit<VoidAction, 'action'> | Omit<MaterializedVoidAction, 'action'>) {
    this.applyActions([{ action: 'enable', ...params }]);
  }

  hide(params: Omit<VoidAction, 'action'> | Omit<MaterializedVoidAction, 'action'>) {
    this.applyActions([{ action: 'hide', ...params }]);
  }

  show(params: Omit<VoidAction, 'action'> | Omit<MaterializedVoidAction, 'action'>) {
    this.applyActions([{ action: 'show', ...params }]);
  }

  reset(params: Omit<VoidAction, 'action'> | Omit<MaterializedVoidAction, 'action'>) {
    this.applyActions([{ action: 'reset', ...params }]);
  }

  refresh(params: Omit<VoidAction, 'action'> | Omit<MaterializedVoidAction, 'action'>) {
    this.applyActions([{ action: 'refresh', ...params }]);
  }

  morph(
    from: Element | Document,
    to: string | Element | Document | DocumentFragment,
    options?: { childrenOnly?: boolean },
  ) {
    this.#classListObserver.disconnect();
    this.#attributeObserver.disconnect();
    this._morph(from, to, options);
    this.#classListObserver.observe();
    this.#attributeObserver.observe();
  }

  private scheduleActions(actions: Action[], delay?: number): void {
    const promise = this._scheduleActions(actions, delay);
    this.#pending.add(promise);
    promise.finally(() => this.#pending.delete(promise));
  }

  private scheduleMaterializedActions(actions: MaterializedAction[]): void {
    const promise = nextAnimationFrame().then(() => this._applyActionsInContext(actions));
    this.#pending.add(promise);
    promise.finally(() => this.#pending.delete(promise));
  }

  private materializeActions(actions: Action[], element: Element): MaterializedAction[] {
    this._debugMaterializeActions(actions, element);
    return actions.map((action) => {
      if (action.action == 'refresh') {
        return { ...action, targets: [] };
      }
      const targets = getTargetElements(element, action.targets);
      return { ...action, targets };
    });
  }

  private async _scheduleActions(actions: Action[], delay?: number): Promise<void> {
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
    this._applyActionsInContext(this.materializeActions(actions, this.#element));
  }

  private _applyActionsInContext(actions: MaterializedAction[]): void {
    const [observableActions, unobservableActions] = partition(actions, isFragmentAction);
    this._applyActions(unobservableActions);
    if (observableActions.length > 0) {
      this.#classListObserver.disconnect();
      this.#attributeObserver.disconnect();
      this._applyActions(observableActions);
      this.#classListObserver.observe();
      this.#attributeObserver.observe();
    }
  }

  private _applyActions(actions: MaterializedAction[]) {
    this._debugApplyActions(actions);
    for (const action of actions) {
      if (isFragmentAction(action)) {
        this[`_${action.action}`](action);
      } else {
        if (action.action != 'focus') {
          action.targets.forEach((element) => {
            this.#plugins.forEach((plugin) => plugin.validate?.(element));
          });
        }
        this[`_${action.action}`](action);
      }
    }
  }

  private _debugMaterializeActions(actions: Action[], element: Element) {
    if (this.#debug && actions.length > 0) {
      if (actions.length == 1) {
        console.groupCollapsed(`[actions] materialize one action:`);
      } else {
        console.groupCollapsed(`[actions] materialize ${actions.length} actions:`);
      }
      for (const action of actions) {
        console.log(`"${action.action}"`, action.targets, element);
      }
      console.groupEnd();
    }
  }

  private _debugApplyActions(actions: MaterializedAction[]) {
    if (this.#debug && actions.length > 0) {
      if (actions.length == 1) {
        console.groupCollapsed(`[actions] apply one action:`);
      } else {
        console.groupCollapsed(`[actions] apply ${actions.length} actions:`);
      }
      for (const action of actions) {
        console.dir(action);
      }
      console.groupEnd();
    }
  }

  private pinAction({ delay, pin, ...params }: Action): void {
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

  _morph(
    from: Element | Document,
    to: string | Element | Document | DocumentFragment,
    options?: { childrenOnly?: boolean },
  ) {
    morph(from, to, {
      metadata: this.#metadata,
      plugins: this.#plugins,
      ...this.#schema,
      ...options,
    });
  }

  private _after({ targets, fragment }: Pick<MaterializedFragmentAction, 'targets' | 'fragment'>) {
    for (const element of targets) {
      element.after(getDocumentFragment(fragment, element));
      const parent = element.parentElement;
      if (parent) {
        this.plugins.forEach((plugin) => plugin.onCreateElement?.(parent));
      }
    }
  }

  private _before({ targets, fragment }: Pick<MaterializedFragmentAction, 'targets' | 'fragment'>) {
    for (const element of targets) {
      element.before(getDocumentFragment(fragment, element));
      const parent = element.parentElement;
      if (parent) {
        this.plugins.forEach((plugin) => plugin.onCreateElement?.(parent));
      }
    }
  }

  private _append({ targets, fragment }: Pick<MaterializedFragmentAction, 'targets' | 'fragment'>) {
    for (const element of targets) {
      element.append(getDocumentFragment(fragment, element, true));
      this.plugins.forEach((plugin) => plugin.onCreateElement?.(element));
    }
  }

  private _prepend({
    targets,
    fragment,
  }: Pick<MaterializedFragmentAction, 'targets' | 'fragment'>) {
    for (const element of targets) {
      element.prepend(getDocumentFragment(fragment, element, true));
      this.plugins.forEach((plugin) => plugin.onCreateElement?.(element));
    }
  }

  private _replace({
    targets,
    fragment,
  }: Pick<MaterializedFragmentAction, 'targets' | 'fragment'>) {
    for (const element of targets) {
      this._morph(element, getDocumentFragment(fragment, element));
    }
  }

  private _update({ targets, fragment }: Pick<MaterializedFragmentAction, 'targets' | 'fragment'>) {
    for (const element of targets) {
      this._morph(element, getDocumentFragment(fragment, element), {
        childrenOnly: true,
      });
    }
  }

  private _remove({ targets }: Pick<MaterializedVoidAction, 'targets'>) {
    for (const element of targets) {
      focusNextElement(element, this.#schema);
      element.remove();
    }
  }

  private _focus({ targets }: Pick<MaterializedVoidAction, 'targets'>) {
    const element = targets.at(0);
    if (element) {
      focusElement(element);
    }
  }

  private _show({ targets }: Pick<MaterializedVoidAction, 'targets'>) {
    for (const element of targets) {
      element.removeAttribute('hidden');
      element.classList.remove(this.#schema.hiddenClassName);
    }
  }

  private _hide({ targets }: Pick<MaterializedVoidAction, 'targets'>) {
    for (const element of targets) {
      focusNextElement(element, this.#schema);
      element.setAttribute('hidden', 'hidden');
      element.classList.add(this.#schema.hiddenClassName);
    }
  }

  private _enable({ targets }: Pick<MaterializedVoidAction, 'targets'>) {
    for (const element of targets) {
      if ('disabled' in element) {
        element.disabled = false;
      }
    }
  }

  private _disable({ targets }: Pick<MaterializedVoidAction, 'targets'>) {
    for (const element of targets) {
      if ('disabled' in element) {
        focusNextElement(element, this.#schema);
        element.disabled = true;
      }
    }
  }

  private _reset({ targets }: Pick<MaterializedVoidAction, 'targets'>) {
    for (const element of targets) {
      if (isFormElement(element)) {
        element.reset();
      } else {
        console.warn('reset action is not supported on non-form elements', element);
      }
    }
  }

  private _refresh() {
    const currentPath = () => `${window.location.pathname}${window.location.search}`;

    this.#refreshRequestController?.abort();
    const controller = new AbortController();
    this.#refreshRequestController = controller;

    const path = currentPath();
    fetch(path, {
      method: 'get',
      signal: controller.signal,
      headers: { accept: 'text/html,application/xhtml+xml' },
      credentials: 'same-origin',
      redirect: 'follow',
    })
      .then(
        (response) => {
          // only apply the result if we are still on the same page
          if (currentPath() == path) {
            if (response.redirected) {
              window.location.href = response.url;
            } else {
              response.text().then((html) => {
                const newDocument = parseHTMLDocument(html);
                if (response.ok) {
                  this._morph(document.body, newDocument.body);
                } else {
                  document.body.innerHTML = newDocument.body.innerHTML;
                }
              });
            }
          }
        },
        (error) => {
          if (error.name != 'AbortError') {
            console.error(`Failed to refresh the page: ${path}`, error);
          }
        },
      )
      .finally(() => {
        this.#refreshRequestController = undefined;
      });
  }

  private handleEvent(event: Event) {
    const target = (event.composedPath && event.composedPath()[0]) || event.target;

    if (event.type == ACTIONS_EVENT_TYPE) {
      const actions: MaterializedAction[] = ((event as ActionsEvent).detail ?? []).map(
        (action) => ({
          ...action,
          targets: [target as Element],
        }),
      );
      this.applyActions(actions);
    } else if (isFormInputElement(target)) {
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
    [...fragment.children].filter((element) => !!element.id).map((element) => element.id),
  );

  return existingChildren.filter((element) => newChildrenIds.has(element.id));
}

function difference<T>(a: Set<T>, b: Set<T>) {
  return new Set([...a].filter((x) => !b.has(x)));
}

export function isValidActionName(actionName: unknown): actionName is ActionName {
  return !!actionName && actionNames.includes(actionName as ActionName);
}

function isImmediateAction(action: Action): action is Action & { delay: undefined } {
  return !action.delay;
}

function isDelayedAction(action: Action): action is Action & { delay: number } {
  return !!action.delay;
}

function isFragmentAction(
  action: Action | MaterializedAction,
): action is FragmentAction | MaterializedFragmentAction {
  return 'fragment' in action;
}

function isMaterializedAction(action: Action | MaterializedAction): action is MaterializedAction {
  return !(typeof action.targets == 'string');
}

function getTargetElements(element: Element, selector: string) {
  if (selector == 'head') {
    return [element.ownerDocument.head];
  } else if (selector == 'body') {
    return [element.ownerDocument.body];
  }
  return [...element.querySelectorAll(selector)];
}

function getDocumentFragment(
  fragmentOrHTML: string | DocumentFragment,
  target: Element,
  deduplicate = false,
) {
  const fragment =
    typeof fragmentOrHTML == 'string'
      ? parseHTMLFragment(fragmentOrHTML, target.ownerDocument)
      : (fragmentOrHTML.cloneNode(true) as DocumentFragment);
  if (deduplicate) {
    removeDuplicateTargetChildren([target], fragment);
  }
  return fragment;
}

function serializeDocumentFragment(action: Action | MaterializedAction) {
  if (isFragmentAction(action)) {
    if (action.fragment instanceof DocumentFragment) {
      const serializer = new XMLSerializer();
      return serializer.serializeToString(action.fragment);
    }
    return action.fragment;
  }
  return;
}

function getTargets(targets?: Element | Element[] | string | null): Element[] {
  if (typeof targets == 'string') {
    return [...document.querySelectorAll(targets)];
  } else if (Array.isArray(targets)) {
    return [...targets];
  }
  return targets ? [targets] : [];
}

function validateAction(action: Action) {
  invariant(!(action.delay && action.pin), '[actions] a delayed action cannot be pinned');
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

    const content = this.querySelector<HTMLScriptElement>(
      'script[type="application/json"]',
    )?.textContent;
    const detail = content ? parseEventDetail(content) : null;

    dispatch(type, { target, detail });

    this.remove();
  }
}

if (!customElements.get('dispatch-event')) {
  customElements.define('dispatch-event', DispatchEventElement);
}

function parseEventDetail(content: string) {
  const maybeJSON = content
    .trim()
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .trim();
  if (!maybeJSON) return null;
  try {
    return JSON.parse(maybeJSON);
  } catch {
    return null;
  }
}

const ACTIONS_EVENT_TYPE = '__actions__';
type ActionsEvent = CustomEvent<
  (Pick<VoidAction, 'action'> | Pick<FragmentAction, 'action' | 'fragment'>)[]
>;

export function dispatchActions(actions: (Action | MaterializedAction)[]) {
  const actionsByTarget = groupBy(
    actions.flatMap((action) => {
      return getTargets(action.targets)
        .filter((target) => target.isConnected)
        .map((target) => [target, action.action, serializeDocumentFragment(action)] as const);
    }),
    ([target]) => target,
  );
  for (const [target, actions] of actionsByTarget) {
    dispatch(ACTIONS_EVENT_TYPE, {
      target,
      detail: actions.map(([, action, fragment]) => ({ action, fragment })),
    });
  }
}

export function dispatchAction({
  targets,
  ...action
}: (Pick<VoidAction, 'action'> | Pick<FragmentAction, 'action' | 'fragment'>) & {
  targets?: Element | Element[] | string | null;
}) {
  dispatchActions([{ ...action, targets: getTargets(targets) }]);
}
