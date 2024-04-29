import morphdom from 'morphdom';
import invariant from 'tiny-invariant';

import {
  isHTMLElement,
  isFormInputElement,
  isLinkElement,
  isFormOptionElement,
  isInputElement,
  parseHTMLFragment,
  isElementOrText,
  isElement,
  focusNextElement,
  type FocusNextOptions,
} from '@coldwired/utils';

import { Metadata } from './metadata';
import { Plugin } from './plugin';

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
      const wrapper = toDocumentFragment.ownerDocument.createElement('div');
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
  const forceAttribute = options?.forceAttribute;

  morphdom(fromElement, toElement, {
    childrenOnly: options?.childrenOnly,
    onBeforeElUpdated(fromElement, toElement) {
      const pluginRendered = options?.plugins?.some((plugin) =>
        plugin.onBeforeUpdateElement?.(fromElement, toElement),
      );
      if (pluginRendered) {
        return false;
      }

      const force = forceAttribute ? !!toElement.closest(`[${forceAttribute}="server"]`) : false;
      const metadata = options?.metadata?.get(fromElement);

      if (force && metadata) {
        if (isFormInputElement(fromElement) || isFormOptionElement(fromElement)) {
          metadata.touched = false;
        }
      }

      if (fromElement.isEqualNode(toElement)) {
        return false;
      }

      if (!force && forceAttribute) {
        const permanent = !!fromElement.closest(`[${forceAttribute}="browser"]`);
        if (permanent) {
          return false;
        }
      }

      if (!force && metadata) {
        toElement.classList.add(...metadata.addedClassNames);
        toElement.classList.remove(...metadata.removedClassNames);

        for (const [name, value] of Object.entries(metadata.attributes)) {
          if (value == null) {
            toElement.removeAttribute(name);
          } else if (name == 'style') {
            if (isHTMLElement(toElement)) {
              toElement.style.cssText = value;
            }
          } else {
            toElement.setAttribute(name, value);
          }
        }

        if (metadata.touched) {
          if (
            isInputElement(fromElement) &&
            (fromElement.type == 'checkbox' || fromElement.type == 'radio')
          ) {
            Object.assign(toElement, { checked: fromElement.checked });
          } else if (isFormOptionElement(fromElement)) {
            Object.assign(toElement, { selected: fromElement.selected });
          } else if (isFormInputElement(fromElement)) {
            Object.assign(toElement, { value: fromElement.value });
          }
        }
      }

      return true;
    },
    onBeforeNodeDiscarded(node) {
      if (isElement(node)) {
        options?.plugins?.forEach((plugin) => plugin.onBeforeDestroyElement?.(node));
        focusNextElement(node, options);
      }
      return true;
    },
    onNodeAdded(node) {
      if (isElement(node)) {
        options?.plugins?.forEach((plugin) => plugin.onCreateElement?.(node));
      }
      return node;
    },
  });

  if (forceAttribute) {
    const forcedElements =
      fromElement.getAttribute(forceAttribute) == 'server' ? [fromElement] : [];
    for (const element of [
      ...forcedElements,
      ...fromElement.querySelectorAll(`[${forceAttribute}="server"]`),
    ]) {
      element.removeAttribute(forceAttribute);
    }
  }
}

function morphDocument(fromDocument: Document, toDocument: Document, options?: MorphOptions): void {
  if (toDocument.head) {
    morphHead(fromDocument.head, fromDocument.adoptNode(toDocument.head));
  }
  morphToElement(fromDocument.body, fromDocument.adoptNode(toDocument.body), options);
}

function morphHead(fromHeadElement: HTMLHeadElement, toHeadElement: HTMLHeadElement) {
  morphdom(fromHeadElement, toHeadElement, {
    childrenOnly: true,
    onBeforeElUpdated(fromElement, toElement) {
      if (fromElement.isEqualNode(toElement)) {
        return false;
      }
      return true;
    },
    onBeforeNodeDiscarded(node) {
      if (isLinkElement(node)) {
        return false;
      }
      return true;
    },
  });
}
