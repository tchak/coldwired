import { Directive } from '../directive-controller';
import { throttle, parseIntWithDefault } from '../../utils';

const DEFAULT_INTERVAL = 5_000; // 5 seconds

export class Revalidate extends Directive {
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
    throttle(this.element, () => this.router.revalidate(), this.interval);
  }

  private get interval() {
    const value = this.element.getAttribute(this.schema.revalidateIntervalAttribute);
    return parseIntWithDefault(value, DEFAULT_INTERVAL);
  }
}
