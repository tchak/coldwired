import { Router } from '@remix-run/router';

import type { Schema } from './schema';
import { DirectiveObserver, DirectiveObserverDelegate } from './directive-observer';

export type DirectiveConstructor = new (
  element: Element,
  router: Router,
  schema: Schema,
) => Directive;

export abstract class Directive {
  #element: Element;
  #router: Router;
  #schema: Schema;

  constructor(element: Element, router: Router, schema: Schema) {
    this.#element = element;
    this.#router = router;
    this.#schema = schema;
  }

  get element() {
    return this.#element;
  }

  get router() {
    return this.#router;
  }

  get schema() {
    return this.#schema;
  }

  abstract connect(): void;
  abstract disconnect(): void;
  changed?(value: string): void;
}

export type DirectiveFactory = (element: Element) => Directive;

export class DirectiveController implements DirectiveObserverDelegate {
  #factory: DirectiveFactory;
  #observer: DirectiveObserver;

  #started = false;

  #registry = new Map<Element, Directive>();

  constructor(element: Element, directive: string, factory: (element: Element) => Directive) {
    this.#factory = factory;
    this.#observer = new DirectiveObserver(element, directive, this);
  }

  start() {
    this.#observer.observe();
    this.#started = true;
  }

  stop() {
    if (this.#started) {
      this.#observer.disconnect();
      for (const directive of this.#registry.values()) {
        directive.disconnect?.();
      }
      this.#registry.clear();
      this.#started = false;
    }
  }

  directiveAttributeValueChanged(element: Element, value: string) {
    this.#registry.get(element)?.changed?.(value);
  }

  directiveMatched(element: Element) {
    const directive = this.#factory(element);
    directive.connect();
    this.#registry.set(element, directive);
  }

  directiveUnmatched(element: Element) {
    this.#registry.get(element)?.disconnect();
    this.#registry.delete(element);
  }
}
