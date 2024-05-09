export interface Observer<T> {
  next: NextChannel<T>;
}

type Connect<T> = (observer: Observer<T>) => Disconnect;
type Disconnect = () => void;

export type NextChannel<T> = (value: T) => void;
export type ObserverOrNext<T> = Observer<T> | NextChannel<T>;

export type Unsubscribe = () => void;
export type Subscription = { unsubscribe: Unsubscribe };

/**
 * `Observable` is a standard interface that's useful for modeling multiple,
 * asynchronous events.
 */
export class Observable<T> implements Observable<T> {
  #connect: Connect<T>;

  /**
   * The provided function should receive an observer and connect that
   * observer's `next` method to an event source (for instance,
   * `element.addEventListener('click', observer.next)`).
   *
   * It must return a function that will disconnect the observer from the event
   * source.
   */
  constructor(connect: Connect<T>) {
    this.#connect = connect;
  }

  /**
   * `subscribe` uses the function supplied to the constructor to connect an
   * observer to an event source.  Each observer is connected independently:
   * each call to `subscribe` calls `connect` with the new observer.
   *
   * To disconnect the observer from the event source, call `unsubscribe` on the
   * returned subscription.
   *
   * Note: `subscribe` accepts either a function or an object with a
   * next method.
   */
  subscribe(observerOrNext: ObserverOrNext<T>): Subscription {
    // For simplicity's sake, `subscribe` accepts `next` either as either an
    // anonymous function or wrapped in an object (the observer).  Since
    // `connect` always expects to receive an observer, wrap any loose
    // functions in an object.
    const observer = wrapWithObserver<T>(observerOrNext);

    let disconnect: Disconnect | undefined = this.#connect(observer);

    return {
      unsubscribe() {
        if (disconnect) {
          disconnect();
          disconnect = undefined;
        }
      },
    };
  }
}

function wrapWithObserver<T>(listener: ObserverOrNext<T>): Observer<T> {
  if (typeof listener == 'function') {
    return { next: listener };
  } else {
    return listener;
  }
}
