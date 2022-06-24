import { Controller } from '@hotwired/stimulus';
import justDebounce from 'just-debounce-it';

import { isFormInputElement, isTextInputElement, isFocused } from '../dom';

export class SubmitOnChangeController extends Controller implements EventListenerObject {
  connect() {
    this.element.addEventListener('input', this);
    this.element.addEventListener('change', this);
  }

  disconnect() {
    this.element.removeEventListener('input', this);
    this.element.removeEventListener('change', this);
  }

  handleEvent(event: Event): void {
    const target = (event.composedPath && event.composedPath()[0]) || event.target;
    const form = isFormInputElement(target) ? target.form : null;

    if (form) {
      switch (event.type) {
        case 'input':
          this.onInput(form, target);
        case 'change':
          this.onChange(form, target);
      }
    }
  }

  private onInput(form: HTMLFormElement, target: EventTarget) {
    if (isTextInputElement(target)) {
      debounce(form, () => {
        if (isFocused(target)) {
          form.requestSubmit();
        }
      });
    }
  }

  private onChange(form: HTMLFormElement, target: EventTarget) {
    if (isFormInputElement(target)) {
      form.requestSubmit();
    }
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
