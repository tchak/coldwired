export * from './actions';
export * from './schema';
export * from './plugin';

import { dispatchAction } from './actions';

type Targets = Element | Element[] | string | null;

export function hide(targets?: Targets) {
  dispatchAction({ action: 'hide', targets });
}

export function show(targets?: Targets) {
  dispatchAction({ action: 'show', targets });
}

export function disable(targets?: Targets) {
  dispatchAction({ action: 'disable', targets });
}

export function enable(targets?: Targets) {
  dispatchAction({ action: 'enable', targets });
}

export function remove(targets?: Targets) {
  dispatchAction({ action: 'remove', targets });
}

export function append(targets: Targets, fragment: string | DocumentFragment) {
  dispatchAction({ action: 'append', targets, fragment });
}

export function prepend(targets: Targets, fragment: string | DocumentFragment) {
  dispatchAction({ action: 'prepend', targets, fragment });
}

export function after(targets: Targets, fragment: string | DocumentFragment) {
  dispatchAction({ action: 'after', targets, fragment });
}

export function before(targets: Targets, fragment: string | DocumentFragment) {
  dispatchAction({ action: 'before', targets, fragment });
}

export function update(targets: Targets, fragment: string | DocumentFragment) {
  dispatchAction({ action: 'update', targets, fragment });
}

export function replace(targets: Targets, fragment: string | DocumentFragment) {
  dispatchAction({ action: 'replace', targets, fragment });
}
