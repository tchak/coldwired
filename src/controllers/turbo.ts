import { Controller } from '@hotwired/stimulus';
import type { Router } from '@remix-run/router';

import { submitForm, followOrSubmitLink, getFetcherKey, touchFormElement } from '../form';
import { shouldProcessLinkClick } from '../dom';
import { getRouter } from '../stimulus';

export class TurboController extends Controller {
  #onClick?: (event: Event) => void;
  #onSubmit?: (event: Event) => void;
  #onInput?: (event: Event) => void;

  connect() {
    const router = this.router;
    this.#onClick = (event) => onLinkClick(router, event as MouseEvent);
    this.#onSubmit = (event) => onSubmit(router, event as SubmitEvent);
    this.#onInput = (event) => onInput(event as InputEvent);

    this.element.addEventListener('click', this.#onClick);
    this.element.addEventListener('submit', this.#onSubmit);
    this.element.addEventListener('input', this.#onInput);
  }

  disconnect() {
    if (this.#onClick) {
      this.element.removeEventListener('click', this.#onClick);
    }
    if (this.#onSubmit) {
      this.element.removeEventListener('submit', this.#onSubmit);
    }
    if (this.#onInput) {
      this.element.removeEventListener('input', this.#onInput);
    }
  }

  private get router() {
    return getRouter(this.application);
  }
}

function onLinkClick(router: Router, event: MouseEvent) {
  const target = (event.composedPath && event.composedPath()[0]) || event.target;
  const link = findLinkFromClickTarget(target);

  if (link && willFollowLink(event, link)) {
    event.preventDefault();

    const confirmMessage = link.dataset.turboConfirm;

    if (!confirmMessage || confirm(confirmMessage)) {
      followOrSubmitLink(router, link, {
        replace: link.dataset.turboReplace == 'true',
      });
    }
  }
}

function onSubmit(router: Router, event: SubmitEvent) {
  const submitter = event.submitter as HTMLInputElement | undefined;
  const form = submitter?.form || (event.target as HTMLFormElement);

  if (form.tagName == 'FORM' && willSubmitForm(form, submitter)) {
    event.preventDefault();

    const confirmMessage = submitter?.dataset.turboConfirm ?? form.dataset.turboConfirm;

    if (!confirmMessage || confirm(confirmMessage)) {
      submitForm(router, form, {
        submitter,
        fetcherKey: getFetcherKey(form),
        replace: true,
      });
    }
  }
}

function onInput(event: InputEvent) {
  const target = (event.composedPath && event.composedPath()[0]) || event.target;

  touchFormElement(target as HTMLElement);
}

function willFollowLink(event: MouseEvent, link: HTMLAnchorElement) {
  return isTurboEnabled(link) && shouldProcessLinkClick(event, link.target);
}

function isTurboEnabled(element: HTMLElement) {
  const container = element.closest<HTMLElement>(`[data-turbo]`);
  if (container) {
    return container.dataset.turbo != 'false';
  }
  return element.dataset.turbo != 'false';
}

export function willSubmitForm(
  form: HTMLFormElement,
  input?: HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
) {
  if (input) {
    return isTurboEnabled(input) && isTurboEnabled(form);
  }
  return isTurboEnabled(form);
}

function findLinkFromClickTarget(target: EventTarget | null): HTMLAnchorElement | null {
  if (target instanceof Element) {
    return target.closest<HTMLAnchorElement>('a[href]:not([target^=_]):not([download])');
  }
  return null;
}
