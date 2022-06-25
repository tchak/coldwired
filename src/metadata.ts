type Metadata = {
  removedClassNames: Set<string>;
  touched: boolean;
  originalFocused?: boolean;
  originalContent?: string;
  key?: string;
};

export function getMetadata(element: Element) {
  return elementsMetadata.get(element) ?? null;
}

export function getOrCreateMetadata(element: Element) {
  let metadata = elementsMetadata.get(element);
  if (!metadata) {
    metadata = {
      removedClassNames: new Set(),
      touched: false,
    };
    elementsMetadata.set(element, metadata);
  }
  return metadata;
}

export function getElementKey(element: Element) {
  return getMetadata(element)?.key ?? null;
}

export function getElementByKey(key: string) {
  return elementsByKey.get(key) ?? null;
}

export function connectElement(element: Element, key: string) {
  getOrCreateMetadata(element).key = key;
  elementsByKey.set(key, element);
}

export function disconnectElement(key: string) {
  const element = getElementByKey(key);
  elementsByKey.delete(key);
  if (element) {
    const metadata = getMetadata(element);
    if (metadata) {
      delete metadata.key;
    }
  }
}

const elementsMetadata = new WeakMap<Element, Metadata>();
const elementsByKey = new Map<string, Element>();
