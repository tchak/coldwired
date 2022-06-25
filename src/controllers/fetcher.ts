import { Controller } from '@hotwired/stimulus';
import invariant from 'tiny-invariant';
import { nanoid } from 'nanoid';

import { cancelDebounce } from '../utils';
import { isFormElement } from '../dom';

export class FetcherController extends Controller {
  connect() {
    invariant(isFormElement(this.element), '"fetcher" can only be registerd on form elements');

    const fetcherKey = this.generateFetcherKey();
    this.dispatch('connect-fetcher', {
      prefix: 'remix-router-turbo',
      detail: { fetcherKey },
    });

    this.disconnect = () => {
      cancelDebounce(this.element);
      this.dispatch('disconnect-fetcher', {
        prefix: 'remix-router-turbo',
        detail: { fetcherKey },
      });
    };
  }

  private generateFetcherKey() {
    return this.element.id || nanoid();
  }
}
