import type { Router, RouterState, Fetcher, NavigationStates, FormMethod } from '@remix-run/router';
import morphdom from 'morphdom';
import invariant from 'tiny-invariant';

import type { Schema } from './schema';
import type { HTMLSubmitterElement } from './dom';
import { getRouteData } from './loader';
import {
  getFormSubmissionInfo,
  shouldProcessLinkClick,
  findLinkFromClickTarget,
  parseHTML,
  isElement,
  isSubmitterElement,
  isFormElement,
  isFormInputElement,
  isLinkElement,
  isFormOptionElement,
  isInputElement,
  isButtonElement,
  isFocused,
} from './dom';
import { dispatch, expandURL, relativeURL } from './utils';
import { renderStream } from './turbo-stream';
import { Transition } from './transition';
import {
  getMetadata,
  getOrCreateMetadata,
  connectElement,
  disconnectElement,
  getElementByKey,
  getElementKey,
} from './metadata';
import { ClassListObserver } from './class-list-observer';

type RenderDetail = {
  navigation?: NavigationStates['Idle'];
  fetcher?: Fetcher;
};

export class Delegate implements EventListenerObject {
  #schema: Schema;
  #router: Router;
  #element: Element;
  #snapshot?: string;

  #transition: Transition;
  #observer: ClassListObserver;

  constructor({
    schema,
    router,
    element,
    debug,
  }: {
    schema: Schema;
    router: Router;
    element: Element;
    debug: boolean;
  }) {
    this.#schema = schema;
    this.#router = router;
    this.#element = element;
    this.#transition = new Transition(element, schema, debug);
    this.#observer = new ClassListObserver(element, schema);
  }

  connect() {
    this.#observer.observe();
  }

  disconnect() {
    this.#observer.disconnect();
  }

  handleEvent(event: Event): void {
    const target = (event.composedPath && event.composedPath()[0]) || event.target;

    switch (event.type) {
      case 'click':
        this.onClick(event as MouseEvent, target);
        break;
      case 'submit':
        this.onSubmit(event as SubmitEvent, target);
        break;
      case 'input':
        this.touchFormInputElement(target);
        break;
      case 'remix-router-turbo:connect-fetcher':
        this.connectFetcher(target, (event as CustomEvent<{ fetcherKey: string }>).detail);
        break;
      case 'remix-router-turbo:disconnect-fetcher':
        this.disconnectFetcher(target, (event as CustomEvent<{ fetcherKey: string }>).detail);
        break;
      case 'remix-router-turbo:revalidate':
        this.onRevalidate();
        break;
    }
  }

  onRouterStateChange(state: RouterState) {
    this.#transition.stateChange(state);

    for (const [fetcherKey, fetcher] of state.fetchers) {
      const target = getElementByKey(fetcherKey);
      invariant(target, `No fetcher frame found for "${fetcherKey}"`);

      if (fetcher.state == 'submitting') {
        this.disableFormInputs(target);
      } else {
        this.enableFormInputs(target);
      }

      if (fetcher.state == 'idle') {
        switch (fetcher.data?.format) {
          case 'turbo-stream':
            this.handleTurboStream(target, fetcher.data.content);
            break;
          case 'json':
            this.handleJSON(target, { fetcherKey, data: fetcher.data.content });
            break;
          case 'html':
            this.handleHTML(fetcher.data.content, { fetcher });
        }
      }
    }

    if (state.navigation.state == 'submitting') {
      for (const form of this.nonFetcherForms) {
        this.disableFormInputs(form);
      }
    } else {
      for (const form of this.nonFetcherForms) {
        this.enableFormInputs(form);
      }
    }

    if (state.initialized && state.navigation.state == 'idle') {
      const { loaderData, actionData } = getRouteData(state);
      const routeData = actionData ?? loaderData;
      switch (routeData?.format) {
        case 'html':
          if (routeData.content != this.#snapshot) {
            this.handleHTML(routeData.content, { navigation: state.navigation });
            this.#snapshot = routeData.content;
          }
          break;
        case 'turbo-stream':
          invariant(false, 'Navigation can not return turbo-stream');
          break;
        case 'json':
          invariant(false, 'Navigation can not return json');
          break;
      }
    }
  }

  private onClick(event: MouseEvent, target: EventTarget) {
    const link = findLinkFromClickTarget(target);

    if (link && this.willFollowLink(event, link)) {
      event.preventDefault();

      if (this.confirm(link)) {
        this.followOrSubmitLink(link);
      }
    }
  }

  private onSubmit(event: SubmitEvent, target: EventTarget) {
    const submitter = event.submitter;
    const form = isSubmitterElement(submitter) ? submitter.form ?? target : target;

    if (isFormElement(form) && this.willSubmitForm(form, submitter ?? undefined)) {
      event.preventDefault();

      if (this.confirm(form, submitter ?? undefined)) {
        if (isSubmitterElement(submitter)) {
          this.submitForm(form, submitter);
        } else {
          this.submitForm(form);
        }
      }
    }
  }

  private onRevalidate() {
    this.#router.revalidate();
  }

  private connectFetcher(target: EventTarget, { fetcherKey }: { fetcherKey: string }) {
    if (isElement(target)) {
      connectElement(target, fetcherKey);
    }
  }

  private disconnectFetcher(target: EventTarget, { fetcherKey }: { fetcherKey: string }) {
    if (isElement(target)) {
      disconnectElement(fetcherKey);
      this.#router.deleteFetcher(fetcherKey);
    }
  }

  private handleTurboStream(_: Element, content: string) {
    renderStream(content, this.morph.bind(this));
  }

  private handleJSON(target: Element, content: { fetcherKey: string; data: unknown }) {
    dispatch(this.#schema.fetcherJSONEvent, { target, detail: content });
  }

  private handleHTML(content: string, detail: RenderDetail) {
    const doc = parseHTML(content);
    this.morphDocument(doc, detail);
  }

  private submitForm(form: HTMLFormElement, submitter?: HTMLSubmitterElement) {
    const { url, method, formData } = getFormSubmissionInfo(form, location.pathname, { submitter });
    const replace =
      submitter?.getAttribute(this.#schema.replaceAttribute) == 'true' ||
      form.getAttribute(this.#schema.replaceAttribute) == 'true';
    const href = relativeURL(url);
    const options = { formMethod: method, formData, replace };
    const fetcherKey = getElementKey(form);

    if (fetcherKey) {
      const match = this.#router.state.matches.at(-1);
      invariant(match, 'No route matches the current URL');

      this.#router.fetch(fetcherKey, match.route.id, href, options);
    } else {
      this.#router.navigate(href, options);
    }
  }

  private followOrSubmitLink(link: HTMLAnchorElement) {
    const href = expandURL(link.getAttribute('href') || '');
    const turboMethod = link.getAttribute(this.#schema.methodAttribute)?.toLowerCase();
    const replace = link.getAttribute(this.#schema.replaceAttribute) == 'true';

    if (turboMethod && turboMethod !== 'get') {
      const { url, method, formData } = getFormSubmissionInfo(
        href.searchParams,
        location.pathname,
        { method: turboMethod as FormMethod, action: href.pathname }
      );

      this.#router.navigate(relativeURL(url), { formMethod: method, formData, replace });
    } else {
      this.#router.navigate(relativeURL(href), { replace });
    }
  }

  private willFollowLink(event: MouseEvent, link: HTMLAnchorElement) {
    return this.isEnabled(link) && shouldProcessLinkClick(event, link.target);
  }

  private willSubmitForm(form: HTMLFormElement, input?: Element) {
    if (input) {
      return this.isEnabled(input) && this.isEnabled(form);
    }
    return this.isEnabled(form);
  }

  private isEnabled(element: Element) {
    return (
      element
        .closest(`[${this.#schema.enabledAttribute}]`)
        ?.getAttribute(this.#schema.enabledAttribute) != 'false'
    );
  }

  private confirm(element: Element, submitter?: Element) {
    const confirmMessage =
      submitter?.getAttribute(this.#schema.confirmAttribute) ??
      element.getAttribute(this.#schema.confirmAttribute);

    return !confirmMessage || confirm(confirmMessage);
  }

  private getPermanentAttribute(
    permanentAttribute: string,
    fromElement: Element,
    toElement: Element
  ): 'client' | 'server' {
    const toPermanent = toElement.getAttribute(permanentAttribute);
    const fromPermanent = fromElement
      .closest(`[${permanentAttribute}]`)
      ?.getAttribute(permanentAttribute);

    if (toPermanent == 'server') {
      return 'server';
    } else if (fromPermanent == 'client') {
      toElement.setAttribute(permanentAttribute, 'client');
      return 'client';
    }

    const permanent = toPermanent ?? fromPermanent;

    if (!permanent) {
      if (isInputElement(fromElement) && isFocused(fromElement)) {
        return 'client';
      }
      return 'server';
    }

    return permanent == 'client' ? 'client' : 'server';
  }

  private touchFormInputElement(element: EventTarget) {
    if (isFormInputElement(element)) {
      getOrCreateMetadata(element).touched = true;
    }
  }

  private onBeforeElementUpdated(fromElement: Element, toElement: Element) {
    if (fromElement.isEqualNode(toElement)) {
      return false;
    }

    const permanent = this.getPermanentAttribute(
      this.#schema.permanentAttribute,
      fromElement,
      toElement
    );
    const metadata = getMetadata(fromElement);

    if (permanent == 'client') {
      toElement.classList.add(...fromElement.classList);

      if (metadata) {
        toElement.classList.remove(...metadata.removedClassNames);

        if (metadata.touched) {
          if (
            isInputElement(fromElement) &&
            (fromElement.type == 'checkbox' || fromElement.type == 'radio')
          ) {
            Object.assign(toElement, { checked: fromElement.checked });
          } else if (isFormOptionElement(fromElement)) {
            Object.assign(toElement, { selected: fromElement.selected });
          } else if (isFormInputElement(fromElement)) {
            Object.assign(toElement, { value: fromElement.value });
          }
        }
      }
    } else if (metadata) {
      if (isFormInputElement(fromElement) || isFormOptionElement(fromElement)) {
        metadata.touched = false;
      }
    }

    return true;
  }

  private morph(fromElement: Element, toElement: Element, childrenOnly = false) {
    this.#observer.disconnect();
    morphdom(fromElement, toElement, {
      childrenOnly,
      onBeforeElUpdated: (fromElement, toElement) =>
        this.onBeforeElementUpdated(fromElement, toElement),
    });
    this.#observer.observe();
  }

  private morphHead(toElement: HTMLHeadElement) {
    morphdom(document.head, toElement, {
      childrenOnly: true,
      onBeforeElUpdated(fromElement, toElement) {
        if (fromElement.isEqualNode(toElement)) {
          return false;
        }
        return true;
      },
      onBeforeNodeDiscarded(node) {
        if (isLinkElement(node)) {
          return false;
        }
        return true;
      },
    });
  }

  private morphDocument(doc: Document, detail: RenderDetail) {
    this.beforeRender(doc.documentElement, detail);
    if (doc.head) {
      this.morphHead(doc.head);
    }
    this.morph(document.body, doc.body);
    this.afterRender(detail);
  }

  private beforeRender(documentElement: HTMLElement, detail: RenderDetail) {
    dispatch(this.#schema.beforeRenderEvent, {
      target: this.#element,
      detail: { ...detail, documentElement },
    });
  }

  private afterRender(detail: RenderDetail) {
    dispatch(this.#schema.renderEvent, { target: this.#element, detail });
  }

  private disableFormInputs(container: Element) {
    for (const element of container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      this.formInputSelectors('enabled')
    )) {
      const disableWith = element.getAttribute(this.#schema.disableWithAttribute);
      const metadata = getOrCreateMetadata(element);

      if (disableWith) {
        if (isButtonElement(element)) {
          metadata.originalContent = element.innerHTML;
          element.innerHTML = disableWith;
        } else {
          metadata.originalContent = element.value;
          element.value = disableWith;
        }
      }

      metadata.originalFocused = isFocused(element);
      element.disabled = true;
    }
  }

  private enableFormInputs(container: Element) {
    for (const element of container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      this.formInputSelectors('disabled')
    )) {
      const metadata = getMetadata(element);
      if (metadata?.originalContent) {
        if (isButtonElement(element)) {
          element.innerHTML = metadata.originalContent;
        } else {
          element.value = metadata.originalContent;
        }
        delete metadata.originalContent;
      }
      element.disabled = false;
      if (isFocused(document.body) && metadata?.originalFocused) {
        element.focus();
        delete metadata.originalFocused;
      }
    }
  }

  private get nonFetcherForms() {
    return this.#element.querySelectorAll(`form:not([data-controller~="fetcher"])`);
  }

  private formInputSelectors(pseudoClass: 'enabled' | 'disabled') {
    const selectors: string[] = [];

    for (const tag of ['input', 'button', 'textarea']) {
      for (const attribute of [this.#schema.disableAttribute, this.#schema.disableWithAttribute]) {
        selectors.push(`${tag}[${attribute}]:${pseudoClass}`);
      }
    }

    return selectors.join(', ');
  }
}
