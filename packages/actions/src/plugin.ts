export interface Plugin {
  ready(): Promise<void>;
  init(element: Element): void;
  validate?(element: Element | Document): void;
  onCreateElement?(element: Element): boolean;
  onBeforeUpdateElement?(element: Element, toElement: Element | DocumentFragment): boolean;
  onBeforeDestroyElement?(element: Element): boolean;
}
