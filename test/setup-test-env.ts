import { installGlobals } from '@remix-run/node/globals';
import { fireEvent } from '@testing-library/dom';

installGlobals();

window.location.href = 'http://localhost';

(function (prototype) {
  if (typeof prototype.requestSubmit == 'function') return;

  prototype.requestSubmit = function (submitter: HTMLInputElement) {
    const event = new CustomEvent('submit', { bubbles: true });
    if (submitter) {
      Object.assign(event, { submitter });
    }
    fireEvent(this, event);
  };
})(HTMLFormElement.prototype);
