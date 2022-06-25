import { Controller } from '@hotwired/stimulus';

import { debounce } from '../utils';
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
          break;
        case 'change':
          this.onChange(form, target);
          break;
      }
    }
  }

  private onInput(form: HTMLFormElement, target: EventTarget) {
    if (isTextInputElement(target)) {
      debounce(
        form,
        () => {
          if (isFocused(target)) {
            form.requestSubmit();
          }
        },
        'data-debounce-interval'
      );
    }
  }

  private onChange(form: HTMLFormElement, target: EventTarget) {
    if (isFormInputElement(target)) {
      form.requestSubmit();
    }
  }
}
