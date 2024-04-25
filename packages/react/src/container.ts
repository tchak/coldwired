import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import {
  useSyncExternalStore,
  useEffect,
  createElement,
  Fragment,
  type ReactNode,
  type ComponentType,
} from 'react';
import { parseHTMLFragment, isElement } from '@coldwired/utils';

import { hydrate, preload, type Manifest } from './react-tree-builder';

export type Loader = (name: string) => Promise<ComponentType>;

export interface Container {
  mount(rootElement: Element, Layout?: ComponentType<{ children: ReactNode }>): Promise<void>;
  render(element: Element, fragment?: Element | DocumentFragment | string): Promise<void>;
  remove(element: Element): void;
  isFragment(element: Element): boolean;
  isInsideFragment(element: Element): boolean;
  destroy(): void;
  getCache(): Map<Element, ReactNode>;
}

export interface ContainerOptions {
  loader: Loader;
  fragmentTagName: string;
  loadingClassName: string;
  manifest?: Manifest;
}

export function createContainer({
  loader,
  manifest: preloadedManifest,
  fragmentTagName,
  loadingClassName,
}: ContainerOptions): Container {
  let isDestroyed = false;
  let cache = new Map<Element, ReactNode>();
  const mounted = new Map<
    Element,
    (fragment: Element | DocumentFragment | string) => Promise<void>
  >();
  const subscriptions = new Set<() => void>();
  const manifest: Manifest = Object.assign({}, preloadedManifest);

  const notify = () => {
    if (!isDestroyed) {
      cache = new Map(cache);
      subscriptions.forEach((callback) => callback());
    }
  };

  const render = async (
    element: Element,
    fragmentOrHTML: Element | DocumentFragment | string,
    reset: boolean,
  ) => {
    const fragment =
      typeof fragmentOrHTML == 'string'
        ? parseHTMLFragment(fragmentOrHTML, element.ownerDocument)
        : fragmentOrHTML;
    if (isElement(fragment) && fragment.tagName.toLowerCase() != fragmentTagName) {
      throw new Error('Cannot rerender with a non-fragment element');
    }
    await preload(fragment, (names) => manifestLoader(names, loader, manifest));
    const tree = hydrate(fragment, manifest);
    if (reset) {
      element.innerHTML = '';
    }
    cache.set(element, tree);
    notify();
    element.classList.remove(loadingClassName);
    if (element.classList.length == 0) {
      element.removeAttribute('class');
    }
  };

  const registerDestroyer = (element: Element) => {
    const observer = new MutationObserver((mutations) => {
      const removedNodes = mutations.flatMap((mutation) => Array.from(mutation.removedNodes));
      const node = removedNodes.find((node) => node == element);
      if (node && !node.isConnected) {
        mounted.delete(element);
        cache.delete(element);
        observer.disconnect();
        notify();
      }
    });
    observer.observe(element.parentNode!, { childList: true });
  };

  const create = async (element: Element) => {
    if (!isDestroyed && !mounted.has(element)) {
      mounted.set(element, (fragmentOrHTML) => render(element, fragmentOrHTML, false));
      registerDestroyer(element);
      await render(element, element, true);
    }
  };

  const getSnapshot = () => cache;
  const subscribe = (callback: () => void) => {
    if (!isDestroyed) {
      subscriptions.add(callback);
    }
    return () => {
      subscriptions.delete(callback);
    };
  };
  let unmount: (() => void) | undefined;

  return {
    async mount(providerRootElement, Layout = ({ children }) => children) {
      if (unmount) {
        throw new Error('Container is already mounted');
      }
      if (isDestroyed) {
        throw new Error('Container is destroyed');
      }
      let onMounted: () => void = () => {};
      const ready = new Promise<void>((resolve) => {
        onMounted = resolve;
      });
      unmount = createProvider({
        providerRootElement,
        subscribe,
        getSnapshot,
        onMounted,
        Layout,
      });

      await ready;
    },
    async render(element, fragmentOrHTML) {
      if (fragmentOrHTML) {
        await mounted.get(element)?.(fragmentOrHTML);
      } else {
        if (element.tagName.toLowerCase() == fragmentTagName) {
          await create(element);
        } else {
          const elements = Array.from(element.querySelectorAll(fragmentTagName));
          if (elements.length) {
            await Promise.all(elements.map(create));
          }
        }
      }
    },
    remove(element) {
      if (mounted.has(element)) {
        mounted.delete(element);
        cache.delete(element);
        notify();
      }
    },
    isFragment(element) {
      return mounted.has(element);
    },
    isInsideFragment(element) {
      return !!element.closest(fragmentTagName) && element.tagName.toLowerCase() != fragmentTagName;
    },
    destroy() {
      isDestroyed = true;
      for (const element of cache.keys()) {
        element.remove();
      }
      cache.clear();
      notify();
      subscriptions.clear();
      for (const name of Object.keys(manifest)) {
        delete manifest[name];
      }
      mounted.clear();
      unmount?.();
    },
    getCache() {
      return cache;
    },
  };
}

function createProvider({
  providerRootElement,
  subscribe,
  getSnapshot,
  Layout,
  onMounted,
}: {
  providerRootElement: Element;
  subscribe(callback: () => void): () => void;
  getSnapshot(): Map<Element, ReactNode>;
  Layout: ComponentType<{ children: ReactNode }>;
  onMounted: () => void;
}) {
  const root = createRoot(providerRootElement);
  root.render(
    createElement(
      Layout,
      null,
      createElement(ContainerProvider, { subscribe, getSnapshot, onMounted }),
    ),
  );
  return () => root.unmount();
}

function ContainerProvider({
  subscribe,
  getSnapshot,
  onMounted,
}: {
  subscribe(callback: () => void): () => void;
  getSnapshot(): Map<Element, ReactNode>;
  onMounted: () => void;
}) {
  useEffect(onMounted, []);
  const cache = useSyncExternalStore(subscribe, getSnapshot);

  return createElement(
    Fragment,
    null,
    ...Array.from(cache).map(([element, content]) =>
      createPortal(content, element, getKeyForElement(element)),
    ),
  );
}

const keys = new WeakMap<Element, string>();

function getKeyForElement(element: Element): string {
  let key = keys.get(element);
  if (!key) {
    key = Math.random().toString(36).slice(2);
    keys.set(element, key);
  }
  return key;
}

async function manifestLoader(names: string[], loader: Loader, manifest: Manifest) {
  await Promise.all(
    names
      .filter((name) => !manifest[name])
      .map((name) =>
        loader(name).then((component) => {
          manifest[name] = component;
        }),
      ),
  );
  return manifest;
}
