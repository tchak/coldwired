type Metadata = {
  addedClassNames: Set<string>;
  removedClassNames: Set<string>;
  touched: boolean;
};

export function getMetadata(element: Element): Metadata | null;
export function getMetadata(element: Element, create: true): Metadata;
export function getMetadata(element: Element, create?: true) {
  let metadata = metadataRegistry.get(element);
  if (!metadata && create) {
    metadata = {
      addedClassNames: new Set(),
      removedClassNames: new Set(),
      touched: false,
    };
    metadataRegistry.set(element, metadata);
  }
  return metadata ?? null;
}

const metadataRegistry = new WeakMap<Element, Metadata>();
