import { useState, useMemo, useEffect, memo } from 'react';
import isEqual from 'react-fast-compare';

import type { Child, ReactValue, Manifest } from './tree-builder.react';
import { createReactTree } from './tree-builder.react';
import { Observable, type Observer } from './observable';

export const RootStateComponent = memo(function RootComponent({
  tree,
  manifest,
}: {
  tree: Child[];
  manifest: Manifest;
}) {
  const state = useLocalState();
  return createReactTree(tree, manifest, state);
}, isEqual);

export interface State {
  get(key: string, defaultValue?: ReactValue): ReactValue;
  set(key: string, value: ReactValue): void;
  observe(key: string): Observable<ReactValue>;
}
type StateValue = Record<string, ReactValue>;
type Registry = Map<string, Set<Observer<ReactValue>>>;

function createState(
  state: StateValue,
  setState: (valueOrUpdate: StateValue | ((state: StateValue) => StateValue)) => void,
  registry: Registry,
): State {
  return {
    set: (key, value) => {
      setState((state) => ({ ...state, [key]: value }));
      const observers = registry.get(key);
      if (observers) {
        for (const observer of observers) {
          observer.next(value);
        }
      }
    },
    get: (key, defaultValue) => state[key] ?? defaultValue,
    observe: (key) => {
      return new Observable((observer) => {
        let observers = registry.get(key);
        if (!observers) {
          observers = new Set();
          registry.set(key, observers);
        }
        observers.add(observer);
        return () => {
          observers.delete(observer);
          if (observers.size == 0) {
            registry.delete(key);
          }
        };
      });
    },
  };
}

const NullMap = Object.assign(new Map(), {
  set: () => {
    throw new Error('Cannot observe null state');
  },
});
export const NullState = createState(
  {},
  () => {
    throw new Error('Cannot set state on null state');
  },
  NullMap,
);

function useLocalState(): State {
  const [state, setState] = useState<StateValue>({});
  const registry: Registry = useMemo(() => new Map(), []);
  useEffect(() => {
    return () => {
      registry.clear();
    };
  }, []);
  return useMemo(() => createState(state, setState, registry), [state]);
}
