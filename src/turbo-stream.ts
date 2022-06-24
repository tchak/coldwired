import invariant from 'tiny-invariant';

type Morph = (fromElement: Element, toElement: Element, childrenOnly?: boolean) => void;
type ActionContext = {
  morph: Morph;
  targetElements: Element[];
};
type ActionFunction = (context: ActionContext, templateContent: Element) => void;

export function renderStream(html: string, morph: Morph) {
  const template = document.createElement('template');
  template.innerHTML = html;
  document.importNode(template, true);
  for (const stream of template.content.querySelectorAll('turbo-stream')) {
    renderTurboStream(stream, morph);
  }
}

const StreamActions: {
  [action: string]: ActionFunction;
} = {
  after(context, templateContent) {
    context.targetElements.forEach((element) =>
      element.parentElement?.insertBefore(templateContent, element.nextSibling)
    );
  },

  append(context, templateContent) {
    removeDuplicateTargetChildren(context.targetElements, templateContent);
    context.targetElements.forEach((element) => element.append(templateContent));
  },

  before(context, templateContent) {
    context.targetElements.forEach((element) =>
      element.parentElement?.insertBefore(templateContent, element)
    );
  },

  prepend(context, templateContent) {
    removeDuplicateTargetChildren(context.targetElements, templateContent);
    context.targetElements.forEach((element) => element.prepend(templateContent));
  },

  remove(context) {
    context.targetElements.forEach((element) => element.remove());
  },

  replace(context, templateContent) {
    context.targetElements.forEach((element) => context.morph(element, templateContent));
  },

  update(context, templateContent) {
    context.targetElements.forEach((element) => context.morph(element, templateContent, true));
  },
};

function renderTurboStream(stream: Element, morph: Morph): void {
  invariant(stream.tagName == 'TURBO-STREAM', '[turbo-stream] element must be a <turbo-stream>');

  const action = stream.getAttribute('action') as keyof typeof StreamActions;
  const actionFunction = StreamActions[action];
  invariant(actionFunction, `[turbo-stream] action "${action}" is not supported`);

  const templateContent = actionFunction.length == 2 ? getTemplateContent(stream) : ({} as Element);
  const performAction = () => {
    const targetElements = getTargetElements(stream);
    requestAnimationFrame(() => actionFunction({ morph, targetElements }, templateContent));
  };
  const delay = stream.getAttribute('delay');

  if (delay) {
    setTimeout(performAction, parseInt(delay));
  } else {
    performAction();
  }
}

function getTemplateContent(stream: Element): Element {
  const templateElement = stream.firstElementChild;
  invariant(
    templateElement && templateElement instanceof HTMLTemplateElement,
    '[turbo-stream] first child element must be a <template> element'
  );
  return templateElement.content.cloneNode(true) as Element;
}

function getTargetElements(stream: Element): Element[] {
  const target = stream.getAttribute('target');
  const targets = stream.getAttribute('targets');

  if (target) {
    return targetElementsById(target);
  } else if (targets) {
    return targetElementsByQuery(targets);
  }

  invariant(false, '[turbo-stream] "target" or "targets" attribute is missing');
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

function removeDuplicateTargetChildren(targetElements: Element[], templateContent: Element) {
  duplicateChildren(targetElements, templateContent).forEach((c) => c.remove());
}

function duplicateChildren(targetElements: Element[], templateContent: Element) {
  const existingChildren = targetElements.flatMap((e) => [...e.children]).filter((c) => !!c.id);
  const newChildrenIds = [...(templateContent?.children || [])]
    .filter((c) => !!c.id)
    .map((c) => c.id);

  return existingChildren.filter((c) => newChildrenIds.includes(c.id));
}
