import {
  debounce,
  parseIntWithDefault,
  isFormInputElement,
  matchInputElement,
} from '@coldwired/utils';
import { Directive } from '../directive-controller';

const DEFAULT_INTERVAL = 500; // 0.5 second

export class SubmitOnChange extends Directive implements EventListenerObject {
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
    matchInputElement(target, {
      inputable: () => {
        debounce(form, () => form.requestSubmit(), this.interval);
      },
    });
  }

  private onChange(form: HTMLFormElement, target: EventTarget) {
    matchInputElement(target, {
      changeable: () => {
        form.requestSubmit();
      },
    });
  }

  private get interval() {
    const value = this.element.getAttribute(this.schema.debounceIntervalAttribute);
    return parseIntWithDefault(value, DEFAULT_INTERVAL);
  }
}
