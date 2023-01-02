export type Schema = {
  forceAttribute: string;
  hiddenClassName: string;
};

export const defaultSchema: Schema = {
  forceAttribute: 'data-turbo-force',
  hiddenClassName: 'hidden',
};
