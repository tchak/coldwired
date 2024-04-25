export type Schema = {
  fragmentTagName: string;
  forceAttribute: string;
  focusGroupAttribute: string;
  focusDirectionAttribute: string;
  hiddenClassName: string;
  loadingClassName: string;
};

export const defaultSchema: Schema = {
  fragmentTagName: 'turbo-fragment',
  forceAttribute: 'data-turbo-force',
  focusGroupAttribute: 'data-turbo-focus-group',
  focusDirectionAttribute: 'data-turbo-focus-direction',
  hiddenClassName: 'hidden',
  loadingClassName: 'loading',
};
