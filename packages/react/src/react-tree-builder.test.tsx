import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { parseHTMLFragment } from '@coldwired/utils';
import { z } from 'zod';
import { encode as htmlEncode } from 'html-entities';

import {
  createReactTree,
  hydrate,
  preload,
  defaultSchema,
  createNullState,
  type ReactComponent,
} from './react-tree-builder';

const NAME_ATTRIBUTE = defaultSchema.nameAttribute;
const PROPS_ATTRIBUTE = defaultSchema.propsAttribute;
const REACT_COMPONENT_TAG = defaultSchema.componentTagName;
const REACT_SLOT_TAG = defaultSchema.slotTagName;

function encodeProps(props: ReactComponent['props']): string {
  return htmlEncode(JSON.stringify(props));
}

function Greeting({ firstName, lastName }: { firstName: string; lastName: string }) {
  return (
    <p>
      Bonjour {firstName} {lastName} !
    </p>
  );
}

function FieldSet({
  children,
  legend,
  lang,
}: {
  children: ReactNode;
  legend: ReactNode;
  lang: string;
}) {
  return (
    <fieldset lang={lang}>
      <legend>{legend}</legend>
      {children}
    </fieldset>
  );
}

function Button({ children }: { children: ReactNode }) {
  return <button>{children}</button>;
}

function Box({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

describe('@coldwired/react', () => {
  describe('createReactTree', () => {
    it('render simple tree', () => {
      const tree = createReactTree(
        { tagName: 'div', attributes: { className: 'title' }, children: 'Hello' },
        {},
        createNullState(),
      );
      const html = renderToStaticMarkup(tree);
      expect(html).toBe('<div class="title">Hello</div>');
    });

    it('render complex tree', () => {
      const tree = createReactTree(
        {
          tagName: 'div',
          attributes: { className: 'container' },
          children: [
            { tagName: 'h1', attributes: {}, children: 'Title' },
            'Hello ',
            'World',
            { tagName: 'input', attributes: { defaultValue: 'test', maxLength: '2' } },
          ],
        },
        {},
        createNullState(),
      );
      const html = renderToStaticMarkup(tree);
      expect(html).toBe(
        '<div class="container"><h1>Title</h1>Hello World<input maxLength="2" value="test"/></div>',
      );
    });

    it('render component', () => {
      const tree = createReactTree(
        [
          {
            name: 'Greeting',
            props: { firstName: 'John', lastName: 'Doe' },
          },
          {
            tagName: 'form',
            attributes: {},
            children: [
              {
                name: 'FieldSet',
                props: {
                  lang: 'fr',
                  legend: 'Test',
                },
                children: 'Hello World',
              },
              {
                name: 'FieldSet',
                props: {
                  lang: 'en',
                  legend: { tagName: 'span', attributes: { className: 'blue' }, children: 'Test' },
                },
                children: [
                  {
                    name: 'Greeting',
                    props: { firstName: 'Greer', lastName: 'Pilkington' },
                  },
                ],
              },
            ],
          },
        ],
        { Greeting, FieldSet },
        createNullState(),
      );
      const html = renderToStaticMarkup(tree);
      expect(html).toBe(
        '<p>Bonjour John Doe !</p><form><fieldset lang="fr"><legend>Test</legend>Hello World</fieldset><fieldset lang="en"><legend><span class="blue">Test</span></legend><p>Bonjour Greer Pilkington !</p></fieldset></form>',
      );
    });
  });

  describe('hydrate', () => {
    it('hydrate simple tree', async () => {
      const fragment = parseHTMLFragment('<div class="title">Hello</div>', document);
      const tree = hydrate(fragment, {});
      const html = renderToStaticMarkup(tree);
      expect(html).toBe('<div class="title">Hello</div>');
    });

    it('render complex tree', () => {
      const fragment = parseHTMLFragment(
        '<div class="container"><h1>Title</h1>Hello World<input maxLength="2" autofocus value="test"/></div>',
        document,
      );
      const tree = hydrate(fragment, {});
      const html = renderToStaticMarkup(tree);
      expect(html).toBe(
        '<div class="container"><h1>Title</h1>Hello World<input maxLength="2" autofocus="" value="test"/></div>',
      );
    });

    it('render component', () => {
      const greeting1 = `<${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Greeting" ${PROPS_ATTRIBUTE}="${encodeProps({ first_name: 'John', last_name: 'Doe' })}"></${REACT_COMPONENT_TAG}>`;
      const greeting2 = `<${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Greeting" ${PROPS_ATTRIBUTE}="${encodeProps({ ['first-name']: 'Greer', ['last-name']: 'Pilkington' })}"></${REACT_COMPONENT_TAG}>`;
      const fieldset1 = `<${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="FieldSet" ${PROPS_ATTRIBUTE}="${encodeProps({ lang: 'fr', legend: 'Test' })}">Hello World</${REACT_COMPONENT_TAG}>`;
      const fieldset2 = `<${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="FieldSet" ${PROPS_ATTRIBUTE}="${encodeProps({ lang: 'en' })}"><${REACT_SLOT_TAG} ${NAME_ATTRIBUTE}="legend"><span class="blue">Test</span></${REACT_SLOT_TAG}>${greeting2}</${REACT_COMPONENT_TAG}>`;
      const button = `<${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Button">Click me</${REACT_COMPONENT_TAG}>`;
      const box = `<${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Box">${button}</${REACT_COMPONENT_TAG}>`;

      const tree = hydrate(
        parseHTMLFragment(`${greeting1}<form>${fieldset1}${fieldset2}</form>${box}`, document),
        {
          Greeting,
          FieldSet,
          Button,
          Box,
        },
      );
      const html = renderToStaticMarkup(tree);
      expect(html).toBe(
        '<p>Bonjour John Doe !</p><form><fieldset lang="fr"><legend>Test</legend>Hello World</fieldset><fieldset lang="en"><legend><span class="blue">Test</span></legend><p>Bonjour Greer Pilkington !</p></fieldset></form><div><button>Click me</button></div>',
      );
    });

    it('deserialize values', () => {
      const html = `<${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Greeting" ${PROPS_ATTRIBUTE}="${encodeProps({ string: '$$toto', date: `$D${new Date().toISOString()}`, bigInt: '$n389474656382938746542635' })}" ></${REACT_COMPONENT_TAG}>`;
      const tree = hydrate(parseHTMLFragment(html, document), { Greeting });

      const result = z
        .object({
          props: z.object({
            children: z.object({
              props: z.object({
                string: z.string(),
                date: z.date(),
                bigInt: z.bigint(),
              }),
            }),
          }),
        })
        .safeParse(tree);
      expect(result.data?.props.children.props).toEqual({
        string: '$toto',
        date: expect.any(Date),
        bigInt: BigInt('389474656382938746542635'),
      });
    });
  });

  describe('preload', () => {
    it('preload components', async () => {
      const greeting1 = `<${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Greeting" ${PROPS_ATTRIBUTE}=${encodeProps({ first_name: 'John', last_name: 'Doe' })}></${REACT_COMPONENT_TAG}>`;
      const greeting2 = `<${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Greeting" ${PROPS_ATTRIBUTE}=${encodeProps({ ['first-name']: 'Greer', ['last-name']: 'Pilkington' })}></${REACT_COMPONENT_TAG}>`;
      const fieldset1 = `<${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="FieldSet" ${PROPS_ATTRIBUTE}=${encodeProps({ lang: 'fr', legend: 'Test' })}>Hello World</${REACT_COMPONENT_TAG}>`;
      const fieldset2 = `<${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="FieldSet" ${PROPS_ATTRIBUTE}=${encodeProps({ lang: 'en' })}><${REACT_SLOT_TAG} ${NAME_ATTRIBUTE}="legend"><span class="blue">Test</span></${REACT_SLOT_TAG}>${greeting2}</${REACT_COMPONENT_TAG}>`;
      const button = `<${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Button">Click me</${REACT_COMPONENT_TAG}>`;
      const box = `<${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Box">${button}</${REACT_COMPONENT_TAG}>`;

      const components: Record<string, any> = {
        Greeting,
        FieldSet,
        Button,
        Box,
      };

      const manifest = await preload(
        parseHTMLFragment(`${greeting1}<form>${fieldset1}${fieldset2}</form>${box}`, document),
        async (names) => Object.fromEntries(names.map((name) => [name, components[name]])),
      );
      expect(manifest).toStrictEqual(components);
    });
  });
});
