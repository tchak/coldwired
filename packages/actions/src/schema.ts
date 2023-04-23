export type Schema = {
  forceAttribute: string;
  focusGroupAttribute: string;
  permanentAttribute: string;
  hiddenClassName: string;
};

export const defaultSchema: Schema = {
  forceAttribute: 'data-turbo-force',
  focusGroupAttribute: 'data-turbo-focus-group',
  permanentAttribute: 'data-turbo-permanent',
  hiddenClassName: 'hidden',
};
