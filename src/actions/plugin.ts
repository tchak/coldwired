export interface Plugin {
  ready(): Promise<void>;
  init(element: Element): void;
  validate?(element: Element | Document): void;
  onCreateElement?(element: Element): boolean;
  onBeforeUpdateElement?(element: Element, toElement: Element | DocumentFragment): boolean;
  onBeforeDestroyElement?(element: Element): boolean;
  // Return `true` to keep `element` during a morph even when it is absent from
  // the incoming HTML. Used to protect client-only containers (e.g. the React
  // root) that live outside the server-rendered tree.
  shouldPreserveElement?(element: Element): boolean;
}
