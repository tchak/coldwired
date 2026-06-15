import type { ComponentType, ReactNode } from 'react';
import { isElement, parseHTMLFragment } from '../utils';

import { defaultSchema as defaultTreeBuilderSchema, preload } from './preload';
import type { ErrorBoundaryFallbackComponent, LayoutComponent } from './root.react';
import { createAndRenderReactRoot, flushSync, hydrate } from './root.react';
import type {
  DocumentFragmentLike,
  Manifest,
  Schema as TreeBuilderSchema,
} from './tree-builder.react';

export type Loader = (name: string) => Promise<ComponentType<any>>;
export type { Manifest };

export interface RenderBatch {
  count: number;
  done: Promise<void>;
}

export interface Root {
  render(element: Element, fragment?: DocumentFragmentLike | string): RenderBatch;
  remove(element: Element): boolean;
  beginMorph(): void;
  stash(node: Element): void;
  adopt(node: Element): RenderBatch | null;
  finalizeMorph(): void;
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
  cache?: boolean;
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

// Containers created/adopted by `findOrCreateContainerElement` are client-only
// `<body>` children (the React root, react-aria's portal target, …). They are
// not part of the server-rendered HTML, so a whole-document morph would treat
// them as unmatched and remove them — unmounting the React tree. We track them
// here so the morph can be told to keep them in place. See the react `Plugin`'s
// `shouldPreserveElement` and `morph.ts`'s `beforeNodeRemoved`.
const managedContainers = new WeakSet<Element>();

export function isManagedContainerElement(element: Element): boolean {
  return managedContainers.has(element);
}

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
    managedContainers.add(container);
    return container;
  }

  // container not found, create a new one
  container = document.createElement('div');
  container.id = id;
  document.body.appendChild(container);
  containerElementMap.set(id, container);
  managedContainers.add(container);
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
  // Live fragments rescued from a subtree being removed during a morph, keyed
  // by a stable anchor (the fragment's own id, else its nearest id-bearing
  // ancestor — e.g. a wrapping container `<div id>`). They stay mounted so an
  // equivalent fragment re-added elsewhere in the same morph can adopt the live
  // node — preserving its React/react-aria state instead of being torn down and
  // re-created (see `stash` / `adopt`).
  const stashed = new Map<string, Element>();
  // Anchor keys shared by more than one fragment in a single morph. The mapping
  // is then ambiguous, so we don't risk adopting the wrong node — those
  // fragments fall back to being re-created.
  const ambiguous = new Set<string>();
  // Anchor key per mounted fragment, captured *before* a morph runs — morphlex
  // mutates the live tree as it works (it can strip a container's id while
  // matching), so the key must be read from the pristine DOM up front.
  const anchorKeys = new Map<Element, string>();
  const subscriptions = new Set<() => void>();
  const manifest: Manifest = { ...preloadedManifest };
  const schema = { ...defaultSchema, ...options.schema };

  const notify = () => {
    if (!isDestroyed) {
      cache.forEach((_, element) => {
        if (!element.isConnected) {
          cache.delete(element);
          mounted.delete(element);
        }
      });
      cache = new Map(cache);
      // Commit synchronously. coldwired drives these updates from outside React
      // (morph lifecycle, microtasks, mutation observers), where the default
      // concurrent root would only *schedule* the re-render and leave it pending
      // until some later macrotask. Forcing the flush keeps the React tree
      // settled at the end of a morph, so a subsequently-typed react-aria
      // controlled value commits on its own tick instead of needing repeated
      // external event-loop turns to drain the scheduler.
      flushSync(() => {
        subscriptions.forEach((callback) => callback());
      });
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
    await preload(fragment, (names) => manifestLoader(names, loader, manifest), schema);
    const tree = hydrate(fragment, manifest, schema);

    if (options.cache) {
      saveFragmentCache(element, fragmentOrHTML);
    }

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
    const parent = element.parentNode;
    if (!parent) return;
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (node === element && !element.isConnected) {
            mounted.delete(element);
            cache.delete(element);
            observer.disconnect();
            notify();
            return;
          }
        }
      }
    });
    observer.observe(parent, { childList: true });
  };

  const create = async (element: Element) => {
    // If an equivalent live fragment is stashed (rescued from a subtree removed
    // earlier in this morph), don't mount a fresh tree — `adopt` will swap the
    // live node into this position instead.
    const key = fragmentKey(element);
    if (key && !ambiguous.has(key) && stashed.has(key)) {
      return;
    }
    if (!isDestroyed && !mounted.has(element)) {
      await mounting;
      mounted.set(element, (fragmentOrHTML) => render(element, fragmentOrHTML, false));
      registerDestroyer(element);
      if (options.cache) {
        restoreFragmentCache(element);
      }
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
  const mount = async () => {
    if (isDestroyed) {
      throw new Error('Root is destroyed');
    }
    let onMounted: () => void = () => {};
    const mounting = new Promise<void>((resolve) => {
      onMounted = resolve;
    });
    const [LayoutComponent, ErrorBoundaryFallbackComponent] = await Promise.all([
      getLayoutComponent(loader, options.layoutComponentName),
      getErrorBoundaryFallbackComponent(loader, options.errorBoundaryFallbackComponentName),
    ]);
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
          const elements = [...element.querySelectorAll(schema.fragmentTagName)];
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
    beginMorph() {
      // Snapshot each mounted fragment's anchor key from the pristine tree,
      // before morphlex starts mutating ids while matching.
      anchorKeys.clear();
      for (const element of mounted.keys()) {
        const key = fragmentKey(element);
        if (key) {
          anchorKeys.set(element, key);
        }
      }
    },
    stash(node) {
      // A subtree is about to be removed by a morph. Rescue any mounted
      // fragments inside it (including `node` itself) so they can be adopted if
      // the server re-adds an equivalent fragment elsewhere in the same morph.
      // Correlate by a stable anchor key (captured in `beginMorph`); without one
      // (or when two fragments share a key) we can't safely match, so leave them
      // to be re-created.
      for (const element of mounted.keys()) {
        if (element === node || node.contains(element)) {
          const key = anchorKeys.get(element);
          if (!key || ambiguous.has(key)) {
            continue;
          }
          if (stashed.has(key)) {
            ambiguous.add(key);
            stashed.delete(key);
          } else {
            stashed.set(key, element);
          }
        }
      }
    },
    adopt(node) {
      const fragments =
        node.tagName.toLowerCase() == schema.fragmentTagName
          ? [node]
          : [...node.querySelectorAll(schema.fragmentTagName)];
      const dones: Promise<void>[] = [];
      for (const serverFragment of fragments) {
        const key = fragmentKey(serverFragment);
        const live = key && !ambiguous.has(key) ? stashed.get(key) : undefined;
        if (live && live !== serverFragment) {
          stashed.delete(key!);
          // Put the preserved live node where the server placed its fragment,
          // then reconcile it in place with the server's new content (props).
          serverFragment.replaceWith(live);
          if (mounted.has(serverFragment)) {
            mounted.delete(serverFragment);
            cache.delete(serverFragment);
          }
          registerDestroyer(live);
          const update = mounted.get(live);
          if (update) {
            dones.push(update(serverFragment));
          }
        }
      }
      if (dones.length == 0) {
        return null;
      }
      return { count: dones.length, done: Promise.all(dones).then(() => undefined) };
    },
    finalizeMorph() {
      // Any stashed fragment that was not adopted was genuinely removed.
      const orphaned = stashed.size > 0;
      for (const element of stashed.values()) {
        mounted.delete(element);
        cache.delete(element);
      }
      stashed.clear();
      ambiguous.clear();
      anchorKeys.clear();
      if (orphaned) {
        notify();
      }
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

// A stable key used to correlate a live fragment with the server fragment that
// replaces it across a morph: the fragment's own id, else the id of its nearest
// id-bearing ancestor (e.g. a wrapping `<div id>` container).
function fragmentKey(element: Element): string | undefined {
  if (element.id) {
    return element.id;
  }
  return element.closest('[id]')?.id || undefined;
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

let fragmentCacheIdSequence = 0;
const fragmentCacheIdAttributeName = 'data-fragment-id';
const fragmentCache = new Map<string, string>();

export function resetFragmentCache() {
  fragmentCache.clear();
}

function saveFragmentCache(element: Element, fragment: DocumentFragmentLike | string) {
  let fragmentCacheId = element.getAttribute(fragmentCacheIdAttributeName);
  if (!fragmentCacheId) {
    fragmentCacheId = `fragment-${fragmentCacheIdSequence++}`;
    element.setAttribute(fragmentCacheIdAttributeName, fragmentCacheId);
  }
  fragmentCache.set(fragmentCacheId, stringifyFragment(fragment));
}

function restoreFragmentCache(element: Element) {
  const fragmentCacheId = element.getAttribute(fragmentCacheIdAttributeName);
  if (fragmentCacheId) {
    const html = fragmentCache.get(fragmentCacheId);
    if (html) {
      element.innerHTML = html;
    }
  }
}

function stringifyFragment(fragmentOrHTML: DocumentFragmentLike | string): string {
  if (typeof fragmentOrHTML == 'string') {
    return fragmentOrHTML;
  }
  if (isElement(fragmentOrHTML)) {
    return fragmentOrHTML.innerHTML;
  }
  const html: string[] = [];
  for (const node of fragmentOrHTML.childNodes) {
    if (isElement(node)) {
      html.push(node.outerHTML);
    } else if (node.nodeType == Node.TEXT_NODE && node.textContent) {
      html.push(node.textContent);
    }
  }
  return html.join(' ');
}
