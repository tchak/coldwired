import type { ComponentType, ReactNode, Key } from 'react';
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
): ReactNode {
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
): ReactNode {
  if (Array.isArray(tree)) {
    return createElement(
      Fragment,
      {},
      tree.map((child, i) => createChild(child, manifest, state, i)),
    );
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
  key?: Key,
): ReactNode {
  if ('tagName' in child) {
    const attributes = Object.fromEntries(
      Object.entries(child.attributes).map(([key, value]) => [
        transformAttributeName(key),
        transformAttributeValue(key, value),
      ]),
    );
    attributes.key = attributes.id ?? key;
    return createElement(
      child.tagName,
      attributes,
      Array.isArray(child.children)
        ? child.children.map((child, i) => createChild(child, manifest, state, i))
        : child.children
          ? createChild(child.children, manifest, state)
          : undefined,
    );
  }
  const ComponentImpl = child.name == 'Fragment' ? Fragment : manifest[child.name];
  if (!ComponentImpl) {
    throw new Error(`Unknown component: ${child.name}`);
  }
  const props: { [key: string]: ReactValue } = Object.fromEntries(
    Object.entries(child.props).map(([key, value]) => {
      if (isReactElement(value) || isReactComponent(value)) {
        return [transformPropName(key), createElementOrComponent(value, manifest, state)];
      }
      return [transformPropName(key), transformPropValue(value, state)];
    }),
  );
  props.key = props.id ?? key;
  return createElement(
    ComponentImpl,
    props,
    Array.isArray(child.children)
      ? child.children.map((child, i) => createChild(child, manifest, state, i))
      : child.children
        ? createChild(child.children, manifest, state)
        : undefined,
  );
}

function createChild(
  child: Child,
  manifest: Manifest,
  state: State,
  key?: Key,
): ReactNode | string {
  if (typeof child == 'string') {
    return child;
  }
  return createElementOrComponent(child, manifest, state, key);
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

function transformAttributeValue(name: string, value: string) {
  if (name == 'style') {
    return parseStyleAttribute(value);
  }
  if (booleanAttribute.includes(name)) {
    return value != 'false' && value != 'off' && value != '0';
  }
  return value;
}

function transformPropName(name: string) {
  if (defaultAttributeMap[name]) {
    return name;
  }
  return transformAttributeName(name);
}

function transformPropValue(value: JSONValue, state: State): ReactValue {
  if (isPlainObject(value)) {
    const obj = Object.fromEntries(
      Object.entries(value).map(([key, value]) => [key, transformPropValue(value, state)]),
    );
    if (isStateProp(obj)) {
      switch (obj.__type__) {
        case StatePropType.SET:
          return (value: ReactValue | Event) => {
            state.set(obj.key, getEventValue(value));
          };
        case StatePropType.GET:
          return state.get(obj.key, obj.defaultValue);
        case StatePropType.OBSERVE:
          return state.observe(obj.key);
      }
    }
    return obj;
  }
  if (Array.isArray(value)) {
    return value.map((value) => transformPropValue(value, state));
  }
  if (typeof value == 'string') {
    return transformStringValue(value);
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
    } else if (eventOrValue instanceof CustomEvent) {
      return eventOrValue.detail;
    }
    throw new Error('Unsupported event type');
  }
  return eventOrValue;
}

function transformStringValue(value: string): ReactValue {
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
  }
  return value;
}

enum StatePropType {
  GET = '__get__',
  SET = '__set__',
  OBSERVE = '__observe__',
}
const statePropTypeSet = new Set(Object.values(StatePropType).map(String));
const statePropTypeRegExp = new RegExp(
  `"__type__":"(${StatePropType.GET}|${StatePropType.SET}|${StatePropType.OBSERVE})"`,
);
type StateProp =
  | {
      __type__: StatePropType.SET;
      key: string;
    }
  | {
      __type__: StatePropType.GET;
      key: string;
      defaultValue?: ReactValue;
    }
  | {
      __type__: StatePropType.OBSERVE;
      key: string;
    };

function isStateProp(value: { [key: string]: ReactValue }): value is StateProp {
  const type = value['__type__'];
  return typeof type == 'string' && statePropTypeSet.has(type);
}

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
