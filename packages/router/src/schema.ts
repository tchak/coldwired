import {
  type Schema as ActionsSchema,
  defaultSchema as defaultActionsSchema,
} from '@coldwired/actions';

export interface Schema extends ActionsSchema {
  enabledAttribute: string;
  navigationStateAttribute: string;
  fetcherStateAttribute: string;
  revalidationStateAttribute: string;
  confirmAttribute: string;
  methodAttribute: string;
  replaceAttribute: string;
  disableAttribute: string;
  disableWithAttribute: string;
  fetcherAttribute: string;
  revalidateAttribute: string;
  submitOnChangeAttribute: string;
  debounceIntervalAttribute: string;
  revalidateIntervalAttribute: string;
  renderEvent: string;
  navigationStateChangeEvent: string;
  fetcherStateChangeEvent: string;
  revalidationStateChangeEvent: string;
  fetcherJSONEvent: string;
}

export const defaultSchema: Schema = {
  ...defaultActionsSchema,
  enabledAttribute: 'data-turbo',
  navigationStateAttribute: 'data-turbo-navigation-state',
  fetcherStateAttribute: 'data-turbo-fetcher-state',
  revalidationStateAttribute: 'data-turbo-revalidation-state',
  confirmAttribute: 'data-turbo-confirm',
  methodAttribute: 'data-turbo-method',
  replaceAttribute: 'data-turbo-replace',
  disableAttribute: 'data-turbo-disable',
  disableWithAttribute: 'data-turbo-disable-with',
  fetcherAttribute: 'data-turbo-fetcher',
  revalidateAttribute: 'data-turbo-revalidate',
  submitOnChangeAttribute: 'data-turbo-submit-on-change',
  debounceIntervalAttribute: 'data-turbo-debounce-interval',
  revalidateIntervalAttribute: 'data-turbo-revalidate-interval',
  renderEvent: 'turbo:render',
  navigationStateChangeEvent: 'turbo:navigation-state-change',
  fetcherStateChangeEvent: 'turbo:fetcher-state-change',
  revalidationStateChangeEvent: 'turbo:revalidation-state-change',
  fetcherJSONEvent: 'turbo:fetcher-json',
};
