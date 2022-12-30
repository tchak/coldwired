import invariant from 'tiny-invariant';

import { morphElement, MorphOptions } from './morph';
import { dispatch } from './utils';

type ActionContext = { morphElement: typeof morphElement; targetElements: Element[] };
type TurboStreamAction = (
  context: ActionContext,
  templateContent: () => DocumentFragment,
  turboStreamElement: Element
) => void;

export function renderTurboStreamTemplate(html: string, options?: MorphOptions) {
  const template = document.createElement('template');
  template.innerHTML = html;
  document.importNode(template, true);
  for (const turboStreamElement of template.content.querySelectorAll('turbo-stream')) {
    renderTurboStream(turboStreamElement, options);
  }
}

const StreamActions: {
  [action: string]: TurboStreamAction;
} = {
  after(context, templateContent) {
    context.targetElements.forEach((element) => {
      if (element.nextSibling) {
        element.parentElement?.insertBefore(templateContent(), element.nextSibling);
      } else {
        element.parentElement?.append(templateContent());
      }
    });
  },

  before(context, templateContent) {
    context.targetElements.forEach((element) =>
      element.parentElement?.insertBefore(templateContent(), element)
    );
  },

  append(context, templateContent) {
    removeDuplicateTargetChildren(context.targetElements, templateContent());
    context.targetElements.forEach((element) => element.append(templateContent()));
  },

  prepend(context, templateContent) {
    removeDuplicateTargetChildren(context.targetElements, templateContent());
    context.targetElements.forEach((element) => element.prepend(templateContent()));
  },

  remove(context) {
    context.targetElements.forEach((element) => element.remove());
  },

  replace(context, templateContent) {
    context.targetElements.forEach((element) => context.morphElement(element, templateContent()));
  },

  update(context, templateContent) {
    context.targetElements.forEach((element) =>
      context.morphElement(element, templateContent(), { childrenOnly: true })
    );
  },

  dispatch(context, _, turboStreamElement) {
    const type = turboStreamElement.getAttribute('event-type');
    invariant(type, '[turbo-stream] event-type must be present');

    const detailJSON = turboStreamElement.getAttribute('event-detail');
    const detail = detailJSON ? JSON.parse(detailJSON) : {};

    if (context.targetElements.length > 0) {
      context.targetElements.forEach((target) => dispatch(type, { target, detail }));
    } else {
      dispatch(type, { detail });
    }
  },
};

function renderTurboStream(turboStreamElement: Element, defaultOptions?: MorphOptions): void {
  invariant(
    turboStreamElement.tagName == 'TURBO-STREAM',
    '[turbo-stream] element must be a <turbo-stream>'
  );

  const turboStreamAction = getTurboStreamAction(turboStreamElement);
  const turboStreamActionFn = () => {
    requestAnimationFrame(() =>
      turboStreamAction(
        {
          morphElement(fromElement, toElement, options) {
            morphElement(fromElement, toElement, { ...defaultOptions, ...options });
          },
          targetElements: getTargetElements(turboStreamElement),
        },
        () => getTemplateContent(turboStreamElement),
        turboStreamElement
      )
    );
  };
  const delay = turboStreamElement.getAttribute('delay');

  if (delay) {
    setTimeout(turboStreamActionFn, parseInt(delay));
  } else {
    turboStreamActionFn();
  }
}

function getTurboStreamAction(turboStreamElement: Element): TurboStreamAction {
  const actionName = turboStreamElement.getAttribute('action') as keyof typeof StreamActions;
  const turboStreamAction = StreamActions[actionName];
  invariant(turboStreamAction, `[turbo-stream] action "${actionName}" is not supported`);
  return turboStreamAction;
}

function getTemplateContent(turboStreamElement: Element): DocumentFragment {
  const templateElement = turboStreamElement.firstElementChild;
  if (!templateElement) {
    return document.createDocumentFragment();
  }
  invariant(
    templateElement instanceof HTMLTemplateElement,
    '[turbo-stream] first child element must be a <template> element'
  );
  const templateContent = templateElement.content;
  templateContent.normalize();
  return templateContent.cloneNode(true) as DocumentFragment;
}

function getTargetElements(turboStreamElement: Element): Element[] {
  const target = turboStreamElement.getAttribute('target');
  const targets = turboStreamElement.getAttribute('targets');

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

function removeDuplicateTargetChildren(
  targetElements: Element[],
  templateContent: DocumentFragment
) {
  duplicateChildren(targetElements, templateContent).forEach((c) => c.remove());
}

function duplicateChildren(targetElements: Element[], templateContent: DocumentFragment) {
  const existingChildren = targetElements
    .flatMap((element) => [...element.children])
    .filter((element) => !!element.id);
  const newChildrenIds = new Set(
    [...templateContent.children].filter((element) => !!element.id).map((element) => element.id)
  );

  return existingChildren.filter((element) => newChildrenIds.has(element.id));
}
