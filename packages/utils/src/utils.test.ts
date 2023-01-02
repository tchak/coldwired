import { describe, it, expect } from 'vitest';

import { isElement } from '.';

describe('@coldwired/utils', () => {
  describe('isElement', () => {
    it('should match element', () => {
      expect(isElement(document.createElement('div'))).toBe(true);
    });
  });
});
