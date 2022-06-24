type ElementMetadata = {
  removedClassNames: Set<string>;
  removedDataAttributes: Set<string>;
  touched: boolean;
  originalContent?: string;
};

export function getMetadata(element: Element) {
  return elementMetadata.get(element) ?? null;
}

export function getOrCreateMetadata(element: Element) {
  let metadata = elementMetadata.get(element);
  if (!metadata) {
    metadata = {
      removedClassNames: new Set(),
      removedDataAttributes: new Set(),
      touched: false,
    };
    elementMetadata.set(element, metadata);
  }
  return metadata;
}

const elementMetadata = new WeakMap<Element, ElementMetadata>();
