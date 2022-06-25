export type Schema = {
  enabledAttribute: string;
  navigationStateAttribute: string;
  fetcherStateAttribute: string;
  revalidationStateAttribute: string;
  confirmAttribute: string;
  methodAttribute: string;
  replaceAttribute: string;
  permanentAttribute: string;
  disableAttribute: string;
  disableWithAttribute: string;
  beforeRenderEvent: string;
  renderEvent: string;
  navigationStateChangeEvent: string;
  fetcherStateChangeEvent: string;
  revalidationStateChangeEvent: string;
  fetcherJSONEvent: string;
};

export const defaultSchema: Schema = {
  enabledAttribute: 'data-turbo',
  navigationStateAttribute: 'data-turbo-navigation-state',
  fetcherStateAttribute: 'data-turbo-fetcher-state',
  revalidationStateAttribute: 'data-turbo-revalidation-state',
  confirmAttribute: 'data-turbo-confirm',
  methodAttribute: 'data-turbo-method',
  replaceAttribute: 'data-turbo-replace',
  permanentAttribute: 'data-turbo-permanent',
  disableAttribute: 'data-turbo-disable',
  disableWithAttribute: 'data-turbo-disable-with',
  beforeRenderEvent: 'turbo:before-render',
  renderEvent: 'turbo:render',
  navigationStateChangeEvent: 'turbo:navigation-state-change',
  fetcherStateChangeEvent: 'turbo:fetcher-state-change',
  revalidationStateChangeEvent: 'turbo:revalidation-state-change',
  fetcherJSONEvent: 'turbo:fetcher-json',
};
