import invariant from 'tiny-invariant';

import { Actions, parseActionName } from '@coldwired/actions';
import { parseHTMLFragment, nextAnimationFrame, wait, AbortError } from '@coldwired/utils';

export class TurboStream {
  #actions: Actions;
  #pinnedStreams = new Map<string, Element[]>();

  constructor({ actions }: { actions: Actions }) {
    this.#actions = actions;
  }

  async render(stream: string, signal?: AbortSignal) {
    const actions = [
      ...parseHTMLFragment(stream, this.#actions.element.ownerDocument).children,
    ].map((stream) => this.parseStream(stream));

    const immediateActions = actions.filter((action) => action.delay == 0);
    const delayedActions = actions.filter((action) => action.delay > 0);

    const immediateApply = async () => {
      await nextAnimationFrame();
      this.#actions.render(immediateActions);
    };

    await Promise.all([
      immediateApply(),
      ...delayedActions.map(async ({ delay, ...action }) => {
        try {
          await wait(delay, signal);
        } catch (error) {
          if (error instanceof AbortError) return;
          throw error;
        }
        if (signal?.aborted) return;
        this.#actions.render([action]);
      }),
    ]);
  }

  applyPinned(element: Element) {
    const actions = [...this.#pinnedStreams]
      .flatMap(([, streams]) => streams)
      .map((stream) => this.parseStream(stream, element));
    this.#actions.render(actions);
  }

  resetPinned() {
    this.#pinnedStreams.clear();
  }

  private parseStream(stream: Element, element?: Element) {
    invariant(stream.tagName == 'TURBO-STREAM', '[turbo-stream] element must be a <turbo-stream>');

    const action = parseActionName(stream.getAttribute('action') ?? '');
    const delay = parseInt(stream.getAttribute('delay') ?? '0');
    const pin = stream.getAttribute('pin');

    invariant(
      !pin || pin == 'last' || pin == 'all',
      '[turbo-stream] pin attribute value must be "last" or "all"'
    );
    invariant(!pin || delay == 0, '[turbo-stream] pin attribute cannot be used with delay');

    if (pin) {
      this.pinStream(pin, stream);
    }

    return {
      action,
      delay,
      targets: getTargetElements(stream, element ?? this.#actions.element),
      fragment: getTemplateContent(stream) ?? undefined,
    };
  }

  private pinStream(pin: string, stream: Element) {
    stream.removeAttribute('pin');
    invariant(
      ['last', 'all'].includes(pin),
      '[turbo-stream] pin attribute value must be "last" or "all"'
    );

    const key = getTurboStreamKey(stream);

    if (pin == 'all') {
      let streams = this.#pinnedStreams.get(key);
      if (!streams) {
        streams = [];
        this.#pinnedStreams.set(key, streams);
      }
      streams.push(stream.cloneNode(true) as Element);
    } else {
      this.#pinnedStreams.set(key, [stream.cloneNode(true) as Element]);
    }
  }
}

function getTemplateContent(stream: Element): DocumentFragment | null {
  const templateElement = stream.firstElementChild;
  if (!templateElement) {
    return null;
  }
  invariant(
    templateElement instanceof HTMLTemplateElement,
    '[turbo-stream] first child element must be a <template> element'
  );
  const templateContent = templateElement.content;
  templateContent.normalize();
  return templateContent;
}

function getTargetElements(stream: Element, element: Element): Element[] {
  const selector = getTurboStreamTargetSelector(stream);
  if (!selector) return [];

  return [...element.querySelectorAll(selector)];
}

function getTurboStreamTargetSelector(stream: Element) {
  const target = stream.getAttribute('target');
  const targets = stream.getAttribute('targets');
  if (targets) {
    return targets;
  } else if (target) {
    return `#${target}`;
  }
  return null;
}

function getTurboStreamKey(stream: Element) {
  const action = stream.getAttribute('action');
  invariant(action, '[turbo-stream] action must be present');
  const selector = getTurboStreamTargetSelector(stream);
  if (selector) {
    return `${action}--${selector}`;
  }
  return action;
}
