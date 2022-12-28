type Metadata = {
  addedClassNames: Set<string>;
  removedClassNames: Set<string>;
  touched: boolean;
  originalFocused?: boolean;
  originalContent?: string;
  fetcherKey?: string;
};

export function getMetadata(element: Element): Metadata | null;
export function getMetadata(element: Element, create: true): Metadata;
export function getMetadata(element: Element, create?: true) {
  let metadata = registry.get(element);
  if (!metadata && create) {
    metadata = {
      addedClassNames: new Set(),
      removedClassNames: new Set(),
      touched: false,
    };
    registry.set(element, metadata);
  }
  return metadata ?? null;
}

const registry = new WeakMap<Element, Metadata>();
