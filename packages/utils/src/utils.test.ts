import { describe, it, expect } from 'vitest';

import {
  isElement,
  isTextInputElement,
  isFormInputElement,
  isSelectElement,
  isInputableElement,
  isChangeableElement,
  matchInputElement,
} from '.';

describe('@coldwired/utils', () => {
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
