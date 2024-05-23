import { parseHTMLFragment, isElement } from '@coldwired/utils';
import type { ComponentType, ReactNode } from 'react';

import type { LayoutComponent, ErrorBoundaryFallbackComponent } from './root.react';
import type {
  hydrate as hydrateFn,
  Manifest,
  Schema as TreeBuilderSchema,
  DocumentFragmentLike,
} from './tree-builder.react';
import { preload, defaultSchema as defaultTreeBuilderSchema } from './preload';

export type Loader = (name: string) => Promise<ComponentType<any>>;
export type { Manifest };

export interface RenderBatch {
  count: number;
  done: Promise<void>;
}

export interface Root {
  render(element: Element, fragment?: DocumentFragmentLike | string): RenderBatch;
  remove(element: Element): boolean;
  contains(element: Element): boolean;
  destroy(): void;
  getCache(): Map<Element, ReactNode>;
}

export interface RootOptions {
  loader: Loader;
  manifest?: Manifest;
  schema?: Partial<Schema>;
  layoutComponentName?: string;
  errorBoundaryFallbackComponentName?: string;
}

export interface Schema extends TreeBuilderSchema {
  fragmentTagName: string;
  loadingClassName: string;
}

export const defaultSchema: Schema = {
  ...defaultTreeBuilderSchema,
  fragmentTagName: 'react-fragment',
  loadingClassName: 'loading',
};

const containerElementMap = new Map<string, Element>();
export function findOrCreateContainerElement(id: string) {
  let container = containerElementMap.get(id) ?? null;
  // container found in cache
  if (container?.isConnected) {
    return container;
  }

  // container found in DOM
  container = document.querySelector(`body > #${id}`);
  if (container?.isConnected) {
    containerElementMap.set(id, container);
    return container;
  }

  // container not found, create a new one
  container = document.createElement('div');
  container.id = id;
  document.body.appendChild(container);
  containerElementMap.set(id, container);
  return container;
}

export function createRoot(container: Element, options: RootOptions): Root;
export function createRoot(options: RootOptions): Root;
export function createRoot(
  containerOrOptions: Element | RootOptions,
  maybeOptions?: RootOptions,
): Root {
  const container =
    containerOrOptions instanceof Element
      ? containerOrOptions
      : findOrCreateContainerElement('react-root');
  const options = containerOrOptions instanceof Element ? maybeOptions! : containerOrOptions;

  const { loader, manifest: preloadedManifest } = options;
  let isDestroyed = false;
  let cache = new Map<Element, ReactNode>();
  const mounted = new Map<Element, (fragment: DocumentFragmentLike | string) => Promise<void>>();
  const subscriptions = new Set<() => void>();
  const manifest: Manifest = Object.assign({}, preloadedManifest);
  const schema = Object.assign({}, defaultSchema, options.schema);

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
    const fragment: DocumentFragmentLike =
      typeof fragmentOrHTML == 'string'
        ? parseHTMLFragment(fragmentOrHTML, element.ownerDocument)
        : fragmentOrHTML;
    if (isElement(fragment) && fragment.tagName.toLowerCase() != schema.fragmentTagName) {
      throw new Error('Cannot rerender with a non-fragment element');
    }
    //const { hydrate } = await import('./react-tree-builder');
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
      await mounting;
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
  let mounting: Promise<void> | undefined;
  let unmount: (() => void) | undefined;
  let hydrate: typeof hydrateFn;
  const mount = async () => {
    if (isDestroyed) {
      throw new Error('Root is destroyed');
    }
    let onMounted: () => void = () => {};
    const mounting = new Promise<void>((resolve) => {
      onMounted = resolve;
    });
    const [
      { createAndRenderReactRoot, hydrate: hydrateFn },
      LayoutComponent,
      ErrorBoundaryFallbackComponent,
    ] = await Promise.all([
      import('./root.react'),
      getLayoutComponent(loader, options.layoutComponentName),
      getErrorBoundaryFallbackComponent(loader, options.errorBoundaryFallbackComponentName),
    ]);
    hydrate = hydrateFn;
    unmount = createAndRenderReactRoot({
      container,
      subscribe,
      getSnapshot,
      onMounted,
      LayoutComponent,
      ErrorBoundaryFallbackComponent,
    });
    await mounting;
  };

  return {
    render(element, fragmentOrHTML) {
      if (fragmentOrHTML) {
        const update = mounted.get(element);
        if (update) {
          return { count: 1, done: update(fragmentOrHTML) };
        }
      } else {
        if (!mounting) {
          mounting = mount();
        }
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
      unmount?.();
      mounted.clear();
      container.remove();
      containerElementMap.clear();
    },
    getCache() {
      return cache;
    },
  };
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

async function getLayoutComponent(
  loader: Loader,
  name?: string,
): Promise<LayoutComponent | undefined> {
  if (name) {
    return (await loader(name)) as LayoutComponent;
  }
  return;
}

async function getErrorBoundaryFallbackComponent(
  loader: Loader,
  name?: string,
): Promise<ErrorBoundaryFallbackComponent | undefined> {
  if (name) {
    return (await loader(name)) as ErrorBoundaryFallbackComponent;
  }
  return;
}
