import type { Router, FormMethod } from '@remix-run/router';
import invariant from 'tiny-invariant';
import { nanoid } from 'nanoid';

import { getFormSubmissionInfo } from './dom';

type SubmitOptions = {
  /** */
  submitter?: HTMLInputElement;

  /** */
  fetcherKey?: string;

  /**
   * Set `true` to replace the current entry in the browser's history stack
   * instead of creating a new one (i.e. stay on "the same page"). Defaults
   * to `false`.
   */
  replace?: boolean;
};

export function submitForm(
  router: Router,
  form: HTMLFormElement,
  { submitter, fetcherKey, replace = false }: SubmitOptions = {}
) {
  const { url, method, formData } = getFormSubmissionInfo(form, location.pathname, { submitter });
  const options = { formMethod: method, formData, replace };

  if (fetcherKey) {
    const match = router.state.matches.at(-1);
    invariant(match, 'No route matches the current URL');

    router.fetch(fetcherKey, match.route.id, relativeURL(url), options);
  } else {
    router.navigate(relativeURL(url), options);
  }
}

export function followOrSubmitLink(
  router: Router,
  link: HTMLAnchorElement,
  { replace }: SubmitOptions = {}
) {
  const linkURL = expandURL(link.getAttribute('href') || '');
  const turboMethod = (link.dataset.turboMethod ?? link.dataset.method)?.toLowerCase();

  if (turboMethod && turboMethod !== 'get') {
    const { url, method, formData } = getFormSubmissionInfo(
      linkURL.searchParams,
      location.pathname,
      { method: turboMethod as FormMethod, action: linkURL.pathname }
    );

    router.navigate(url.pathname, { formMethod: method, formData, replace });
  } else {
    router.navigate(relativeURL(linkURL), { replace });
  }
}

type Locatable = URL | string;

function expandURL(locatable: Locatable) {
  return new URL(locatable.toString(), document.baseURI);
}

function relativeURL(url: URL) {
  return `${url.pathname}${url.search}`;
}

function buildSelector(tags: string[], modifiers: string[], flag: string) {
  const selectors: string[] = [];

  for (const tag of tags) {
    for (const modifier of modifiers) {
      selectors.push(`${tag}[${modifier}]:${flag}`);
    }
  }

  return selectors.join(', ');
}

// Form input elements disabled during form submission
const formDisableSelector = buildSelector(
  ['input', 'button', 'textarea'],
  ['data-disable', 'data-disable-with'],
  'enabled'
);

// Form input elements re-enabled after form submission
const formEnableSelector = buildSelector(
  ['input', 'button', 'textarea'],
  ['data-disable', 'data-disable-with'],
  'disabled'
);

export function disableForm(form: HTMLFormElement) {
  for (const element of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    formDisableSelector
  )) {
    const disableWith = element.dataset.disableWith;
    if (disableWith) {
      if (element.tagName == 'BUTTON') {
        element.dataset.originalText = element.innerHTML;
        element.innerHTML = disableWith;
      } else {
        element.dataset.originalText = element.value;
        element.value = disableWith;
      }
    }
    element.disabled = true;
  }
}

export function enableForm(form: HTMLFormElement) {
  for (const element of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    formEnableSelector
  )) {
    const originalText = element.dataset.originalText;
    if (originalText) {
      element.removeAttribute('data-original-text');

      if (element.tagName == 'BUTTON') {
        element.innerHTML = originalText;
      } else {
        element.value = originalText;
      }
    }
    element.disabled = false;
  }
}

export function getFetcherKey(form: HTMLFormElement) {
  return fetcherKeys.get(form);
}

export function getFetcherForm(fetcherKey: string) {
  const form = forms.get(fetcherKey);
  invariant(form, `No form found for fetcher key: ${fetcherKey}`);
  return form;
}

export function registerFetcher(form: HTMLFormElement) {
  const fetcherKey = generateFetcherKey(form);
  fetcherKeys.set(form, fetcherKey);
  forms.set(fetcherKey, form);
}

export function unregisterFetcher(router: Router, form: HTMLFormElement) {
  const fetcherKey = fetcherKeys.get(form);
  if (fetcherKey) {
    forms.delete(fetcherKey);
    fetcherKeys.delete(form);
    router.deleteFetcher(fetcherKey);
  }
}

function generateFetcherKey(element: HTMLElement) {
  return element.id || nanoid();
}

const forms = new Map<string, HTMLFormElement>();
const fetcherKeys = new WeakMap<HTMLFormElement, string>();
