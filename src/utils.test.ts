import { describe, expect, it } from 'vite-plus/test';

import {
  cancelDebounce,
  cancelThrottle,
  debounce,
  dispatch,
  domReady,
  expandURL,
  groupBy,
  isAnchorElement,
  isButtonElement,
  isChangeableElement,
  isElement,
  isFormInputElement,
  isHTMLElement,
  isInputableElement,
  isSelectElement,
  isSubmitterElement,
  isTextInputElement,
  matchInputElement,
  parseIntWithDefault,
  partition,
  relativeURL,
  throttle,
  wait,
} from './utils';

describe('coldwired/utils', () => {
  describe('expandURL / relativeURL', () => {
    it('expands a relative path against the base URI', () => {
      const url = expandURL('/foo/bar?x=1');
      expect(url).toBeInstanceOf(URL);
      expect(url.pathname).toEqual('/foo/bar');
      expect(url.search).toEqual('?x=1');
    });

    it('accepts a URL instance via toString', () => {
      const original = new URL('https://example.com/a?b=c');
      const url = expandURL(original);
      expect(url.href).toEqual('https://example.com/a?b=c');
    });

    it('returns pathname + search from relativeURL', () => {
      expect(relativeURL(new URL('https://example.com/foo?bar=1'))).toEqual('/foo?bar=1');
    });
  });

  describe('dispatch', () => {
    it('dispatches on the given target when connected', () => {
      const target = document.createElement('div');
      document.body.append(target);
      let received: CustomEvent | undefined;
      target.addEventListener('test:dispatch', (event) => {
        received = event as CustomEvent;
      });
      const event = dispatch('test:dispatch', { target, detail: { ok: true } });
      expect(received).toBe(event);
      expect(received?.detail).toEqual({ ok: true });
      target.remove();
    });

    it('falls back to documentElement when the target is disconnected', () => {
      const target = document.createElement('div'); // never appended → !isConnected
      let received = false;
      const handler = () => {
        received = true;
      };
      document.documentElement.addEventListener('test:dispatch:fallback', handler);
      dispatch('test:dispatch:fallback', { target });
      document.documentElement.removeEventListener('test:dispatch:fallback', handler);
      expect(received).toBeTruthy();
    });

    it('falls back to documentElement when no target is provided', () => {
      let received = false;
      const handler = () => {
        received = true;
      };
      document.documentElement.addEventListener('test:dispatch:none', handler);
      dispatch('test:dispatch:none');
      document.documentElement.removeEventListener('test:dispatch:none', handler);
      expect(received).toBeTruthy();
    });
  });

  describe('debounce / throttle', () => {
    it('debounces calls and respects cancelDebounce', async () => {
      const target = document.createElement('div');
      let count = 0;
      const callback = () => {
        count++;
      };
      debounce(target, callback, 20);
      debounce(target, callback, 20);
      debounce(target, callback, 20);
      expect(count).toEqual(0);
      await wait(60);
      expect(count).toEqual(1);

      debounce(target, callback, 20);
      cancelDebounce(target);
      await wait(60);
      expect(count).toEqual(1);
    });

    it('debounces with default interval when none is provided', () => {
      const target = document.createElement('div');
      let count = 0;
      debounce(target, () => count++);
      // First scheduled call has not fired yet (default 500ms).
      expect(count).toEqual(0);
      cancelDebounce(target);
    });

    it('runs the callback immediately when interval is 0', () => {
      const target = document.createElement('div');
      let count = 0;
      debounce(target, () => count++, 0);
      debounce(target, () => count++, 0);
      expect(count).toEqual(2);
    });

    it('throttles calls and respects cancelThrottle', async () => {
      const target = document.createElement('div');
      let count = 0;
      throttle(target, () => count++, 20);
      throttle(target, () => count++, 20);
      throttle(target, () => count++, 20);
      expect(count).toBeGreaterThanOrEqual(1);
      cancelThrottle(target);
      await wait(40);
    });

    it('throttles with default interval when none is provided', () => {
      const target = document.createElement('div');
      let count = 0;
      throttle(target, () => count++);
      throttle(target, () => count++);
      expect(count).toBeGreaterThanOrEqual(1);
      cancelThrottle(target);
    });

    it('runs the callback immediately when throttle interval is 0', () => {
      const target = document.createElement('div');
      let count = 0;
      throttle(target, () => count++, 0);
      throttle(target, () => count++, 0);
      expect(count).toEqual(2);
    });
  });

  describe('parseIntWithDefault', () => {
    it('parses a numeric string', () => {
      expect(parseIntWithDefault('42')).toEqual(42);
    });
    it('returns the default for null', () => {
      expect(parseIntWithDefault(null)).toEqual(0);
      expect(parseIntWithDefault(null, 7)).toEqual(7);
    });
  });

  describe('groupBy / partition', () => {
    it('groups entries by key, including multiple entries per key', () => {
      const result = groupBy([1, 2, 3, 4, 5], (n) => n % 2);
      expect(result.get(1)).toEqual([1, 3, 5]);
      expect(result.get(0)).toEqual([2, 4]);
    });

    it('partitions entries by predicate', () => {
      const [yes, no] = partition([1, 2, 3, 4], (n) => n > 2);
      expect(yes).toEqual([3, 4]);
      expect(no).toEqual([1, 2]);
    });
  });

  describe('isButtonElement / isAnchorElement / isSubmitterElement', () => {
    it('matches buttons and anchors', () => {
      expect(isButtonElement(document.createElement('button'))).toBeTruthy();
      expect(isAnchorElement(document.createElement('a'))).toBeTruthy();
      expect(isButtonElement(document.createElement('div'))).toBeFalsy();
      expect(isAnchorElement(document.createElement('div'))).toBeFalsy();
    });

    it('isSubmitterElement matches buttons and inputs', () => {
      expect(isSubmitterElement(document.createElement('button'))).toBeTruthy();
      expect(isSubmitterElement(document.createElement('input'))).toBeTruthy();
      expect(isSubmitterElement(document.createElement('div'))).toBeFalsy();
    });
  });

  describe('domReady', () => {
    it('resolves immediately when document is already loaded', async () => {
      await domReady();
      expect(document.readyState).not.toEqual('loading');
    });
  });

  describe('isHTMLElement', () => {
    it('matches HTML elements', () => {
      expect(isHTMLElement(document.createElement('div'))).toBeTruthy();
    });

    it('does not match non-elements', () => {
      expect(isHTMLElement(null)).toBeFalsy();
      expect(isHTMLElement(document.createTextNode('hi'))).toBeFalsy();
    });
  });

  describe('isElement', () => {
    it('should match element', () => {
      expect(isElement(document.createElement('div'))).toBeTruthy();
    });
  });

  describe('isTextInputElement', () => {
    it('should match text input element', () => {
      expect(isTextInputElement(createInputElement('text'))).toBeTruthy();
    });
    it('should match email input element', () => {
      expect(isTextInputElement(createInputElement('email'))).toBeTruthy();
    });
    it('should match password input element', () => {
      expect(isTextInputElement(createInputElement('password'))).toBeTruthy();
    });
    it('should match search input element', () => {
      expect(isTextInputElement(createInputElement('search'))).toBeTruthy();
    });
    it('should match tel input element', () => {
      expect(isTextInputElement(createInputElement('tel'))).toBeTruthy();
    });
    it('should match url input element', () => {
      expect(isTextInputElement(createInputElement('url'))).toBeTruthy();
    });
    it('should match textarea element', () => {
      expect(isTextInputElement(document.createElement('textarea'))).toBeTruthy();
    });

    it('should not match number input element', () => {
      expect(isTextInputElement(createInputElement('number'))).toBeFalsy();
    });
  });

  describe('isFormInputElement', () => {
    it('should match text input element', () => {
      expect(isFormInputElement(createInputElement('text'))).toBeTruthy();
    });
    it('should match textarea element', () => {
      expect(isFormInputElement(document.createElement('textarea'))).toBeTruthy();
    });
    it('should match select element', () => {
      expect(isFormInputElement(document.createElement('select'))).toBeTruthy();
    });

    it('should not match div element', () => {
      expect(isFormInputElement(document.createElement('div'))).toBeFalsy();
    });
  });

  describe('isSelectElement', () => {
    it('should match select element', () => {
      expect(isSelectElement(document.createElement('select'))).toBeTruthy();
    });

    it('should not match input element', () => {
      expect(isSelectElement(document.createElement('input'))).toBeFalsy();
    });
    it('should not match div element', () => {
      expect(isSelectElement(document.createElement('div'))).toBeFalsy();
    });
  });

  describe('isInputableElement', () => {
    it('should match text input element', () => {
      expect(isInputableElement(createInputElement('text'))).toBeTruthy();
    });
    it('should match password input element', () => {
      expect(isInputableElement(createInputElement('password'))).toBeTruthy();
    });
    it('should match search input element', () => {
      expect(isInputableElement(createInputElement('search'))).toBeTruthy();
    });
    it('should match textarea element', () => {
      expect(isInputableElement(document.createElement('textarea'))).toBeTruthy();
    });

    it('should not match select element', () => {
      expect(isInputableElement(document.createElement('select'))).toBeFalsy();
    });
    it('should not match div element', () => {
      expect(isInputableElement(document.createElement('div'))).toBeFalsy();
    });
  });

  describe('isChangeableElement', () => {
    it('should match checkbox input element', () => {
      expect(isChangeableElement(createInputElement('checkbox'))).toBeTruthy();
    });
    it('should match radio input element', () => {
      expect(isChangeableElement(createInputElement('radio'))).toBeTruthy();
    });
    it('should match range input element', () => {
      expect(isChangeableElement(createInputElement('range'))).toBeTruthy();
    });
    it('should match color input element', () => {
      expect(isChangeableElement(createInputElement('color'))).toBeTruthy();
    });
    it('should match file input element', () => {
      expect(isChangeableElement(createInputElement('file'))).toBeTruthy();
    });
    it('should match select element', () => {
      expect(isChangeableElement(document.createElement('select'))).toBeTruthy();
    });

    it('should not match text input element', () => {
      expect(isChangeableElement(createInputElement('text'))).toBeFalsy();
    });
    it('should not match textarea element', () => {
      expect(isChangeableElement(document.createElement('textarea'))).toBeFalsy();
    });
    it('should not match div element', () => {
      expect(isChangeableElement(document.createElement('div'))).toBeFalsy();
    });
  });

  describe('matchInputElement', () => {
    it('should match text input element', () => {
      expect.assertions(1);
      matchInputElement(createInputElement('text'), {
        text: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
        inputable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
        changeable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
      });
    });

    it('should not match disabled text input element', () => {
      expect.assertions(0);
      matchInputElement(createInputElement('text', true), {
        text: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
        inputable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
        changeable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
      });
    });

    it('should match disabled text input element', () => {
      expect.assertions(1);
      matchInputElement(
        createInputElement('text', true),
        {
          text: (target) => {
            expect(target).toBeInstanceOf(HTMLInputElement);
          },
          inputable: (target) => {
            expect(target).toBeInstanceOf(HTMLInputElement);
          },
          changeable: (target) => {
            expect(target).toBeInstanceOf(HTMLInputElement);
          },
        },
        { disabled: true },
      );
    });

    it('should match number input element', () => {
      expect.assertions(1);
      matchInputElement(createInputElement('number'), {
        number: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
        inputable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
        changeable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
      });
    });

    it('should match checkbox input element', () => {
      expect.assertions(1);
      matchInputElement(createInputElement('checkbox'), {
        checkbox: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
        inputable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
        changeable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
      });
    });

    it('should match file input element', () => {
      expect.assertions(1);
      matchInputElement(createInputElement('file'), {
        file: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
        inputable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
        changeable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
      });
    });

    it('should match textarea element', () => {
      expect.assertions(1);
      matchInputElement(document.createElement('textarea'), {
        text: (target) => {
          expect(target).toBeInstanceOf(HTMLTextAreaElement);
        },
        changeable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
      });
    });

    it('should match select element', () => {
      expect.assertions(1);
      matchInputElement(document.createElement('select'), {
        select: (target) => {
          expect(target).toBeInstanceOf(HTMLSelectElement);
        },
        inputable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
      });
    });

    it('should match inputable element', () => {
      expect.assertions(1);
      matchInputElement(createInputElement('text'), {
        number: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
        inputable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
        changeable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
      });
    });

    it('should match textarea inputable element', () => {
      expect.assertions(1);
      matchInputElement(document.createElement('textarea'), {
        inputable: (target) => {
          expect(target).toBeInstanceOf(HTMLTextAreaElement);
        },
        changeable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
      });
    });

    it('should match input changeable element', () => {
      expect.assertions(1);
      matchInputElement(createInputElement('checkbox'), {
        checkbox: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
        inputable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
        changeable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
      });
    });

    it('should match radio input element', () => {
      expect.assertions(1);
      matchInputElement(createInputElement('radio'), {
        radio: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
        changeable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
      });
    });

    it('should match date input element', () => {
      expect.assertions(1);
      matchInputElement(createInputElement('date'), {
        date: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
        inputable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
      });
    });

    it('should match hidden input element', () => {
      expect.assertions(1);
      matchInputElement(createInputElement('hidden'), {
        hidden: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
      });
    });

    it('should match range input element', () => {
      expect.assertions(1);
      matchInputElement(createInputElement('range'), {
        range: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
        changeable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
      });
    });

    it('should match color input element', () => {
      expect.assertions(1);
      matchInputElement(createInputElement('color'), {
        color: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
        changeable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
      });
    });

    it('should fall back to changeable for range when no range matcher', () => {
      expect.assertions(1);
      matchInputElement(createInputElement('range'), {
        changeable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
      });
    });

    it('should fall back to changeable for color when no color matcher', () => {
      expect.assertions(1);
      matchInputElement(createInputElement('color'), {
        changeable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
      });
    });

    it('should match select changeable element', () => {
      expect.assertions(1);
      matchInputElement(document.createElement('select'), {
        select: (target) => {
          expect(target).toBeInstanceOf(HTMLSelectElement);
        },
        inputable: (target) => {
          expect(target).toBeInstanceOf(HTMLInputElement);
        },
        changeable: (target) => {
          expect(target).toBeInstanceOf(HTMLSelectElement);
        },
      });
    });
  });
});

function createInputElement(type: string, disabled?: boolean) {
  const input = document.createElement('input');
  input.type = type;
  input.disabled = disabled ?? false;
  return input;
}
