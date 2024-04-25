import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { parseHTMLFragment } from '@coldwired/utils';

import { createReactTree, hydrate, NAME_ATTRIBUTE } from './react-tree-builder';

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
      const greeting1 = `<react-component ${NAME_ATTRIBUTE}="Greeting" first_name="John" last_name="Doe"></react-component>`;
      const greeting2 = `<react-component ${NAME_ATTRIBUTE}="Greeting" first-name="Greer" last-name="Pilkington"></react-component>`;
      const fieldset1 = `<react-component ${NAME_ATTRIBUTE}="FieldSet" lang="fr" legend="Test">Hello World</react-component>`;
      const fieldset2 = `<react-component ${NAME_ATTRIBUTE}="FieldSet" lang="en"><react-slot ${NAME_ATTRIBUTE}="legend"><span class="blue">Test</span></react-slot>${greeting2}</react-component>`;

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
  });
});
