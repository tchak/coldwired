import { Controller } from '@hotwired/stimulus';

const DEFAULT_MIN_TIMEOUT = 5_000; // 5 seconds

export class RevalidateController extends Controller {
  #timer?: ReturnType<typeof setInterval>;

  connect() {
    this.startRevalidating();
  }

  disconnect() {
    this.stopRevalidating();
  }

  startRevalidating() {
    clearInterval(this.#timer);
    this.#timer = setInterval(() => {
      this.dispatch('revalidate', {
        target: this.application.element,
        prefix: 'remix-router-turbo',
      });
    }, this.interval);
  }

  stopRevalidating() {
    clearInterval(this.#timer);
  }

  private get interval() {
    const value = this.element.getAttribute('data-revalidate-interval');
    return parseIntOr(value, DEFAULT_MIN_TIMEOUT);
  }
}

function parseIntOr(value: string | undefined | null, defaultValue: number) {
  return value ? parseInt(value) : defaultValue;
}
