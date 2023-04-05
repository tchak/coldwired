export type Schema = {
  forceAttribute: string;
  focusAttribute: string;
  hiddenClassName: string;
};

export const defaultSchema: Schema = {
  forceAttribute: 'data-turbo-force',
  focusAttribute: 'data-turbo-focus',
  hiddenClassName: 'hidden',
};
