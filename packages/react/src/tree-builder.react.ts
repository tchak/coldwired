import { decode as htmlDecode } from 'html-entities';
import type { ComponentType, JSX } from 'react';
import { createElement, Fragment } from 'react';

import { defaultSchema } from './preload';

export type Child = string | ReactElement | ReactComponent;
type PrimitiveValue = string | number | boolean | null | undefined;
type JSONValue = PrimitiveValue | Array<JSONValue> | { [key: string]: JSONValue };
export type ReactValue =
  | PrimitiveValue
  | Date
  | bigint
  | Array<ReactValue>
  | { [key: string]: ReactValue };
export type ReactElement = {
  tagName: string;
  attributes: Record<string, string>;
  children?: Child[];
};
export type ReactComponent = {
  name: string;
  props: Record<string, JSONValue | ReactElement | ReactComponent>;
  children?: Child[];
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

export function hydrate(
  documentOrFragment: Document | DocumentFragmentLike,
  manifest: Manifest,
  schema?: Partial<Schema>,
): JSX.Element {
  const childNodes = getChildNodes(documentOrFragment);
  const { children: tree } = hydrateChildNodes(
    childNodes,
    Object.assign({}, defaultSchema, schema),
  );
  return createReactTree(tree, manifest);
}

export function createReactTree(tree: Child | Child[], manifest: Manifest): JSX.Element {
  if (Array.isArray(tree)) {
    return createElement(Fragment, null, ...tree.map((child) => createChild(child, manifest)));
  } else if (typeof tree == 'string') {
    return createElement(Fragment, null, tree);
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

function hydrateChildNodes(childNodes: NodeListOf<ChildNode>, schema: Schema): HydrateResult {
  const result: HydrateResult = { children: [], props: {} };
  childNodes.forEach((childNode) => {
    if (isTextNode(childNode)) {
      const text = childNode.textContent;
      if (text?.trim()) {
        result.children.push(text);
      }
    } else if (isElementNode(childNode)) {
      const tagName = childNode.tagName.toLowerCase();
      const { children, props } = hydrateChildNodes(childNode.childNodes, schema);
      if (tagName == schema.componentTagName) {
        const name = childNode.getAttribute(schema.nameAttribute);
        if (!name) {
          throw new Error(
            `Missing "${schema.nameAttribute}" attribute on <${schema.componentTagName}>`,
          );
        }
        const hydratedProps = hydrateProps(childNode, schema.propsAttribute);
        result.children.push({
          name,
          props: { ...hydratedProps, ...props },
          children,
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
                children: [child],
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
            children,
          });
        }
      }
    }
  });
  return result;
}

function decodeProps(props: string): ReactComponent['props'] {
  return JSON.parse(htmlDecode(props));
}

function hydrateProps(childNode: HTMLElement, propsAttribute: string): ReactComponent['props'] {
  const serializedProps = childNode.getAttribute(propsAttribute);
  return serializedProps ? decodeProps(serializedProps) : {};
}

function createElementOrComponent(
  child: ReactElement | ReactComponent,
  manifest: Manifest,
): JSX.Element {
  if ('tagName' in child) {
    const attributes = Object.fromEntries(
      Object.entries(child.attributes).map(([key, value]) => {
        const attrName = transformAttributeName(key);
        const attrValue = transformAttributeValue(key, value);
        if (attrName.match(/^on[A-Z]/) && typeof attrValue != 'function') {
          throw new Error(`Event handler must be a function: ${key}`);
        }
        return [attrName, attrValue];
      }),
    );
    const children = child.children?.map((child) => createChild(child, manifest)) || [];
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
        return [propName, createElementOrComponent(value, manifest)];
      }
      const propValue = transformPropValue(value);
      if (propName.match(/^on[A-Z]/) && typeof propValue != 'function') {
        throw new Error(`Event handler must be a function: ${key}`);
      }
      return [propName, propValue];
    }),
  );
  const children = child.children?.map((child) => createChild(child, manifest)) || [];
  return createElement(ComponentImpl, props, ...children);
}

function createChild(child: Child, manifest: Manifest): JSX.Element | string {
  if (typeof child == 'string') {
    return child;
  }
  return createElementOrComponent(child, manifest);
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

function transformAttributeValue(name: string, value: string): ReactValue {
  if (name == 'style') {
    return parseStyleAttribute(value);
  }
  if (booleanAttribute.includes(name)) {
    return value != 'false' && value != 'off' && value != '0';
  }
  return transformStringValue(value);
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
    return value.map((value) => transformPropValue(value));
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
