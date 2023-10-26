import justDebounce from 'just-debounce-it';
import justThrottle from 'just-throttle';

export type Locatable = URL | string;

export function expandURL(locatable: Locatable) {
  return new URL(locatable.toString(), document.baseURI);
}

export function relativeURL(url: URL) {
  return `${url.pathname}${url.search}`;
}

export type DispatchOptions<T> = {
  target: EventTarget & { isConnected?: boolean };
  cancelable: boolean;
  detail: T;
};

export function dispatch<T>(
  eventName: string,
  { target, cancelable, detail }: Partial<DispatchOptions<T>> = {},
) {
  const event = new CustomEvent(eventName, {
    cancelable,
    bubbles: true,
    detail,
  });

  if (target && target.isConnected) {
    target.dispatchEvent(event);
  } else {
    document.documentElement.dispatchEvent(event);
  }

  return event;
}

const DEFAULT_INTERVAL = 500;

export function debounce(target: Element, callback: () => void, interval?: number) {
  let fn = debounced.get(target);
  if (!fn) {
    if (interval != 0) {
      fn = justDebounce(callback, interval ?? DEFAULT_INTERVAL);
      debounced.set(target, fn);
    }
  }
  (fn ?? callback)();
}
const debounced = new WeakMap<Element, ReturnType<typeof justDebounce>>();

export function cancelDebounce(target: Element) {
  debounced.get(target)?.cancel();
}

export function throttle(target: Element, callback: () => void, interval?: number) {
  let fn = throttled.get(target);
  if (!fn) {
    if (interval != 0) {
      fn = justThrottle(callback, interval ?? DEFAULT_INTERVAL);
      throttled.set(target, fn);
    }
  }
  (fn ?? callback)();
}
const throttled = new WeakMap<Element, ReturnType<typeof justThrottle>>();

export function cancelThrottle(target: Element) {
  throttled.get(target)?.cancel();
}

export function parseIntWithDefault(value: string | null, defaultValue = 0) {
  return value ? parseInt(value) : defaultValue;
}

export type HTMLSubmitterElement = HTMLInputElement | HTMLButtonElement;

export function isElement(node: unknown): node is Element {
  return isNode(node) && node.nodeType == Node.ELEMENT_NODE;
}

export function isHTMLElement(node: unknown): node is HTMLElement {
  return isElement(node) && 'style' in node;
}

export function isButtonElement(node: unknown): node is HTMLButtonElement {
  return isElement(node) && node.tagName == 'BUTTON';
}

export function isAnchorElement(node: unknown): node is HTMLAnchorElement {
  return isElement(node) && node.tagName == 'A';
}

export function isLinkElement(node: unknown): node is HTMLLinkElement {
  return isElement(node) && node.tagName == 'LINK';
}

export function isFormElement(node: unknown): node is HTMLFormElement {
  return isElement(node) && node.tagName == 'FORM';
}

export function isSubmitterElement(node: unknown): node is HTMLSubmitterElement {
  return isButtonElement(node) || isInputElement(node);
}

export function isInputElement(node: unknown): node is HTMLInputElement {
  return isElement(node) && node.tagName == 'INPUT';
}

export function isFormInputElement(
  node: unknown,
): node is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return isElement(node) && ['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName);
}

export function isTextAreaElement(node: unknown): node is HTMLTextAreaElement {
  return isElement(node) && node.tagName == 'TEXTAREA';
}

export function isSelectElement(node: unknown): node is HTMLSelectElement {
  return isElement(node) && node.tagName == 'SELECT';
}

export function isFormOptionElement(node: unknown): node is HTMLOptionElement {
  return isElement(node) && node.tagName == 'OPTION';
}

export function isDateInputElement(node: unknown): node is HTMLInputElement {
  return isInputElement(node) && isDateType(node.type);
}

export function isNumberInputElement(node: unknown): node is HTMLInputElement {
  return isInputElement(node) && node.type == 'number';
}

export function isCheckboxInputElement(node: unknown): node is HTMLInputElement {
  return isInputElement(node) && node.type == 'checkbox';
}

export function isRadioInputElement(node: unknown): node is HTMLInputElement {
  return isInputElement(node) && node.type == 'radio';
}

export function isRangeInputElement(node: unknown): node is HTMLInputElement {
  return isInputElement(node) && node.type == 'range';
}

export function isColorInputElement(node: unknown): node is HTMLInputElement {
  return isInputElement(node) && node.type == 'color';
}

export function isFileInputElement(node: unknown): node is HTMLInputElement {
  return isInputElement(node) && node.type == 'file';
}

export function isHiddenInputElement(node: unknown): node is HTMLInputElement {
  return isInputElement(node) && node.type == 'hidden';
}

export function isTextInputElement(node: unknown): node is HTMLInputElement | HTMLTextAreaElement {
  return isTextAreaElement(node) || (isInputElement(node) && isTextType(node.type));
}

export function isInputableElement(node: unknown): node is HTMLInputElement | HTMLTextAreaElement {
  return isTextAreaElement(node) || (isInputElement(node) && isInputableType(node.type));
}

export function isChangeableElement(node: unknown): node is HTMLInputElement | HTMLSelectElement {
  return isSelectElement(node) || (isInputElement(node) && isChangeableType(node.type));
}

export function isElementOrText(node: unknown): node is Element | Text {
  return isNode(node) && (node.nodeType == Node.TEXT_NODE || node.nodeType == Node.ELEMENT_NODE);
}

function isNode(node: unknown): node is Node {
  return !!node && 'nodeType' in (node as any);
}

export function isFocused(element: Element) {
  return element.ownerDocument.activeElement == element;
}

export function focusElement(element: Element) {
  if ('focus' in element && typeof element.focus == 'function') {
    element.focus();
    if (isInputableElement(element)) {
      element.setSelectionRange(element.value.length, element.value.length);
    }
  }
}

export type FocusNextOptions = { focusGroupAttribute?: string; focusDirectionAttribute?: string };

export function focusNextElement(element: Element, options?: FocusNextOptions) {
  const activeElement = element.ownerDocument.activeElement;
  if (activeElement && (element == activeElement || element.contains(activeElement))) {
    const nextFocusedElement = getNextFocusableElement(element, activeElement, options);
    if (nextFocusedElement) {
      focusElement(nextFocusedElement);
    }
  }
}

export function parseHTMLDocument(html: string) {
  return new DOMParser().parseFromString(html, 'text/html');
}

export function parseHTMLFragment(html: string, ownerDocument: Document): DocumentFragment {
  const template = ownerDocument.createElement('template');
  template.innerHTML = html;
  const fragment = template.content;
  fragment.normalize();
  return fragment;
}

export function domReady() {
  return new Promise<void>((resolve) => {
    if (document.readyState == 'loading') {
      document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
    } else {
      resolve();
    }
  });
}

export function nextAnimationFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export class AbortError extends Error {}

export function wait(delay: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, delay);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new AbortError('Aborted'));
      },
      { once: true },
    );
  });
}

export function groupBy<T, K>(array: T[], predicat: (entry: T) => K): Map<K, T[]> {
  return array.reduce<Map<K, T[]>>((map, entry) => {
    const key = predicat(entry);
    const entries = map.get(key);
    if (!entries) {
      map.set(key, [entry]);
    } else {
      entries.push(entry);
    }
    return map;
  }, new Map());
}

export function partition<T>(array: T[], predicat: (entry: T) => boolean): [yes: T[], no: T[]] {
  return array.reduce<[yes: T[], no: T[]]>(
    (parts, entry) => {
      if (predicat(entry)) {
        parts[0].push(entry);
      } else {
        parts[1].push(entry);
      }
      return parts;
    },
    [[], []],
  );
}

function getNextFocusableElement(
  element: Element,
  activeElement: Element,
  options?: FocusNextOptions,
) {
  const focusDirectionAttribute = options?.focusDirectionAttribute;
  const focusGroupAttribute = options?.focusGroupAttribute;
  const focusDirection = focusDirectionAttribute
    ? element.closest(`[${focusDirectionAttribute}]`)?.getAttribute(focusDirectionAttribute)
    : 'prev';
  const focusGroupElement = focusGroupAttribute
    ? element.closest(`[${focusGroupAttribute}]`)
    : null;
  const nextFocusedElementInGroup = focusGroupElement
    ? getNextFocusableElementInGroup(
        focusGroupElement,
        element,
        activeElement,
        focusDirection == 'next' ? 'next' : 'prev',
      )
    : null;

  return (
    nextFocusedElementInGroup ||
    getNextFocusableElementInGroup(
      element.ownerDocument.body,
      element,
      activeElement,
      focusDirection == 'next' ? 'next' : 'prev',
    )
  );
}

function getNextFocusableElementInGroup(
  focusGroupElement: Element,
  element: Element,
  activeElement: Element,
  direction: 'prev' | 'next' = 'prev',
) {
  const focusable = getKeyboardFocusableElements(focusGroupElement, element, activeElement);
  const index = focusable.indexOf(activeElement);
  if (focusable.length < 2) {
    return null;
  }
  const lastIndex = focusable.length - 1;
  const prevIndex = index != 0 ? index - 1 : index + 1;
  const nextIndex = index != lastIndex ? index + 1 : index - 1;
  if (direction == 'prev') {
    return focusable.at(prevIndex) ?? focusable.at(nextIndex) ?? null;
  }
  return focusable.at(nextIndex) ?? focusable.at(prevIndex) ?? null;
}

function getKeyboardFocusableElements(
  element: Element,
  elementToRemove: Element,
  activeElement: Element,
): Element[] {
  return [
    ...element.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), details, [tabindex]:not([tabindex="-1"])',
    ),
  ].filter(
    (element) =>
      element == activeElement ||
      (!element.closest('[aria-hidden], [hidden]') && !elementToRemove.contains(element)),
  );
}

const TEXT_TYPES = ['text', 'search', 'url', 'tel', 'password', 'email'];
function isTextType(type: string) {
  return TEXT_TYPES.includes(type);
}

const DATE_TYPES = ['date', 'datetime-local', 'month', 'week', 'time'];
function isDateType(type: string) {
  return DATE_TYPES.includes(type);
}

const INPUTABLE_TYPES = [...TEXT_TYPES, ...DATE_TYPES, 'number'];
function isInputableType(type: string) {
  return INPUTABLE_TYPES.includes(type);
}

const CHANGEABLE_TYPES = ['checkbox', 'radio', 'range', 'file', 'color'];
function isChangeableType(type: string) {
  return CHANGEABLE_TYPES.includes(type);
}

type InputMatcher<T extends HTMLElement = HTMLInputElement> = (element: T) => void;

export function matchInputElement(
  node: unknown,
  matcher: {
    inputable?: InputMatcher<HTMLInputElement | HTMLTextAreaElement>;
    changeable?: InputMatcher<HTMLInputElement | HTMLSelectElement>;
    text?: InputMatcher<HTMLInputElement | HTMLTextAreaElement>;
    select?: InputMatcher<HTMLSelectElement>;
    date?: InputMatcher;
    number?: InputMatcher;
    checkbox?: InputMatcher;
    radio?: InputMatcher;
    range?: InputMatcher;
    file?: InputMatcher;
    color?: InputMatcher;
    hidden?: InputMatcher;
  },
  options?: { disabled?: boolean },
) {
  if (isFormInputElement(node) && !options?.disabled && node.disabled) {
    return;
  }

  if (isInputableElement(node)) {
    if (matcher.text && isTextInputElement(node)) {
      matcher.text(node);
    } else if (matcher.date && isDateInputElement(node)) {
      matcher.date(node);
    } else if (matcher.number && isNumberInputElement(node)) {
      matcher.number(node);
    } else {
      matcher.inputable?.(node);
    }
  } else if (isChangeableElement(node)) {
    if (matcher.select && isSelectElement(node)) {
      matcher.select(node);
    } else if (matcher.checkbox && isCheckboxInputElement(node)) {
      matcher.checkbox(node);
    } else if (matcher.radio && isRadioInputElement(node)) {
      matcher.radio(node);
    } else if (matcher.range && isRangeInputElement(node)) {
      matcher.range(node);
    } else if (matcher.file && isFileInputElement(node)) {
      matcher.file(node);
    } else if (matcher.color && isColorInputElement(node)) {
      matcher.color(node);
    } else {
      matcher.changeable?.(node);
    }
  } else if (isHiddenInputElement(node)) {
    matcher.hidden?.(node);
  }
}
