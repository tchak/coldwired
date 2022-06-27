export interface DirectiveObserverDelegate {
  directiveMatched?(element: Element): void;
  directiveUnmatched?(element: Element): void;
  directiveAttributeValueChanged?(element: Element): void;
}

export class DirectiveObserver {
  #element: Element;
  #started: boolean;
  #directive: string;
  #delegate: DirectiveObserverDelegate;

  #elements: Set<Element>;
  #mutationObserver: MutationObserver;

  constructor(element: Element, directive: string, delegate: DirectiveObserverDelegate) {
    this.#element = element;
    this.#started = false;
    this.#directive = directive;
    this.#delegate = delegate;

    this.#elements = new Set();
    this.#mutationObserver = new MutationObserver((mutations) => this.processMutations(mutations));
  }

  observe() {
    if (!this.#started) {
      this.#started = true;
      this.#mutationObserver.observe(this.#element, {
        attributes: true,
        childList: true,
        subtree: true,
      });
      this.refresh();
    }
  }

  disconnect() {
    if (this.#started) {
      this.#mutationObserver.takeRecords();
      this.#mutationObserver.disconnect();
      this.#started = false;
    }
  }

  refresh() {
    if (this.#started) {
      const matches = new Set(this.matchElementsInTree());

      for (const element of Array.from(this.#elements)) {
        if (!matches.has(element)) {
          this.removeElement(element);
        }
      }

      for (const element of Array.from(matches)) {
        this.addElement(element);
      }
    }
  }

  get element() {
    return this.#element;
  }

  get started() {
    return this.#started;
  }

  get attributeName() {
    return this.#directive;
  }

  get selector(): string {
    return `[${this.#directive}]`;
  }

  private processMutations(mutations: MutationRecord[]) {
    if (this.#started) {
      for (const mutation of mutations) {
        this.processMutation(mutation);
      }
    }
  }

  private processMutation(mutation: MutationRecord) {
    if (mutation.type == 'attributes') {
      if (mutation.attributeName == this.attributeName) {
        this.processAttributeChange(mutation.target);
      }
    } else if (mutation.type == 'childList') {
      this.processRemovedNodes(mutation.removedNodes);
      this.processAddedNodes(mutation.addedNodes);
    }
  }

  private processAttributeChange(node: Node) {
    const element = node as Element;
    if (this.#elements.has(element)) {
      if (this.matchElement(element)) {
        this.#delegate.directiveAttributeValueChanged?.(element);
      } else {
        this.removeElement(element);
      }
    } else if (this.matchElement(element)) {
      this.addElement(element);
    }
  }

  private processRemovedNodes(nodes: NodeList) {
    for (const node of Array.from(nodes)) {
      const element = this.elementFromNode(node);
      if (element) {
        this.processTree(element, this.removeElement);
      }
    }
  }

  private processAddedNodes(nodes: NodeList) {
    for (const node of Array.from(nodes)) {
      const element = this.elementFromNode(node);
      if (element && this.elementIsActive(element)) {
        this.processTree(element, this.addElement);
      }
    }
  }

  private matchElement(element: Element): boolean {
    return element.hasAttribute(this.attributeName);
  }

  private matchElementsInTree(tree: Element = this.#element): Element[] {
    const match = this.matchElement(tree) ? [tree] : [];
    const matches = Array.from(tree.querySelectorAll(this.selector));
    return match.concat(matches);
  }

  private processTree(tree: Element, processor: (element: Element) => void) {
    for (const element of this.matchElementsInTree(tree)) {
      processor.call(this, element);
    }
  }

  private elementFromNode(node: Node): Element | undefined {
    if (node.nodeType == Node.ELEMENT_NODE) {
      return node as Element;
    }
    return;
  }

  private elementIsActive(element: Element): boolean {
    if (element.isConnected != this.#element.isConnected) {
      return false;
    } else {
      return this.#element.contains(element);
    }
  }

  private addElement(element: Element) {
    if (!this.#elements.has(element)) {
      if (this.elementIsActive(element)) {
        this.#elements.add(element);
        this.#delegate.directiveMatched?.(element);
      }
    }
  }

  private removeElement(element: Element) {
    if (this.#elements.has(element)) {
      this.#elements.delete(element);
      this.#delegate.directiveUnmatched?.(element);
    }
  }
}
