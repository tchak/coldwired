import * as morphlex from 'morphlex';
import invariant from 'tiny-invariant';

import {
  focusNextElement,
  isElement,
  isElementOrText,
  isFormInputElement,
  isFormOptionElement,
  isInputElement,
  parseHTMLFragment,
  type FocusNextOptions,
} from '../utils';

import { Metadata } from './metadata';
import type { Plugin } from './plugin';

type MorphOptions = FocusNextOptions & {
  childrenOnly?: boolean;
  forceAttribute?: string;
  metadata?: Metadata;
  plugins?: Plugin[];
};

export function morph(
  from: Element | Document,
  to: string | Element | Document | DocumentFragment,
  options?: MorphOptions,
) {
  options?.plugins?.forEach((plugin) => plugin.validate?.(from));

  if (from instanceof Document) {
    invariant(to instanceof Document, 'Cannot morph document to element');
    morphDocument(from, to, options);
    return;
  }

  invariant(!(to instanceof Document), 'Cannot morph element to document');

  if (to instanceof DocumentFragment) {
    morphToDocumentFragment(from, to, options);
  } else if (typeof to == 'string') {
    morphToDocumentFragment(from, parseHTMLFragment(to, from.ownerDocument), options);
  } else {
    morphToElement(from, to, options);
  }
}

function morphToDocumentFragment(
  fromElement: Element,
  toFragment: DocumentFragment,
  options?: MorphOptions,
) {
  toFragment.normalize();

  if (options?.childrenOnly) {
    const pluginRendered = options.plugins?.some((plugin) =>
      plugin.onBeforeUpdateElement?.(fromElement, toFragment),
    );
    if (pluginRendered) return;

    // morphlex.morphInner needs `to` to be an element with a matching tag.
    // Wrap the fragment in a shallow clone of fromElement.
    const wrapper = fromElement.cloneNode(false) as Element;
    wrapper.append(toFragment);
    morphToElement(fromElement, wrapper, options);
    return;
  }

  // The fragment may contain leading/trailing text and multiple top-level
  // elements. Morph fromElement into the first element child and place the
  // surrounding nodes around it, preserving order.
  const nodes = [...toFragment.childNodes].filter(isElementOrText);
  const pivot = nodes.findIndex(isElement);

  if (pivot == -1) {
    fromElement.replaceWith(...nodes);
    return;
  }

  fromElement.before(...nodes.slice(0, pivot));
  fromElement.after(...nodes.slice(pivot + 1));
  morphToElement(fromElement, nodes[pivot] as Element, options);
}

function morphToElement(fromElement: Element, toElement: Element, options?: MorphOptions): void {
  const morphlexOptions = createMorphlexOptions(fromElement, toElement, options);

  if (options?.childrenOnly) {
    morphlex.morphInner(fromElement, toElement, morphlexOptions);
  } else {
    morphlex.morph(fromElement, toElement, morphlexOptions);
  }

  cleanupForceMarkers(fromElement, options?.forceAttribute);
}

function morphDocument(fromDocument: Document, toDocument: Document, options?: MorphOptions): void {
  const morphlexOptions = createMorphlexOptions(fromDocument.body, toDocument.body, options);
  morphlex.morphDocument(fromDocument, toDocument, morphlexOptions);
  cleanupForceMarkers(fromDocument.body, options?.forceAttribute);
}

// ---------------------------------------------------------------------------
// Force-attribute scope
//
// `data-turbo-force="server"` on a `to` element (or its ancestor) means the
// server's HTML wins for that subtree, ignoring user/metadata preservation.
// `data-turbo-force="browser"` on a `from` element means the existing DOM
// wins and morphlex should not touch the subtree.
//
// Pre-computing both scopes once turns per-node `closest()` calls into O(1)
// WeakSet lookups; in the common case (no forced regions) we skip the work
// entirely via NEVER_FORCED.
// ---------------------------------------------------------------------------

type ForceScope = {
  isServerForced: (element: Element) => boolean;
  isBrowserForced: (element: Element) => boolean;
};

const NEVER_FORCED: ForceScope = {
  isServerForced: () => false,
  isBrowserForced: () => false,
};

function buildForceScope(
  fromElement: Element,
  toElement: Element,
  forceAttribute: string | undefined,
): ForceScope {
  if (!forceAttribute) return NEVER_FORCED;

  const serverSet = collectScope(rootsForForce(toElement, `[${forceAttribute}="server"]`));
  const browserSet = collectScope(rootsForForce(fromElement, `[${forceAttribute}="browser"]`));

  return {
    isServerForced: (element) => serverSet.has(element),
    isBrowserForced: (element) => browserSet.has(element),
  };
}

// If an ancestor of the morph root already carries the marker, the entire
// subtree is forced. Otherwise we collect every descendant carrying it.
function rootsForForce(root: Element, selector: string): Element[] {
  return root.closest(selector) ? [root] : Array.from(root.querySelectorAll(selector));
}

function collectScope(roots: Element[]): WeakSet<Element> {
  const set = new WeakSet<Element>();
  for (const root of roots) {
    set.add(root);
    for (const descendant of root.querySelectorAll('*')) {
      set.add(descendant);
    }
  }
  return set;
}

// After morphing, remove the `data-turbo-force="server"` markers that the
// server sent — they were a one-shot directive, not a state to preserve.
function cleanupForceMarkers(root: Element, forceAttribute: string | undefined): void {
  if (!forceAttribute) return;
  if (root.getAttribute(forceAttribute) == 'server') {
    root.removeAttribute(forceAttribute);
  }
  for (const element of root.querySelectorAll(`[${forceAttribute}="server"]`)) {
    element.removeAttribute(forceAttribute);
  }
}

// ---------------------------------------------------------------------------
// Server-forced form value sync
//
// morphlex's `preserveChanges: true` unconditionally blocks writes to
// `from.value` / `.checked` / `.selected`. For server-forced elements the
// server must win, so we sync the property here — *before* morphlex's
// attribute pass — so its `from.value !== value` short-circuit kicks in
// and the property stays where we set it.
// ---------------------------------------------------------------------------

function syncServerForcedFormState(fromElement: Element, toElement: Element): void {
  if (isInputElement(fromElement) && isInputElement(toElement)) {
    if (fromElement.type == 'checkbox' || fromElement.type == 'radio') {
      fromElement.checked = toElement.checked;
    } else {
      fromElement.value = toElement.value;
    }
  } else if (isFormOptionElement(fromElement) && isFormOptionElement(toElement)) {
    fromElement.selected = toElement.selected;
  } else if (isFormInputElement(fromElement) && isFormInputElement(toElement)) {
    // textarea / select
    fromElement.value = toElement.value;
  }
}

// ---------------------------------------------------------------------------
// morphlex options
// ---------------------------------------------------------------------------

function createMorphlexOptions(
  fromElement: Element,
  toElement: Element,
  options?: MorphOptions,
): morphlex.Options {
  const force = buildForceScope(fromElement, toElement, options?.forceAttribute);
  const metadata = options?.metadata;
  const plugins = options?.plugins;

  // `from` elements whose paired `to` was server-forced. Populated in
  // beforeNodeVisited (which sees both sides) so beforeAttributeUpdated
  // (which only sees `from`) can still tell.
  const serverForcedFrom = new WeakSet<Element>();
  // Elements just inserted by morphlex. Used to suppress duplicate
  // onCreateElement notifications for descendants of a freshly-added subtree.
  const addedRoots = new WeakSet<Element>();

  return {
    preserveChanges: true,

    beforeAttributeUpdated(element, attributeName) {
      if (serverForcedFrom.has(element)) return true;
      if (force.isBrowserForced(element)) return false;

      const fromMeta = metadata?.get(element);
      if (fromMeta) {
        // The user has already touched this attribute (recorded by the
        // attribute observer); preserve their version.
        const recordedValue = fromMeta.attributes[attributeName];
        if (recordedValue === null || typeof recordedValue == 'string') {
          return false;
        }
      }
      return true;
    },

    beforeNodeVisited(fromNode, toNode) {
      if (!isElement(fromNode) || !isElement(toNode)) return true;

      const pluginRendered = plugins?.some((plugin) =>
        plugin.onBeforeUpdateElement?.(fromNode, toNode),
      );
      if (pluginRendered) return false;

      if (force.isServerForced(toNode)) {
        serverForcedFrom.add(fromNode);
        syncServerForcedFormState(fromNode, toNode);
        const fromMeta = metadata?.get(fromNode);
        if (fromMeta && (isFormInputElement(fromNode) || isFormOptionElement(fromNode))) {
          fromMeta.touched = false;
        }
        return true;
      }

      if (force.isBrowserForced(fromNode)) return false;

      // Re-apply user-added/removed classes to the new template so the
      // class-attribute pass sees the merged result and leaves it alone.
      const fromMeta = metadata?.get(fromNode);
      if (fromMeta) {
        toNode.classList.add(...fromMeta.addedClassNames);
        toNode.classList.remove(...fromMeta.removedClassNames);
      }
      return true;
    },

    beforeNodeAdded(parent, node) {
      if (isElement(node) && isElement(parent)) {
        if (!addedRoots.has(parent)) {
          plugins?.forEach((plugin) => plugin.onCreateElement?.(node));
        }
        addedRoots.add(node);
      }
      return true;
    },

    beforeNodeRemoved(node) {
      if (isElement(node)) {
        plugins?.forEach((plugin) => plugin.onBeforeDestroyElement?.(node));
        focusNextElement(node, options);
      }
      return true;
    },
  };
}
