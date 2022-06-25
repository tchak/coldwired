import { Controller } from '@hotwired/stimulus';

import { throttle } from '../utils';

const DEFAULT_MIN_TIMEOUT = 5_000; // 5 seconds

export class RevalidateController extends Controller {
  #timer?: ReturnType<typeof setInterval>;

  connect() {
    this.startRevalidating();
  }

  disconnect() {
    this.stopRevalidating();
  }

  private startRevalidating() {
    clearInterval(this.#timer);
    this.#timer = setInterval(() => this.revalidate(), this.interval);
  }

  private stopRevalidating() {
    clearInterval(this.#timer);
  }

  private revalidate() {
    throttle(this.application.element, () => {
      this.dispatch('revalidate', {
        target: this.application.element,
        prefix: 'remix-router-turbo',
      });
    });
  }

  private get interval() {
    const value = this.element.getAttribute('data-revalidate-interval');
    return parseIntOr(value, DEFAULT_MIN_TIMEOUT);
  }
}

function parseIntOr(value: string | undefined | null, defaultValue: number) {
  return value ? parseInt(value) : defaultValue;
}
