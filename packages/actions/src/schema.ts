export type Schema = {
  forceAttribute: string;
  focusGroupAttribute: string;
  focusDirectionAttribute: string;
  permanentAttribute: string;
  hiddenClassName: string;
};

export const defaultSchema: Schema = {
  forceAttribute: 'data-turbo-force',
  focusGroupAttribute: 'data-turbo-focus-group',
  focusDirectionAttribute: 'data-turbo-focus-direction',
  permanentAttribute: 'data-turbo-permanent',
  hiddenClassName: 'hidden',
};
