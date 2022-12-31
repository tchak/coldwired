import invariant from 'tiny-invariant';

import { type MorphOptions, morph } from '../morph';
import { dispatch, parseHTMLFragment, nextAnimationFrame, wait, AbortError } from '../utils';

export type RenderTurboStreamOptions = { signal?: AbortSignal; morphOptions?: MorphOptions };

export async function renderTurboStream(html: string, options?: RenderTurboStreamOptions) {
  await Promise.all(
    [...parseHTMLFragment(html).children].map((stream) => renderTurboStreamElement(stream, options))
  );
}

export type TurboStreamAction = (params: {
  stream: Element;
  targets: Element[];
  fragment: DocumentFragment;
  morphOptions?: MorphOptions;
}) => void;

export const TurboStreamActions: {
  [action: string]: TurboStreamAction;
} = {
  after({ targets, fragment }) {
    for (const element of targets) {
      element.after(fragment.cloneNode(true));
    }
  },

  before({ targets, fragment }) {
    for (const element of targets) {
      element.before(fragment.cloneNode(true));
    }
  },

  append({ targets, fragment }) {
    removeDuplicateTargetChildren(targets, fragment);
    for (const element of targets) {
      element.append(fragment.cloneNode(true));
    }
  },

  prepend({ targets, fragment }) {
    removeDuplicateTargetChildren(targets, fragment);
    for (const element of targets) {
      element.prepend(fragment.cloneNode(true));
    }
  },

  remove({ targets }) {
    for (const element of targets) {
      element.remove();
    }
  },

  replace({ targets, fragment, morphOptions }) {
    for (const element of targets) {
      morph(element, fragment.cloneNode(true) as DocumentFragment, morphOptions);
    }
  },

  update({ targets, fragment, morphOptions }) {
    const wrapper = document.createElement('div');
    wrapper.append(fragment);
    for (const element of targets) {
      morph(element, wrapper.cloneNode(true) as DocumentFragment, {
        ...morphOptions,
        childrenOnly: true,
      });
    }
  },

  dispatch({ targets, stream }) {
    const type = stream.getAttribute('event-type');
    invariant(type, '[turbo-stream] event-type must be present');

    const detailJSON = stream.getAttribute('event-detail');
    const detail = detailJSON ? JSON.parse(detailJSON) : {};

    if (targets.length > 0) {
      for (const target of targets) {
        dispatch(type, { target, detail });
      }
    } else {
      dispatch(type, { detail });
    }
  },
};

async function renderTurboStreamElement(
  stream: Element,
  options?: RenderTurboStreamOptions
): Promise<void> {
  invariant(stream.tagName == 'TURBO-STREAM', '[turbo-stream] element must be a <turbo-stream>');

  const action = getTurboStreamAction(stream);
  const delay = parseInt(stream.getAttribute('delay') ?? '0');

  if (delay > 0) {
    try {
      await wait(delay, options?.signal);
    } catch (error) {
      if (error instanceof AbortError) return;
      throw error;
    }
  } else {
    await nextAnimationFrame();
  }

  if (options?.signal?.aborted) return;

  action({
    stream,
    targets: getTargetElements(stream),
    fragment: getTemplateContent(stream),
    morphOptions: options?.morphOptions,
  });
}

function getTurboStreamAction(stream: Element): TurboStreamAction {
  const actionName = stream.getAttribute('action') as keyof typeof TurboStreamActions;
  const turboStreamAction = TurboStreamActions[actionName];
  invariant(turboStreamAction, `[turbo-stream] action "${actionName}" is not supported`);
  return turboStreamAction;
}

function getTemplateContent(stream: Element): DocumentFragment {
  const templateElement = stream.firstElementChild;
  if (!templateElement) {
    return document.createDocumentFragment();
  }
  invariant(
    templateElement instanceof HTMLTemplateElement,
    '[turbo-stream] first child element must be a <template> element'
  );
  const templateContent = templateElement.content;
  templateContent.normalize();
  return templateContent;
}

function getTargetElements(stream: Element): Element[] {
  const target = stream.getAttribute('target');
  const targets = stream.getAttribute('targets');

  if (target) {
    return targetElementsById(target);
  } else if (targets) {
    return targetElementsByQuery(targets);
  }

  return [];
}

function targetElementsById(target: string): Element[] {
  const element = document.getElementById(target);

  if (element != null) {
    return [element];
  } else {
    return [];
  }
}

function targetElementsByQuery(targets: string): Element[] {
  const elements = document.querySelectorAll(targets);

  if (elements.length != 0) {
    return [...elements];
  } else {
    return [];
  }
}

function removeDuplicateTargetChildren(targets: Element[], fragment: DocumentFragment) {
  for (const element of duplicateChildren(targets, fragment)) {
    element.remove();
  }
}

function duplicateChildren(targets: Element[], fragment: DocumentFragment) {
  const existingChildren = targets
    .flatMap((element) => [...element.children])
    .filter((element) => !!element.id);
  const newChildrenIds = new Set(
    [...fragment.children].filter((element) => !!element.id).map((element) => element.id)
  );

  return existingChildren.filter((element) => newChildrenIds.has(element.id));
}
