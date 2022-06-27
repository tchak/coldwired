import { nanoid } from 'nanoid';
import invariant from 'tiny-invariant';

import { Directive } from '../directive-controller';
import { getMetadata } from '../metadata';

export class Fetcher extends Directive {
  connect() {
    const fetcherKey = this.generateFetcherKey();

    getMetadata(this.element, true).fetcherKey = fetcherKey;
    registry.set(fetcherKey, this.element);
  }

  disconnect() {
    const metadata = getMetadata(this.element);
    const fetcherKey = metadata?.fetcherKey;

    if (fetcherKey) {
      this.router.deleteFetcher(fetcherKey);
      registry.delete(fetcherKey);
      delete metadata.fetcherKey;
    }
  }

  private generateFetcherKey() {
    return this.element.id || nanoid();
  }
}

export function getFetcherElement(fetcherKey: string): Element {
  const element = registry.get(fetcherKey);
  invariant(element, `No fetcher element found for "${fetcherKey}"`);
  return element;
}

const registry = new Map<string, Element>();
