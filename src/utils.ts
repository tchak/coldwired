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
  { target, cancelable, detail }: Partial<DispatchOptions<T>> = {}
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
