import invariant from 'tiny-invariant';

import { type Action, Actions, isValidActionName } from '@coldwired/actions';
import { parseHTMLFragment } from '@coldwired/utils';

export async function renderTurboStream(actions: Actions, stream: string) {
  actions.applyActions(
    [...parseHTMLFragment(stream, actions.element.ownerDocument).children].map(parseTurboStream),
  );
  await actions.ready();
}

export function parseTurboStream(stream: Element): Action {
  invariant(stream.tagName == 'TURBO-STREAM', '[turbo-stream] element must be a <turbo-stream>');

  const action = parseActionName(stream);

  if (action == 'refresh') {
    return { action, targets: '' };
  }

  const delay = parseDelay(stream);
  const pin = parsePin(stream);
  const targets = parseTargets(stream);
  const fragment = parseTemplate(stream);

  switch (action) {
    case 'after':
    case 'before':
    case 'update':
    case 'replace':
    case 'append':
    case 'prepend':
      invariant(fragment, '[turbo-stream] template is required');
      return { action, delay, pin, targets, fragment };
    default:
      return { action, delay, pin, targets };
  }
}

function parseActionName(stream: Element): Action['action'] {
  const actionName = stream.getAttribute('action');
  invariant(isValidActionName(actionName), `[actions] action "${actionName}" is not supported`);
  return actionName;
}

function parsePin(stream: Element): Action['pin'] {
  const pin = stream.getAttribute('pin');
  if (pin == '' || pin == 'true') {
    return true;
  } else if (pin == 'last') {
    return 'last';
  }
  return;
}

function parseDelay(stream: Element): Action['delay'] {
  const delay = stream.getAttribute('delay');
  if (delay) {
    return parseInt(delay);
  }
  return;
}

function parseTargets(stream: Element): Action['targets'] {
  const target = stream.getAttribute('target');
  const targets = stream.getAttribute('targets');
  invariant(targets || target, '[turbo-stream] "target" or "targets" attributes are required');

  if (targets) {
    return targets;
  }
  return `#${target}`;
}

function parseTemplate(stream: Element): DocumentFragment | undefined {
  const templateElement = stream.firstElementChild;
  if (!templateElement) {
    return;
  }
  invariant(
    templateElement instanceof HTMLTemplateElement,
    '[turbo-stream] first child element must be a <template> element',
  );
  const templateContent = templateElement.content;
  templateContent.normalize();
  return templateContent;
}
