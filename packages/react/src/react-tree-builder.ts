import type { ComponentType, JSX } from 'react';
import { createElement, Fragment, useState, useMemo, memo } from 'react';
import { decode as htmlDecode } from 'html-entities';
import isEqual from 'react-fast-compare';

import { Observable, type Observer } from './observable';

type Child = string | ReactElement | ReactComponent;
type PrimitiveValue = string | number | boolean | null | undefined;
type JSONValue = PrimitiveValue | Array<JSONValue> | { [key: string]: JSONValue };
type EventHandler = (value: ReactValue | Event) => void;
type ReactValue =
  | PrimitiveValue
  | Date
  | bigint
  | Array<ReactValue>
  | { [key: string]: ReactValue }
  | EventHandler
  | Observable<ReactValue>;
export type ReactElement = {
  tagName: string;
  attributes: Record<string, string>;
  children?: Child | Child[];
};
export type ReactComponent = {
  name: string;
  props: Record<string, JSONValue | ReactElement | ReactComponent>;
  children?: Child | Child[];
};
export type Manifest = Record<string, ComponentType<any>>;

function isReactElement(node: JSONValue | ReactElement | ReactComponent): node is ReactElement {
  return !!(node && typeof node == 'object' && 'tagName' in node && 'attributes' in node);
}

function isReactComponent(node: JSONValue | ReactElement | ReactComponent): node is ReactComponent {
  return !!(node && typeof node == 'object' && 'name' in node && 'props' in node);
}

export type DocumentFragmentLike = {
  childNodes: DocumentFragment['childNodes'];
  querySelectorAll: DocumentFragment['querySelectorAll'];
};

export interface Schema {
  componentTagName: string;
  slotTagName: string;
  nameAttribute: string;
  propsAttribute: string;
}

export const defaultSchema: Schema = {
  componentTagName: 'turbo-component',
  slotTagName: 'turbo-slot',
  nameAttribute: 'name',
  propsAttribute: 'props',
};

export function hydrate(
  documentOrFragment: Document | DocumentFragmentLike,
  manifest: Manifest,
  schema?: Partial<Schema>,
): JSX.Element {
  const childNodes = getChildNodes(documentOrFragment);
  const { children: tree, withState } = hydrateChildNodes(
    childNodes,
    Object.assign({}, defaultSchema, schema),
  );
  if (withState) {
    return createElement(RootComponent, { tree, manifest });
  }
  return createReactTree(tree, manifest, createNullState());
}

const RootComponent = memo(function RootComponent({
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

export function createState(
  state: StateValue,
  setState: (valueOrUpdate: StateValue | ((state: StateValue) => StateValue)) => void,
): State {
  const registry = new Map<string, Set<Observer<ReactValue>>>();
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

export function createNullState() {
  return createState({}, () => {
    throw new Error('Cannot set state on null state');
  });
}

function useLocalState(): State {
  const [state, setState] = useState<StateValue>({});
  return useMemo(() => createState(state, setState), [state]);
}

export function preload(
  documentOrFragment: Document | DocumentFragmentLike,
  loader: (names: string[]) => Promise<Manifest>,
  schema?: Partial<Schema>,
): Promise<Manifest> {
  const { componentTagName, nameAttribute } = Object.assign({}, defaultSchema, schema);
  const components = documentOrFragment.querySelectorAll(componentTagName);
  const componentNames = new Set(
    Array.from(components).map(
      (component) => (component as HTMLElement).getAttribute(nameAttribute)!,
    ),
  );
  return loader([...componentNames]);
}

export function createReactTree(
  tree: Child | Child[],
  manifest: Manifest,
  state: State,
): JSX.Element {
  if (Array.isArray(tree)) {
    return createElement(Fragment, {}, ...tree.map((child) => createChild(child, manifest, state)));
  } else if (typeof tree == 'string') {
    return createElement(Fragment, {}, tree);
  }
  return createElementOrComponent(tree, manifest, state);
}

function getChildNodes(documentOrFragment: Document | DocumentFragmentLike) {
  return 'body' in documentOrFragment
    ? documentOrFragment.body.childNodes
    : documentOrFragment.childNodes;
}

type HydrateResult = {
  children: Child[];
  props: Record<string, Child>;
  withState: boolean;
};

function hydrateChildNodes(childNodes: NodeListOf<ChildNode>, schema: Schema): HydrateResult {
  const result: HydrateResult = { children: [], props: {}, withState: false };
  childNodes.forEach((childNode) => {
    if (isTextNode(childNode)) {
      const text = childNode.textContent;
      if (text?.trim()) {
        result.children.push(text);
      }
    } else if (isElementNode(childNode)) {
      const tagName = childNode.tagName.toLowerCase();
      const {
        children,
        props,
        withState: childrenWithState,
      } = hydrateChildNodes(childNode.childNodes, schema);
      if (tagName == schema.componentTagName) {
        const name = childNode.getAttribute(schema.nameAttribute);
        if (!name) {
          throw new Error(
            `Missing "${schema.nameAttribute}" attribute on <${schema.componentTagName}>`,
          );
        }
        const [hydratedProps, withState] = hydrateProps(childNode, schema.propsAttribute);
        if (withState || childrenWithState) {
          result.withState = true;
        }
        result.children.push({
          name,
          props: { ...hydratedProps, ...props },
          children: optimizeChildren(children),
        });
      } else {
        if (Object.keys(props).length > 0) {
          throw new Error(
            `<${schema.slotTagName}> only allowed as direct child of <${schema.componentTagName}>`,
          );
        }
        if (tagName == schema.slotTagName) {
          const name = childNode.getAttribute(schema.nameAttribute);
          if (!name) {
            throw new Error(
              `Missing "${schema.nameAttribute}" attribute on <${schema.slotTagName}>`,
            );
          }
          if (children.length == 1) {
            const child = children[0];
            if (typeof child == 'string') {
              result.props[name] = {
                name: 'Fragment',
                props: {},
                children: child,
              };
            } else {
              result.props[name] = child;
            }
          } else {
            result.props[name] = {
              name: 'Fragment',
              props: {},
              children,
            };
          }
        } else {
          result.children.push({
            tagName,
            attributes: Array.from(childNode.attributes).reduce(
              (attrs, attr) => ({ ...attrs, [attr.name]: attr.value }),
              {},
            ),
            children: optimizeChildren(children),
          });
        }
      }
    }
  });
  return result;
}

function optimizeChildren(children: Child[]): Child | Child[] | undefined {
  switch (children.length) {
    case 0:
      return undefined;
    case 1:
      return children[0];
    default:
      return children;
  }
}

function decodeProps(props: string): ReactComponent['props'] {
  return JSON.parse(htmlDecode(props));
}

function hydrateProps(
  childNode: HTMLElement,
  propsAttribute: string,
): [props: ReactComponent['props'], withState: boolean] {
  const serializedProps = childNode.getAttribute(propsAttribute);
  const withState = serializedProps ? statePropTypeRegExp.test(serializedProps) : false;
  return [serializedProps ? decodeProps(serializedProps) : {}, withState];
}

function createElementOrComponent(
  child: ReactElement | ReactComponent,
  manifest: Manifest,
  state: State,
): JSX.Element {
  const children = Array.isArray(child.children)
    ? child.children.map((child) => createChild(child, manifest, state))
    : child.children
      ? [createChild(child.children, manifest, state)]
      : [];

  if ('tagName' in child) {
    const attributes = Object.fromEntries(
      Object.entries(child.attributes).map(([key, value]) => {
        const attrName = transformAttributeName(key);
        const attrValue = transformAttributeValue(key, value, state);
        if (attrName.match(/^on[A-Z]/) && typeof attrValue != 'function') {
          throw new Error(`Event handler must be a function: ${key}`);
        }
        return [attrName, attrValue];
      }),
    );
    return createElement(child.tagName, attributes, ...children);
  }
  const ComponentImpl = child.name == 'Fragment' ? Fragment : manifest[child.name];
  if (!ComponentImpl) {
    throw new Error(`Unknown component: ${child.name}`);
  }
  const props: { [key: string]: ReactValue } = Object.fromEntries(
    Object.entries(child.props).map(([key, value]) => {
      const propName = transformPropName(key);
      if (isReactElement(value) || isReactComponent(value)) {
        return [propName, createElementOrComponent(value, manifest, state)];
      }
      const propValue = transformPropValue(value, state);
      if (propName.match(/^on[A-Z]/) && typeof propValue != 'function') {
        throw new Error(`Event handler must be a function: ${key}`);
      }
      return [propName, propValue];
    }),
  );
  return createElement(ComponentImpl, props, ...children);
}

function createChild(child: Child, manifest: Manifest, state: State): JSX.Element | string {
  if (typeof child == 'string') {
    return child;
  }
  return createElementOrComponent(child, manifest, state);
}

function transformAttributeName(name: string) {
  const attributeName = cebabCase(name);
  if (attributeMap[attributeName]) {
    return attributeMap[attributeName];
  } else if (attributeName.startsWith('aria-')) {
    return attributeName;
  }
  return camelcase(attributeName);
}

function transformAttributeValue(name: string, value: string, state: State) {
  if (name == 'style') {
    return parseStyleAttribute(value);
  }
  if (booleanAttribute.includes(name)) {
    return value != 'false' && value != 'off' && value != '0';
  }
  return transformStringValue(value, state);
}

function transformPropName(name: string) {
  if (defaultAttributeMap[name]) {
    return name;
  }
  return transformAttributeName(name);
}

function transformPropValue(value: JSONValue, state: State): ReactValue {
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, value]) => [key, transformPropValue(value, state)]),
    );
  }
  if (Array.isArray(value)) {
    return value.map((value) => transformPropValue(value, state));
  }
  if (typeof value == 'string') {
    return transformStringValue(value, state);
  }
  return value;
}

function getEventValue(eventOrValue: Event | ReactValue): ReactValue {
  if (eventOrValue instanceof Event) {
    const target = eventOrValue.target;
    if (target instanceof HTMLInputElement) {
      if (target.type == 'checkbox') {
        return target.checked;
      } else {
        return target.value;
      }
    } else if (target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
      return target.value;
    } else if (eventOrValue instanceof CustomEvent) {
      return eventOrValue.detail;
    }
    throw new Error('Unsupported event type');
  }
  return eventOrValue;
}

function transformStringValue(value: string, state: State): ReactValue {
  if (value[0] == '$') {
    switch (value[1]) {
      case '$':
        // This was an escaped string value.
        return value.slice(1);
      case 'D':
        // Date
        return new Date(Date.parse(value.slice(2)));
      case 'n':
        // BigInt
        return BigInt(value.slice(2));
    }
  } else if (value.startsWith('react:')) {
    const url = new URL(value);
    const { pathname, searchParams } = url;
    const key = searchParams.get('key');
    if (key) {
      switch (pathname) {
        case 'state/get':
          return state.get(key, searchParams.get('defaultValue'));
        case 'state/set':
          return (value: ReactValue | Event) => {
            state.set(key, getEventValue(value));
          };
        case 'state/observe':
          return state.observe(key);
      }
    }
    throw new Error(`Unsupported react: URL: ${value}`);
  }
  return value;
}

const statePropTypeRegExp = /"react:state\/(get|set|observe)\?/;

const reactAttributeMap: Record<string, string> = {
  'accept-charset': 'acceptCharset',
  accesskey: 'accessKey',
  allowfullscreen: 'allowFullScreen',
  allowtransparency: 'allowTransparency',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  autoplay: 'autoPlay',
  cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing',
  charset: 'charSet',
  class: 'className',
  colspan: 'colSpan',
  contenteditable: 'contentEditable',
  contextmenu: 'contextMenu',
  crossorigin: 'crossOrigin',
  datetime: 'dateTime',
  enctype: 'encType',
  formaction: 'formAction',
  formenctype: 'formEncType',
  formmethod: 'formMethod',
  formnovalidate: 'formNoValidate',
  formtarget: 'formTarget',
  frameborder: 'frameBorder',
  hreflang: 'hrefLang',
  for: 'htmlFor',
  inputmode: 'inputMode',
  tabindex: 'tabIndex',
  usemap: 'useMap',
  maxlength: 'maxLength',
  minlength: 'minLength',
  readonly: 'readOnly',
  srcdoc: 'srcDoc',
  srclang: 'srcLang',
  srcset: 'srcSet',
  spellcheck: 'spellCheck',
};

const defaultAttributeMap: Record<string, string> = {
  value: 'defaultValue',
  checked: 'defaultChecked',
  selected: 'defaultSelected',
};

const attributeMap = { ...reactAttributeMap, ...defaultAttributeMap };

const booleanAttribute = [
  'allowfullscreen',
  'autofocus',
  'checked',
  'disabled',
  'formnovalidate',
  'hidden',
  'multiple',
  'novalidate',
  'readonly',
  'required',
  'selected',
];

const isElementNode = (node: Node): node is HTMLElement => node.nodeType == Node.ELEMENT_NODE;
const isTextNode = (node: Node): node is Text => node.nodeType == Node.TEXT_NODE;

function parseStyleAttribute(styleString: string): Record<string, string> {
  return Object.fromEntries(
    styleString
      .split(';')
      .filter((pair) => !!pair.trim())
      .map((pair) => {
        const [key, value] = pair.split(':');
        if (key && value) {
          return [camelcase(key).trim(), value.trim()];
        }
        throw new Error(`Invalid style attribute: ${styleString}`);
      }),
  );
}

function camelcase(str: string) {
  return str.replace(/-([a-z])/g, ([, a]) => a.toUpperCase());
}

function cebabCase(str: string) {
  return str.replace(/_/g, '-');
}

function isPlainObject(value: JSONValue): value is { [key: string]: JSONValue } {
  return typeof value == 'object' && value != null && value.constructor == Object;
}
