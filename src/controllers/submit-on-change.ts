import { Controller } from '@hotwired/stimulus';
import justDebounce from 'just-debounce-it';

import { willSubmitForm } from './turbo';
import { isFormInputElement, isTextInputElement } from '../dom';

export class SubmitOnChangeController extends Controller {
  connect() {
    this.element.addEventListener('input', onInput);
    this.element.addEventListener('change', onChange);
  }

  disconnect() {
    this.element.removeEventListener('input', onInput);
    this.element.removeEventListener('change', onChange);
  }
}

function onInput(event: Event) {
  const target = (event.composedPath && event.composedPath()[0]) || event.target;
  const form = isFormInputElement(target) ? target.form : null;

  if (form && isTextInputElement(target) && willSubmitForm(form, target)) {
    debounce(form, () => form.requestSubmit());
  }
}

function onChange(event: Event) {
  const target = (event.composedPath && event.composedPath()[0]) || event.target;
  const form = isFormInputElement(target) ? target.form : null;

  if (form && isFormInputElement(target) && willSubmitForm(form, target)) {
    form.requestSubmit();
  }
}

const DEFAULT_DEBOUNCE = 500;

function debounce(target: HTMLElement, callback: () => void) {
  let run = debounced.get(target);
  if (!run) {
    const wait = parseIntOr(target.dataset.debounceWait, DEFAULT_DEBOUNCE);
    if (wait == 0) {
      run = callback;
    } else {
      run = justDebounce(callback, wait);
    }
    debounced.set(target, run);
  }
  run();
}
const debounced = new WeakMap<HTMLElement, () => void>();

function parseIntOr(value: string | undefined, defaultValue: number) {
  return value ? parseInt(value) : defaultValue;
}
