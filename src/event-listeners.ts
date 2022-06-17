import type { Router } from '@remix-run/router';

import { submitForm, submitLink, getFetcherKey } from './form';
import { shouldProcessLinkClick } from './dom';

export function registerEventListeners(router: Router) {
  const unsubscribe = [
    registerListener('click', (event) => onLinkClick(router, event as MouseEvent)),
    registerListener('submit', (event) => onSubmit(router, event as SubmitEvent)),
  ];

  return () => unsubscribe.forEach((unsubscribe) => unsubscribe());
}

function registerListener(event: string, callback: (event: Event) => void) {
  document.documentElement.addEventListener(event, callback);
  return () => document.documentElement.removeEventListener(event, callback);
}

function onLinkClick(router: Router, event: MouseEvent) {
  const target = event.target as HTMLAnchorElement;

  if (target.tagName == 'A' && willFollowLink(event, target)) {
    event.preventDefault();

    const confirmMessage = target.dataset.turboConfirm;

    if (!confirmMessage || confirm(confirmMessage)) {
      submitLink(router, target, {
        replace: target.dataset.turboReplace == 'true',
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
