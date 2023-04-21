export type Schema = {
  forceAttribute: string;
  permanentAttribute: string;
  focusAttribute: string;
  hiddenClassName: string;
};

export const defaultSchema: Schema = {
  forceAttribute: 'data-turbo-force',
  permanentAttribute: 'data-turbo-permanent',
  focusAttribute: 'data-turbo-focus',
  hiddenClassName: 'hidden',
};
