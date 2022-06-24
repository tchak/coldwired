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

export function difference<T>(a: Set<T>, b: Set<T>) {
  return new Set([...a].filter((x) => !b.has(x)));
}
