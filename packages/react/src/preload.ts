import type { DocumentFragmentLike, Manifest, Schema } from './tree-builder.react';

export const defaultSchema: Schema = {
  componentTagName: 'react-component',
  slotTagName: 'react-slot',
  nameAttribute: 'name',
  propsAttribute: 'props',
};

export function preload(
  documentOrFragment: Document | DocumentFragmentLike,
  loader: (names: string[]) => Promise<Manifest>,
  schema?: Partial<Schema>,
): Promise<Manifest> {
  const { componentTagName, nameAttribute } = Object.assign({}, defaultSchema, schema);
  const components = documentOrFragment.querySelectorAll(componentTagName);
  const componentNames = new Set(
    Array.from(components).map((component) => {
      const name = component.getAttribute(nameAttribute);
      if (!name) {
        throw new Error(`Missing "${nameAttribute}" attribute on <${componentTagName}>`);
      }
      return name;
    }),
  );
  return loader([...componentNames]);
}
