import { createPortal } from 'react-dom';
import { createRoot as createReactRoot } from 'react-dom/client';
import {
  useSyncExternalStore,
  useEffect,
  StrictMode,
  type ReactNode,
  type FunctionComponent,
} from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';

type LayoutProps = { children: ReactNode };
export type LayoutComponent = FunctionComponent<LayoutProps>;
type ErrorBoundaryFallbackProps = FallbackProps & { element: Element };
export type ErrorBoundaryFallbackComponent = FunctionComponent<ErrorBoundaryFallbackProps>;

export { hydrate } from './tree-builder.react';

export function createAndRenderReactRoot({
  container,
  subscribe,
  getSnapshot,
  onMounted,
  LayoutComponent,
  ErrorBoundaryFallbackComponent,
}: {
  container: Element;
  subscribe: (callback: () => void) => () => void;
  getSnapshot: () => Map<Element, ReactNode>;
  onMounted: () => void;
  LayoutComponent?: LayoutComponent;
  ErrorBoundaryFallbackComponent?: ErrorBoundaryFallbackComponent;
}) {
  const props = {
    subscribe,
    getSnapshot,
    onMounted,
    ErrorBoundaryFallback: ErrorBoundaryFallbackComponent || DefaultErrorBoundaryFallbackComponent,
  };
  const Layout = LayoutComponent || DefaultLayoutComponent;
  const root = createReactRoot(container);
  root.render(
    <Layout>
      <RootProvider {...props} />
    </Layout>,
  );
  return () => root.unmount();
}

const DefaultLayoutComponent: LayoutComponent = StrictMode;
const DefaultErrorBoundaryFallbackComponent: ErrorBoundaryFallbackComponent = ({
  error,
  element,
}) => {
  const message = element.getAttribute('fallback-message') ?? error.message;
  return (
    <div role="alert">
      <pre style={{ color: 'red' }}>{message}</pre>
    </div>
  );
};

function RootProvider({
  subscribe,
  getSnapshot,
  onMounted,
  ErrorBoundaryFallback,
}: {
  subscribe(callback: () => void): () => void;
  getSnapshot(): Map<Element, ReactNode>;
  onMounted: () => void;
  ErrorBoundaryFallback: ErrorBoundaryFallbackComponent;
}) {
  useEffect(onMounted, []);
  const cache = useSyncExternalStore(subscribe, getSnapshot);

  return (
    <>
      {...Array.from(cache).map(([element, content]) =>
        createPortal(
          <ErrorBoundary
            fallbackRender={(props) => <ErrorBoundaryFallback element={element} {...props} />}
          >
            {content}
          </ErrorBoundary>,
          element,
          getKeyForElement(element),
        ),
      )}
    </>
  );
}

const keys = new WeakMap<Element, string>();

function getKeyForElement(element: Element): string {
  let key = keys.get(element);
  if (!key) {
    key = Math.random().toString(36).slice(2);
    keys.set(element, key);
  }
  return key;
}
