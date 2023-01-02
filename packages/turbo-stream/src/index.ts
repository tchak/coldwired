import invariant from 'tiny-invariant';

import { Actions } from '@coldwired/actions';
import { parseHTMLFragment, nextAnimationFrame, wait, AbortError } from '@coldwired/utils';

export class TurboStream {
  #actions: Actions;
  #pinnedStreams = new Map<string, Element[]>();

  constructor({ actions }: { actions: Actions }) {
    this.#actions = actions;
  }

  async render(stream: string, signal?: AbortSignal) {
    await Promise.all(
      [...parseHTMLFragment(stream, this.#actions.element.ownerDocument).children].map((stream) =>
        this.renderStream(stream, signal)
      )
    );
  }

  applyPinned(element: Element) {
    for (const stream of [...this.#pinnedStreams].flatMap(([, streams]) => streams)) {
      this.getTurboStreamAction(stream)({
        stream,
        targets: getTargetElements(stream, element),
        fragment: getTemplateContent(stream),
      });
    }
  }

  resetPinned() {
    this.#pinnedStreams.clear();
  }

  private getTurboStreamAction(stream: Element) {
    const action = stream.getAttribute('action');
    invariant(action, '[turbo-stream] action must be present');
    return this.#actions.getAction(action);
  }

  private async renderStream(stream: Element, signal?: AbortSignal): Promise<void> {
    invariant(stream.tagName == 'TURBO-STREAM', '[turbo-stream] element must be a <turbo-stream>');

    const action = this.getTurboStreamAction(stream);
    const delay = parseInt(stream.getAttribute('delay') ?? '0');

    if (delay > 0) {
      try {
        await wait(delay, signal);
      } catch (error) {
        if (error instanceof AbortError) return;
        throw error;
      }
    } else {
      await nextAnimationFrame();
    }

    if (signal?.aborted) return;

    this.pinStream(stream);

    action({
      stream,
      targets: getTargetElements(stream, this.#actions.element),
      fragment: getTemplateContent(stream),
    });
  }

  private pinStream(stream: Element) {
    const pinned = stream.getAttribute('pinned') ?? false;
    if (!pinned) return;

    stream.removeAttribute('pinned');
    invariant(['last', 'all'].includes(pinned), '[turbo-stream] pinned must be "last" or "all"');

    const key = getTurboStreamKey(stream);

    if (pinned == 'all') {
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

function getTemplateContent(stream: Element): DocumentFragment {
  const templateElement = stream.firstElementChild;
  if (!templateElement) {
    return stream.ownerDocument.createDocumentFragment();
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
