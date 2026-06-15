import type { Plugin } from '../actions';
import { isManagedContainerElement, type Root } from './root';

export function createReactPlugin(root: Root): Plugin {
  const pending: Set<Promise<void>> = new Set();
  const track = (done: Promise<void>) => {
    pending.add(done);
    done.then(() => pending.delete(done));
  };
  return {
    init(element) {
      let onReady: () => void;
      const ready = new Promise<void>((resolve) => {
        onReady = resolve;
      });
      pending.add(ready);
      const mountAndRender = async () => {
        const batch = root.render(element);
        if (batch.count != 0) {
          await batch.done;
        }
      };
      mountAndRender().then(() => {
        pending.delete(ready);
        onReady();
      });
    },
    async ready() {
      await Promise.all(pending);
    },
    validate(element) {
      if (root.contains('body' in element ? element.body : element)) {
        throw new Error('Cannot apply actions inside fragment');
      }
    },
    beforeMorph() {
      root.beginMorph();
    },
    onCreateElement(element) {
      const batch = root.render(element);
      if (batch.count == 0) {
        return false;
      }
      track(batch.done);
      return true;
    },
    onAfterCreateElement(element) {
      // A node was just inserted by the morph. If it re-introduces a fragment
      // we rescued earlier in this morph, adopt the live node in its place.
      const batch = root.adopt(element);
      if (batch) {
        track(batch.done);
      }
    },
    onBeforeUpdateElement(element, toElement) {
      const batch = root.render(element, toElement);
      if (batch.count == 0) {
        return false;
      }
      track(batch.done);
      return true;
    },
    onBeforeDestroyElement(element) {
      // Rescue mounted fragments inside the subtree being removed so they can be
      // reused if the server re-adds them (e.g. when an unkeyed ancestor is
      // restructured). Un-adopted ones are cleaned up in `afterMorph`.
      root.stash(element);
      return true;
    },
    afterMorph() {
      root.finalizeMorph();
    },
    shouldPreserveElement(element) {
      // Keep client-only containers (the React root, portal targets) and any
      // node React itself rendered outside the server document — most notably
      // react-aria overlays (popovers, listboxes) which portal straight into
      // `<body>`. A whole-document morph would otherwise treat such a node as
      // an unmatched child and remove it mid-interaction, tearing down the
      // overlay and leaving its trigger (e.g. a ComboBox input) non-reactive.
      // coldwired fragments are portal *containers*, not React-rendered nodes,
      // so they carry no fiber and remain removable when the server drops them.
      return isManagedContainerElement(element) || isReactRenderedNode(element);
    },
  };
}

// React tags every DOM node it renders with an own `__reactFiber$<random>`
// property. We use it to recognise React-owned nodes that have escaped the
// server-rendered tree (portaled overlays) so the morph leaves them in place.
function isReactRenderedNode(element: Element): boolean {
  for (const key of Object.keys(element)) {
    if (key.startsWith('__reactFiber$')) {
      return true;
    }
  }
  return false;
}
