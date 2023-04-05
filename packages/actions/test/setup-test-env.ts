import { installGlobals } from '@remix-run/node';
import 'intersection-observer';
import * as Turbo from '@hotwired/turbo';

Turbo.session.drive = false;
Turbo.start();
installGlobals();

class PatchedFormData extends FormData {
  constructor(form?: HTMLFormElement) {
    super();

    if (form) {
      for (const element of form.elements) {
        if (isSelectElement(element)) {
          for (const option of element.options) {
            if (option.selected) {
              this.append(element.name, option.value);
            }
          }
        } else if (
          isInputElement(element) &&
          (element.checked || !['radio', 'checkbox'].includes(element.type)) &&
          element.name
        ) {
          this.append(element.name, element.value);
        }
      }
    }
  }
}

function isSelectElement(element: Element): element is HTMLSelectElement {
  return element.tagName == 'SELECT';
}

function isInputElement(element: Element): element is HTMLInputElement {
  return element.tagName == 'INPUT' || element.tagName == 'TEXTAREA';
}

window.FormData = PatchedFormData;
