import { createElement, Fragment, type ComponentType, type ReactNode, type Key } from 'react';
import { decode as htmlDecode, encode as htmlEncode } from 'html-entities';

type Child = string | Element | Component;
type PrimitiveValue = string | number | boolean | null | undefined;
type JSONValue = PrimitiveValue | Array<JSONValue> | { [key: string]: JSONValue };
type ReactValue =
  | PrimitiveValue
  | Date
  | bigint
  | Array<ReactValue>
  | { [key: string]: ReactValue };
type Element = {
  tagName: string;
  attributes: Record<string, string>;
  children?: Child | Child[];
};
type Component = {
  name: string;
  props: Record<string, JSONValue | Element | Component>;
  children?: Child | Child[];
};
export type Manifest = Record<string, ComponentType<any>>;

export const NAME_ATTRIBUTE = '@name';
export const PROPS_ATTRIBUTE = '@props';
export const REACT_COMPONENT_TAG = 'react-component';
export const REACT_SLOT_TAG = 'react-slot';

function isElement(node: JSONValue | Element | Component): node is Element {
  return !!(node && typeof node == 'object' && 'tagName' in node && 'attributes' in node);
}

function isComponent(node: JSONValue | Element | Component): node is Component {
  return !!(node && typeof node == 'object' && NAME_ATTRIBUTE in node && PROPS_ATTRIBUTE in node);
}

export type DocumentFragmentLike = DocumentFragment | { childNodes: NodeListOf<ChildNode> };

export function hydrate(
  documentOrFragment: Document | DocumentFragmentLike,
  manifest: Manifest,
): ReactNode {
  const childNodes = getChildNodes(documentOrFragment);
  const { children } = hydrateChildNodes(childNodes);
  return createReactTree(children, manifest);
}

export function preload(
  documentOrFragment: Document | DocumentFragmentLike,
  loader: (names: string[]) => Promise<Manifest>,
): Promise<Manifest> {
  const childNodes = getChildNodes(documentOrFragment);
  const componentNames = [
    ...new Set(
      Array.from(childNodes).flatMap((childNode) => {
        if (isElementNode(childNode)) {
          if (childNode.tagName.toLowerCase() == REACT_COMPONENT_TAG) {
            return childNode.getAttribute(NAME_ATTRIBUTE)!;
          }
          return Array.from(childNode.querySelectorAll(REACT_COMPONENT_TAG)).map(
            (element) => element.getAttribute(NAME_ATTRIBUTE)!,
          );
        }
        return [];
      }),
    ),
  ];
  return loader(componentNames);
}

export function createReactTree(tree: Child | Child[], manifest: Manifest): ReactNode {
  if (Array.isArray(tree)) {
    return createElement(
      Fragment,
      {},
      tree.map((child, i) => createChild(child, manifest, i)),
    );
  } else if (typeof tree == 'string') {
    return createElement(Fragment, {}, tree);
  }
  return createElementOrComponent(tree, manifest);
}

function getChildNodes(documentOrFragment: Document | DocumentFragmentLike) {
  return 'body' in documentOrFragment
    ? documentOrFragment.body.childNodes
    : documentOrFragment.childNodes;
}

type HydrateResult = {
  children: Child[];
  props: Record<string, Child>;
};

function hydrateChildNodes(childNodes: NodeListOf<ChildNode>): HydrateResult {
  const result: HydrateResult = { children: [], props: {} };
  childNodes.forEach((childNode) => {
    if (isTextNode(childNode) && childNode.textContent) {
      result.children.push(childNode.textContent);
    } else if (isElementNode(childNode)) {
      const tagName = childNode.tagName.toLowerCase();
      const { children, props } = hydrateChildNodes(childNode.childNodes);
      if (tagName == REACT_COMPONENT_TAG) {
        const name = childNode.getAttribute(NAME_ATTRIBUTE);
        if (!name) {
          throw new Error(`Missing "${NAME_ATTRIBUTE}" attribute on <${REACT_COMPONENT_TAG}>`);
        }
        result.children.push({
          name,
          props: { ...hydrateProps(childNode), ...props },
          children: children.length > 0 ? children : undefined,
        });
      } else {
        if (Object.keys(props).length > 0) {
          throw new Error('<react-slot> only allowed as direct child of <${REACT_COMPONENT_TAG}>');
        }
        if (tagName == REACT_SLOT_TAG) {
          const name = childNode.getAttribute(NAME_ATTRIBUTE);
          if (!name) {
            throw new Error(`Missing "${NAME_ATTRIBUTE}" attribute on <${REACT_SLOT_TAG}>`);
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
            children: children.length > 0 ? children : undefined,
          });
        }
      }
    }
  });
  return result;
}

export function encodeProps(props: Component['props']): string {
  return htmlEncode(JSON.stringify(props));
}

export function decodeProps(props: string): Component['props'] {
  return JSON.parse(htmlDecode(props));
}

function hydrateProps(childNode: HTMLElement): Component['props'] {
  const serializedProps = childNode.getAttribute(PROPS_ATTRIBUTE);
  const props = Object.fromEntries(
    Array.from(childNode.attributes)
      .filter((attr) => attr.name != NAME_ATTRIBUTE && attr.name != PROPS_ATTRIBUTE)
      .map((attr) => [attr.name, attr.value]),
  );
  return Object.assign(props, serializedProps ? decodeProps(serializedProps) : {});
}

function createElementOrComponent(
  child: Element | Component,
  manifest: Manifest,
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
        ? child.children.map((child, i) => createChild(child, manifest, i))
        : child.children
          ? createChild(child.children, manifest)
          : undefined,
    );
  }
  const ComponentImpl = child.name == 'Fragment' ? Fragment : manifest[child.name];
  if (!ComponentImpl) {
    throw new Error(`Unknown component: ${child.name}`);
  }
  const props: { [key: string]: ReactValue } = Object.fromEntries(
    Object.entries(child.props).map(([key, value]) => {
      if (isElement(value) || isComponent(value)) {
        return [transformPropName(key), createElementOrComponent(value, manifest)];
      }
      return [transformPropName(key), transformPropValue(value)];
    }),
  );
  props.key = props.id ?? key;
  return createElement(
    ComponentImpl,
    props,
    Array.isArray(child.children)
      ? child.children.map((child, i) => createChild(child, manifest, i))
      : child.children
        ? createChild(child.children, manifest)
        : undefined,
  );
}

function createChild(child: Child, manifest: Manifest, key?: Key): ReactNode | string {
  if (typeof child == 'string') {
    return child;
  }
  return createElementOrComponent(child, manifest, key);
}

function transformAttributeName(name: string) {
  const name_ = cebabCase(name);
  if (attributeMap[name_]) {
    return attributeMap[name_];
  } else if (name_.startsWith('aria-')) {
    return name_;
  }
  return camelcase(name_);
}

function transformAttributeValue(name: string, value: string) {
  if (name == 'style') {
    return parseStyleAttribute(value);
  }
  if (booleanAttribute.includes(name)) {
    return value == name || value == 'true' || value == '1' || value == '';
  }
  return value;
}

function transformPropName(name: string) {
  if (defaultAttributeMap[name]) {
    return name;
  }
  return transformAttributeName(name);
}

function transformPropValue(value: JSONValue): ReactValue {
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, value]) => [key, transformPropValue(value)]),
    );
  }
  if (Array.isArray(value)) {
    return value.map(transformPropValue);
  }
  if (typeof value == 'string') {
    return transformStringValue(value);
  }
  return value;
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
