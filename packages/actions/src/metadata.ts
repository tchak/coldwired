type MetadataValue = {
  addedClassNames: Set<string>;
  removedClassNames: Set<string>;
  touched: boolean;
  attributes: Record<string, string | null>;
};

export class Metadata {
  #registry = new WeakMap<Element, MetadataValue>();

  get(element: Element): MetadataValue | null {
    return this.#registry.get(element) ?? null;
  }

  getOrCreate(element: Element): MetadataValue {
    let metadata = this.#registry.get(element);
    if (!metadata) {
      metadata = {
        addedClassNames: new Set(),
        removedClassNames: new Set(),
        touched: false,
        attributes: {},
      };
      this.#registry.set(element, metadata);
    }
    return metadata;
  }
}
