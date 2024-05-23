import type { Plugin } from '@coldwired/actions';
import type { Root } from './root';

export function createReactPlugin(root: Root): Plugin {
  const pending: Set<Promise<void>> = new Set();
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
      await Promise.all([...pending]);
    },
    validate(element) {
      if (root.contains('body' in element ? element.body : element)) {
        throw new Error('Cannot apply actions inside fragment');
      }
    },
    onCreateElement(element) {
      const batch = root.render(element);
      if (batch.count == 0) {
        return false;
      }
      pending.add(batch.done);
      batch.done.then(() => pending.delete(batch.done));
      return true;
    },
    onBeforeUpdateElement(element, toElement) {
      const batch = root.render(element, toElement);
      if (batch.count == 0) {
        return false;
      }
      pending.add(batch.done);
      batch.done.then(() => pending.delete(batch.done));
      return true;
    },
    onBeforeDestroyElement(element) {
      return root.remove(element);
    },
  };
}
