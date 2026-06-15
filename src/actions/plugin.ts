export interface Plugin {
  ready(): Promise<void>;
  init(element: Element): void;
  validate?(element: Element | Document): void;
  // Called once before a morph begins, so plugins can snapshot state from the
  // pristine tree before morphlex starts mutating it.
  beforeMorph?(from: Element): void;
  onCreateElement?(element: Element): boolean;
  // Called after a node has been inserted into the DOM by a morph (a real
  // attachment, unlike `onCreateElement` which fires before insertion). Lets a
  // plugin reconcile freshly-added nodes with state it preserved during the
  // same morph — e.g. swapping a rescued React subtree back into place.
  onAfterCreateElement?(element: Element): void;
  onBeforeUpdateElement?(element: Element, toElement: Element | DocumentFragment): boolean;
  onBeforeDestroyElement?(element: Element): boolean;
  // Called once after a morph completes, so plugins can finalize per-morph
  // bookkeeping (e.g. drop rescued nodes that were never re-adopted).
  afterMorph?(): void;
  // Return `true` to keep `element` during a morph even when it is absent from
  // the incoming HTML. Used to protect client-only containers (e.g. the React
  // root) that live outside the server-rendered tree.
  shouldPreserveElement?(element: Element): boolean;
}
