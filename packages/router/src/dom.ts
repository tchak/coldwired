import type { FormEncType, FormMethod } from '@remix-run/router';
import invariant from 'tiny-invariant';

import { isFormElement, isButtonElement, isInputElement, isElement } from '@coldwired/utils';

export type HTMLSubmitterElement = HTMLInputElement | HTMLButtonElement;

export function findLinkFromClickTarget(target: EventTarget | null): HTMLAnchorElement | null {
  if (target instanceof Element) {
    return target.closest<HTMLAnchorElement>('a[href]:not([target^=_]):not([download])');
  }
  return null;
}

type LimitedMouseEvent = Pick<MouseEvent, 'button' | 'metaKey' | 'altKey' | 'ctrlKey' | 'shiftKey'>;

function isModifiedEvent(event: LimitedMouseEvent) {
  return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}

export function shouldProcessLinkClick(event: LimitedMouseEvent, target?: string) {
  return (
    event.button === 0 && // Ignore everything but left clicks
    (!target || target === '_self') && // Let browser handle "target=_blank" etc.
    !isModifiedEvent(event) // Ignore clicks with modifier keys
  );
}

type SubmitOptions = {
  /**
   * The HTTP method used to submit the form. Overrides `<form method>`.
   * Defaults to "GET".
   */
  method?: FormMethod;

  /**
   * The action URL path used to submit the form. Overrides `<form action>`.
   * Defaults to the path of the current route.
   *
   * Note: It is assumed the path is already resolved.
   */
  action?: string;

  /**
   * The action URL used to submit the form. Overrides `<form encType>`.
   * Defaults to "application/x-www-form-urlencoded".
   */
  encType?: FormEncType;

  /**
   */
  submitter?: HTMLSubmitterElement;

  httpMethodOverride?: boolean;
};

const defaultMethod: FormMethod = 'get';
const defaultEncType: FormEncType = 'application/x-www-form-urlencoded';

export function getFormSubmissionInfo(
  target:
    | HTMLFormElement
    | HTMLButtonElement
    | HTMLInputElement
    | FormData
    | URLSearchParams
    | { [name: string]: string }
    | null,
  defaultAction: string,
  options: SubmitOptions
): {
  url: URL;
  method: FormMethod;
  encType: FormEncType;
  formData: FormData;
} {
  let method: FormMethod;
  let action: string;
  let encType: FormEncType;
  let formData: FormData;

  if (isFormElement(target)) {
    const submitter = options.submitter;

    method = (options.method || target.getAttribute('method') || defaultMethod) as FormMethod;
    action = options.action || target.getAttribute('action') || defaultAction;
    encType = (options.encType || target.getAttribute('enctype') || defaultEncType) as FormEncType;

    formData = new FormData(target);

    if (submitter && submitter.name) {
      formData.append(submitter.name, submitter.value);
    }
  } else if (
    isButtonElement(target) ||
    (isInputElement(target) && (target.type == 'submit' || target.type == 'image'))
  ) {
    const form = target.form;

    invariant(form, 'Cannot submit a <button> or <input type="submit"> without a <form>');

    // <button>/<input type="submit"> may override attributes of <form>

    method = (options.method ||
      target.getAttribute('formmethod') ||
      form.getAttribute('method') ||
      defaultMethod) as FormMethod;
    action =
      options.action ||
      target.getAttribute('formaction') ||
      form.getAttribute('action') ||
      defaultAction;
    encType = (options.encType ||
      target.getAttribute('formenctype') ||
      form.getAttribute('enctype') ||
      defaultEncType) as FormEncType;

    formData = new FormData(form);

    // Include name + value from a <button>
    if (target.name) {
      formData.set(target.name, target.value);
    }
  } else if (isElement(target)) {
    invariant(
      false,
      'Cannot submit element that is not <form>, <button>, or <input type="submit|image">'
    );
  } else {
    method = options.method || defaultMethod;
    action = options.action || defaultAction;
    encType = options.encType || defaultEncType;

    if (target instanceof FormData) {
      formData = target;
    } else {
      formData = new FormData();

      if (target instanceof URLSearchParams) {
        target.forEach((value, name) => formData.append(name, value));
      } else if (target != null) {
        for (const [name, value] of Object.entries(target)) {
          formData.append(name, value);
        }
      }
    }
  }

  const { protocol, host } = window.location;
  const url = new URL(action, `${protocol}//${host}`);

  if (options.httpMethodOverride && !(method == 'get' || method == 'post')) {
    formData.append('_method', method);
    method = 'post';
  }

  return { url, method, encType, formData };
}
