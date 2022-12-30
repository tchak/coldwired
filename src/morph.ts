import morphdom from 'morphdom';

import { getMetadata } from './metadata';
import { isFormInputElement, isLinkElement, isFormOptionElement, isInputElement } from './dom';

export type MorphOptions = {
  childrenOnly?: boolean;
  forceAttribute?: string;
};

export function morphElement(
  fromElement: Element,
  toElement: Element | DocumentFragment,
  options?: MorphOptions
): void {
  const forceAttribute = options?.forceAttribute;

  morphdom(fromElement, toElement, {
    childrenOnly: options?.childrenOnly,
    onBeforeElUpdated(fromElement: Element, toElement: Element) {
      const force = forceAttribute ? !!toElement.closest(`[${forceAttribute}]`) : false;
      const metadata = getMetadata(fromElement);

      if (force && metadata) {
        if (isFormInputElement(fromElement) || isFormOptionElement(fromElement)) {
          metadata.touched = false;
        }
      }

      if (fromElement.isEqualNode(toElement)) {
        return false;
      }

      if (!force && metadata) {
        toElement.classList.add(...metadata.addedClassNames);
        toElement.classList.remove(...metadata.removedClassNames);

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
  });
}

export function morphDocument(toDocumentElement: Document, options?: MorphOptions): void {
  if (toDocumentElement.head) {
    morphHead(document.head, toDocumentElement.head);
  }
  morphElement(document.body, toDocumentElement.body, options);
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
