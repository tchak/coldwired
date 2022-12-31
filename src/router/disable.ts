import { isButtonElement, isFocused } from '../utils';

type Metadata = { content?: string; focused: boolean };

export function disableFormInputs(
  container: Element,
  {
    disableAttribute,
    disableWithAttribute,
  }: { disableAttribute: string; disableWithAttribute: string }
) {
  for (const element of container.querySelectorAll<
    HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement
  >(formInputSelectors('enabled', [disableAttribute, disableWithAttribute]))) {
    const disableWith = element.getAttribute(disableWithAttribute);
    const metadata: Metadata = { focused: false };

    if (disableWith) {
      if (isButtonElement(element)) {
        metadata.content = element.innerHTML;
        element.innerHTML = disableWith;
      } else if (['submit', 'reset', 'button'].includes(element.type)) {
        metadata.content = element.value;
        element.value = disableWith;
      }
    }

    metadata.focused = isFocused(element);
    metadataRegistry.set(element, metadata);
    element.disabled = true;
  }
}

export function enableFormInputs(
  container: Element,
  {
    disableAttribute,
    disableWithAttribute,
  }: { disableAttribute: string; disableWithAttribute: string }
) {
  for (const element of container.querySelectorAll<
    HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement
  >(formInputSelectors('disabled', [disableAttribute, disableWithAttribute]))) {
    const { content, focused } = metadataRegistry.get(element) ?? { focused: false };
    if (content) {
      if (isButtonElement(element)) {
        element.innerHTML = content;
      } else if (['submit', 'reset', 'button'].includes(element.type)) {
        element.value = content;
      }
    }
    element.disabled = false;
    if (isFocused(document.body) && focused) {
      element.focus();
    }
    metadataRegistry.delete(element);
  }
}

function formInputSelectors(pseudoClass: 'enabled' | 'disabled', attributes: string[]) {
  const selectors: string[] = [];

  for (const tag of ['input', 'button', 'textarea', 'select']) {
    for (const attribute of attributes) {
      selectors.push(`${tag}[${attribute}]:${pseudoClass}`);
    }
  }

  return selectors.join(', ');
}

const metadataRegistry = new WeakMap<Element, Metadata>();
