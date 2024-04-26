import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { parseHTMLFragment } from '@coldwired/utils';
import { z } from 'zod';

import {
  createReactTree,
  hydrate,
  NAME_ATTRIBUTE,
  REACT_COMPONENT_TAG,
  REACT_SLOT_TAG,
} from './react-tree-builder';

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

describe('@coldwired/react', () => {
  describe('createReactTree', () => {
    it('render simple tree', () => {
      const tree = createReactTree(
        { tagName: 'div', attributes: { className: 'title' }, children: 'Hello' },
        {},
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
      const greeting1 = `<${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Greeting" first_name="John" last_name="Doe"></${REACT_COMPONENT_TAG}>`;
      const greeting2 = `<${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Greeting" first-name="Greer" last-name="Pilkington"></${REACT_COMPONENT_TAG}>`;
      const fieldset1 = `<${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="FieldSet" lang="fr" legend="Test">Hello World</${REACT_COMPONENT_TAG}>`;
      const fieldset2 = `<${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="FieldSet" lang="en"><${REACT_SLOT_TAG} ${NAME_ATTRIBUTE}="legend"><span class="blue">Test</span></${REACT_SLOT_TAG}>${greeting2}</${REACT_COMPONENT_TAG}>`;

      const tree = hydrate(
        parseHTMLFragment(`${greeting1}<form>${fieldset1}${fieldset2}</form>`, document),
        {
          Greeting,
          FieldSet,
        },
      );
      const html = renderToStaticMarkup(tree);
      expect(html).toBe(
        '<p>Bonjour John Doe !</p><form><fieldset lang="fr"><legend>Test</legend>Hello World</fieldset><fieldset lang="en"><legend><span class="blue">Test</span></legend><p>Bonjour Greer Pilkington !</p></fieldset></form>',
      );
    });

    it('deserialize values', () => {
      const html = `<${REACT_COMPONENT_TAG} ${NAME_ATTRIBUTE}="Greeting" string="$$toto" int="$i42" float="$f42.1" boolt="$btrue" boolf="$bfalse" date="$D${new Date().toISOString()}" ></${REACT_COMPONENT_TAG}>`;
      const tree = hydrate(parseHTMLFragment(html, document), { Greeting });

      const result = z
        .object({
          props: z.object({
            children: z
              .object({
                props: z.object({
                  string: z.string(),
                  int: z.number(),
                  float: z.number(),
                  boolt: z.boolean(),
                  boolf: z.boolean(),
                  date: z.date(),
                }),
              })
              .array(),
          }),
        })
        .safeParse(tree);
      expect(result.data?.props.children[0].props).toEqual({
        string: '$toto',
        int: 42,
        float: 42.1,
        boolt: true,
        boolf: false,
        date: expect.any(Date),
      });
    });
  });
});
