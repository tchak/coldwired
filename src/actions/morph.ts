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
  fromElementOrDocument: Element | Document,
  toElementOrDocument: string | Element | Document | DocumentFragment,
  options?: MorphOptions,
) {
  options?.plugins?.forEach((plugin) => plugin.validate?.(fromElementOrDocument));

  if (fromElementOrDocument instanceof Document) {
    invariant(toElementOrDocument instanceof Document, 'Cannot morph document to element');
    morphDocument(fromElementOrDocument, toElementOrDocument, options);
  } else if (fromElementOrDocument instanceof Element) {
    invariant(!(toElementOrDocument instanceof Document), 'Cannot morph element to document');
    if (toElementOrDocument instanceof DocumentFragment) {
      morphToDocumentFragment(fromElementOrDocument, toElementOrDocument, options);
    } else if (typeof toElementOrDocument == 'string') {
      morphToDocumentFragment(
        fromElementOrDocument,
        parseHTMLFragment(toElementOrDocument, fromElementOrDocument.ownerDocument),
        options,
      );
    } else {
      morphToElement(fromElementOrDocument, toElementOrDocument, options);
    }
  }
}

function morphToDocumentFragment(
  fromElement: Element,
  toDocumentFragment: DocumentFragment,
  options?: MorphOptions,
) {
  toDocumentFragment.normalize();

  if (options?.childrenOnly) {
    const pluginRendered = options?.plugins?.some((plugin) =>
      plugin.onBeforeUpdateElement?.(fromElement, toDocumentFragment),
    );
    if (!pluginRendered) {
      const wrapper = fromElement.cloneNode(false) as Element;
      wrapper.append(toDocumentFragment);
      morphToElement(fromElement, wrapper, options);
    }
  } else {
    const [firstChild, secondChild, ...children] = [...toDocumentFragment.childNodes].filter(
      isElementOrText,
    );

    if (isElement(firstChild)) {
      if (secondChild) {
        fromElement.after(secondChild);
      }
      morphToElement(fromElement, firstChild, options);
    } else if (isElement(secondChild)) {
      fromElement.before(firstChild);
      morphToElement(fromElement, secondChild, options);
    } else {
      if (secondChild) {
        fromElement.after(secondChild);
      }
      fromElement.replaceWith(firstChild);
    }
    fromElement.after(...children);
  }
}

function morphToElement(fromElement: Element, toElement: Element, options?: MorphOptions): void {
  const [morphlexOptions, cleanup] = createMorphOptions(fromElement, toElement, options);

  if (options?.childrenOnly) {
    morphlex.morphInner(fromElement, toElement, morphlexOptions);
  } else {
    morphlex.morph(fromElement, toElement, morphlexOptions);
  }

  cleanup();
}

function morphDocument(fromDocument: Document, toDocument: Document, options?: MorphOptions): void {
  const [morphlexOptions, cleanup] = createMorphOptions(
    fromDocument.body,
    toDocument.body,
    options,
  );

  morphlex.morphDocument(fromDocument, toDocument, morphlexOptions);

  cleanup();
}

function returnFalse(): boolean {
  return false;
}

function collectForcedScope(roots: Element[]): WeakSet<Element> {
  const set = new WeakSet<Element>();
  for (const root of roots) {
    set.add(root);
    for (const descendant of root.querySelectorAll('*')) {
      set.add(descendant);
    }
  }
  return set;
}

function createMorphOptions(
  fromElement: Element,
  toElement: Element,
  options?: MorphOptions,
): [morphlex.Options, cleanup: () => void] {
  const forceAttribute = options?.forceAttribute;
  const added = new WeakSet<Element>();

  // Pre-compute force-attribute scopes once instead of calling closest() per node
  // inside onBeforeElUpdated. In the common case (no forced regions) each
  // querySelectorAll is a near-empty walk, and lookups become O(1) WeakSet checks.
  let isServerForced: (element: Element) => boolean = returnFalse;
  let isBrowserForced: (element: Element) => boolean = returnFalse;
  let cleanup = () => {};
  if (forceAttribute) {
    const serverSelector = `[${forceAttribute}="server"]`;
    const browserSelector = `[${forceAttribute}="browser"]`;

    // If an ancestor of the morph root is already forced, the whole subtree is.
    const serverRoots = toElement.closest(serverSelector)
      ? [toElement]
      : Array.from(toElement.querySelectorAll(serverSelector));
    const browserRoots = fromElement.closest(browserSelector)
      ? [fromElement]
      : Array.from(fromElement.querySelectorAll(browserSelector));

    const serverSet = collectForcedScope(serverRoots);
    const browserSet = collectForcedScope(browserRoots);

    isServerForced = (element) => serverSet.has(element);
    isBrowserForced = (element) => browserSet.has(element);

    cleanup = () => {
      const forcedElements =
        fromElement.getAttribute(forceAttribute) == 'server' ? [fromElement] : [];
      for (const element of [
        ...forcedElements,
        ...fromElement.querySelectorAll(`[${forceAttribute}="server"]`),
      ]) {
        element.removeAttribute(forceAttribute);
      }
    };
  }

  const serverForced = new Set<Element>();

  return [
    {
      preserveChanges: true,
      beforeAttributeUpdated(element, attributeName) {
        const force = serverForced.has(element);
        const metadata = options?.metadata?.get(element);

        if (!force && isBrowserForced(element)) {
          return false;
        }

        if (force) {
          if (
            attributeName == 'value' ||
            attributeName == 'selected' ||
            attributeName == 'checked'
          ) {
            return true;
          }
        }

        if (!force && metadata) {
          const oldValue = metadata.attributes[attributeName];

          if (oldValue === null || typeof oldValue == 'string') {
            return false;
          }
        }

        return true;
      },
      beforeNodeVisited(fromNode, toNode) {
        if (isElement(fromNode) && isElement(toNode)) {
          const fromElement = fromNode;
          const toElement = toNode;
          const pluginRendered = options?.plugins?.some((plugin) =>
            plugin.onBeforeUpdateElement?.(fromElement, toElement),
          );
          if (pluginRendered) {
            return false;
          }

          const force = isServerForced(toElement);
          const metadata = options?.metadata?.get(fromElement);

          if (force) {
            serverForced.add(fromElement);

            // morphlex's preserveChanges blocks it from writing .value/.checked/.selected
            // properties unconditionally. For server-forced elements we want the server's
            // values to win, so sync the property on `from` to match `to` here, before
            // morphlex's #visitAttributes runs.
            if (isInputElement(fromElement) && isInputElement(toElement)) {
              if (fromElement.type == 'checkbox' || fromElement.type == 'radio') {
                fromElement.checked = toElement.checked;
              } else {
                fromElement.value = toElement.value;
              }
            } else if (isFormOptionElement(fromElement) && isFormOptionElement(toElement)) {
              fromElement.selected = toElement.selected;
            } else if (isFormInputElement(fromElement) && isFormInputElement(toElement)) {
              fromElement.value = toElement.value;
            }

            if (metadata) {
              if (isFormInputElement(fromElement) || isFormOptionElement(fromElement)) {
                metadata.touched = false;
              }
            }
          }

          if (!force && isBrowserForced(fromElement)) {
            return false;
          }

          if (!force && metadata) {
            toElement.classList.add(...metadata.addedClassNames);
            toElement.classList.remove(...metadata.removedClassNames);
          }
        }

        return true;
      },
      beforeNodeAdded(parent, node) {
        if (isElement(node) && isElement(parent)) {
          if (!added.has(parent)) {
            options?.plugins?.forEach((plugin) => plugin.onCreateElement?.(node));
          }
          added.add(node);
        }
        return true;
      },
      beforeNodeRemoved(node) {
        if (isElement(node)) {
          options?.plugins?.forEach((plugin) => plugin.onBeforeDestroyElement?.(node));
          focusNextElement(node, options);
        }
        return true;
      },
    },
    cleanup,
  ];
}
