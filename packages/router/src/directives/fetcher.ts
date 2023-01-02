import { nanoid } from 'nanoid';
import invariant from 'tiny-invariant';

import { Directive } from '../directive-controller';

export class Fetcher extends Directive {
  connect() {
    const fetcherKey = this.generateFetcherKey();

    fetcherKeyRegistry.set(this.element, fetcherKey);
    elementRegistry.set(fetcherKey, this.element);
  }

  disconnect() {
    const fetcherKey = fetcherKeyRegistry.get(this.element);
    fetcherKeyRegistry.delete(this.element);

    if (fetcherKey) {
      this.router.deleteFetcher(fetcherKey);
      elementRegistry.delete(fetcherKey);
    }
  }

  private generateFetcherKey() {
    return this.element.id || nanoid();
  }
}

export function getFetcherElement(fetcherKey: string): Element {
  const element = elementRegistry.get(fetcherKey);
  invariant(element, `No fetcher element found for "${fetcherKey}"`);
  return element;
}

export function getFetcherKey(form: HTMLFormElement): string | null {
  return fetcherKeyRegistry.get(form) ?? null;
}

const elementRegistry = new Map<string, Element>();
const fetcherKeyRegistry = new WeakMap<Element, string>();
