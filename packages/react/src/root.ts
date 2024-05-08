import { createPortal } from 'react-dom';
import { createRoot as createReactRoot, type Root as ReactRoot } from 'react-dom/client';
import {
  useSyncExternalStore,
  useEffect,
  createElement,
  Fragment,
  StrictMode,
  type ReactNode,
  type ComponentType,
} from 'react';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import { parseHTMLFragment, isElement } from '@coldwired/utils';

import {
  hydrate,
  preload,
  defaultSchema as defaultTreeBuilderSchema,
  type Manifest,
  type Schema as TreeBuilderSchema,
  type DocumentFragmentLike,
} from './react-tree-builder';

export type Loader = (name: string) => Promise<ComponentType>;
export type { Manifest };

export interface RenderBatch {
  count: number;
  done: Promise<void>;
}

export interface Root {
  mount(): Promise<void>;
  unmount(): void;
  render(element: Element, fragment?: DocumentFragmentLike | string): RenderBatch;
  remove(element: Element): boolean;
  contains(element: Element): boolean;
  destroy(): void;
  getCache(): Map<Element, ReactNode>;
}

export interface RootOptions {
  loader: Loader;
  Layout?: ComponentType<{ children: ReactNode }>;
  manifest?: Manifest;
  schema?: Partial<Schema>;
  fallbackRender?: FallbackRender;
}

export interface Schema extends TreeBuilderSchema {
  fragmentTagName: string;
  loadingClassName: string;
}

export const defaultSchema: Schema = {
  ...defaultTreeBuilderSchema,
  fragmentTagName: 'turbo-fragment',
  loadingClassName: 'loading',
};

export function createRoot(container: Element, options: RootOptions): Root {
  const { loader, manifest: preloadedManifest } = options;
  let isDestroyed = false;
  let cache = new Map<Element, ReactNode>();
  const mounted = new Map<Element, (fragment: DocumentFragmentLike | string) => Promise<void>>();
  const subscriptions = new Set<() => void>();
  const manifest: Manifest = Object.assign({}, preloadedManifest);
  const schema = Object.assign({}, defaultSchema, options.schema);
  const fallbackRender = options.fallbackRender ?? defaultFallbackRender;
  const Layout = options.Layout ?? StrictMode;

  const notify = () => {
    if (!isDestroyed) {
      cache = new Map(cache);
      subscriptions.forEach((callback) => callback());
    }
  };

  const render = async (
    element: Element,
    fragmentOrHTML: DocumentFragmentLike | string,
    reset: boolean,
  ) => {
    const fragment =
      typeof fragmentOrHTML == 'string'
        ? parseHTMLFragment(fragmentOrHTML, element.ownerDocument)
        : fragmentOrHTML;
    if (isElement(fragment) && fragment.tagName.toLowerCase() != schema.fragmentTagName) {
      throw new Error('Cannot rerender with a non-fragment element');
    }
    await preload(fragment, (names) => manifestLoader(names, loader, manifest), schema);
    const tree = hydrate(fragment, manifest, schema);
    if (reset) {
      element.innerHTML = '';
    }
    cache.set(element, tree);
    notify();
    element.classList.remove(schema.loadingClassName);
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
  let root: ReactRoot | undefined;

  return {
    async mount() {
      if (root) {
        throw new Error('Root is already mounted');
      }
      if (isDestroyed) {
        throw new Error('Root is destroyed');
      }
      let onMounted: () => void = () => {};
      const ready = new Promise<void>((resolve) => {
        onMounted = resolve;
      });
      root = createReactRoot(container);
      root.render(
        createElement(
          Layout,
          null,
          createElement(RootProvider, { subscribe, getSnapshot, onMounted, fallbackRender }),
        ),
      );

      await ready;
    },
    unmount() {
      if (root) {
        root.unmount();
        root = undefined;
      }
    },
    render(element, fragmentOrHTML) {
      if (fragmentOrHTML) {
        const update = mounted.get(element);
        if (update) {
          return { count: 1, done: update(fragmentOrHTML) };
        }
      } else {
        if (element.tagName.toLowerCase() == schema.fragmentTagName) {
          return { count: 1, done: create(element) };
        } else {
          const elements = Array.from(element.querySelectorAll(schema.fragmentTagName));
          if (elements.length) {
            return {
              count: elements.length,
              done: Promise.all(elements.map(create)).then(() => undefined),
            };
          }
        }
      }
      return { count: 0, done: Promise.resolve() };
    },
    remove(element) {
      if (mounted.has(element)) {
        mounted.delete(element);
        cache.delete(element);
        notify();
        return true;
      }
      return false;
    },
    contains(element) {
      return (
        element.tagName.toLowerCase() != schema.fragmentTagName &&
        !!element.closest(schema.fragmentTagName)
      );
    },
    destroy() {
      isDestroyed = true;
      cache.clear();
      notify();
      subscriptions.clear();
      root?.unmount?.();
      for (const name of Object.keys(manifest)) {
        delete manifest[name];
      }
      mounted.clear();
    },
    getCache() {
      return cache;
    },
  };
}

export type FallbackRender = (props: FallbackProps & { element: Element }) => ReactNode;

const defaultFallbackRender: FallbackRender = ({ error, element }) => {
  const message = element.getAttribute('fallback-message') ?? error.message;
  return createElement(
    'div',
    { role: 'alert' },
    createElement('pre', { style: { color: 'red' } }, message),
  );
};

function RootProvider({
  subscribe,
  getSnapshot,
  onMounted,
  fallbackRender,
}: {
  subscribe(callback: () => void): () => void;
  getSnapshot(): Map<Element, ReactNode>;
  onMounted: () => void;
  fallbackRender: FallbackRender;
}) {
  useEffect(onMounted, []);
  const cache = useSyncExternalStore(subscribe, getSnapshot);

  return createElement(
    Fragment,
    null,
    ...Array.from(cache).map(([element, content]) =>
      createPortal(
        createElement(
          ErrorBoundary,
          {
            fallbackRender: (props) => fallbackRender({ element, ...props }),
          },
          content,
        ),
        element,
        getKeyForElement(element),
      ),
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
