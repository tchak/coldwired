export type Schema = {
  forceAttribute: string;
  permanentAttribute: string;
  hiddenClassName: string;
};

export const defaultSchema: Schema = {
  forceAttribute: 'data-turbo-force',
  permanentAttribute: 'data-turbo-permanent',
  hiddenClassName: 'hidden',
};
