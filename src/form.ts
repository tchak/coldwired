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
  const match = router.state.matches.at(-1);

  invariant(match, 'No route matches the current URL');

  if (fetcherKey) {
    router.fetch(fetcherKey, match.route.id, url.pathname, options);
  } else {
    router.navigate(url.pathname, options);
  }
}

export function submitLink(
  router: Router,
  anchor: HTMLAnchorElement,
  { replace }: SubmitOptions = {}
) {
  const anchorURL = new URL(anchor.getAttribute('href') ?? '', document.baseURI);
  const turboMethod = anchor.dataset.turboMethod?.toLowerCase();

  if (turboMethod && turboMethod !== 'get') {
    const { url, method, formData } = getFormSubmissionInfo(
      anchorURL.searchParams,
      location.pathname,
      { method: turboMethod as FormMethod, action: anchorURL.pathname }
    );

    router.navigate(url, { formMethod: method, formData, replace });
  } else {
    router.navigate(anchorURL.pathname, { replace });
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
