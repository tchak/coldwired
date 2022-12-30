import type { Router, Fetcher, NavigationStates, FormMethod } from '@remix-run/router';
import invariant from 'tiny-invariant';

import { type Schema, defaultSchema } from './schema';
import type { RouteData } from './data';
import {
  type HTMLSubmitterElement,
  getFormSubmissionInfo,
  shouldProcessLinkClick,
  findLinkFromClickTarget,
  parseHTML,
  isSubmitterElement,
  isFormElement,
  domReady,
} from './dom';
import { dispatch, expandURL, relativeURL } from './utils';
import { renderTurboStreamTemplate } from './turbo-stream';
import { NavigationContext } from './navigation-context';
import { getFetcherKey } from './directives/fetcher';
import {
  DirectiveController,
  DirectiveFactory,
  DirectiveConstructor,
} from './directive-controller';
import { morphDocument } from './morph';
import { MorphContext } from './morph-context';
import * as Directives from './directives';

type RenderDetail = {
  navigation?: NavigationStates['Idle'];
  fetcher?: Fetcher;
};

export type ApplicationOptions = {
  router: Router;
  element?: Element;
  schema?: Partial<Schema>;
  debug?: boolean;
};

export class Application {
  #schema: Schema;
  #router: Router;
  #element: Element;

  #controllers = new Set<DirectiveController>();
  #eventListener: EventListenerObject;
  #navigationContext: NavigationContext;
  #morphContext: MorphContext;

  constructor({ router, element, schema, debug }: ApplicationOptions) {
    this.#router = router;
    this.#element = element ?? document.documentElement;
    this.#schema = Object.assign({}, defaultSchema, schema);
    this.#navigationContext = new NavigationContext(
      this.#element,
      this.#schema,
      {
        navigationDone: this.navigationDone.bind(this),
        fetcherDone: this.fetcherDone.bind(this),
      },
      debug
    );
    this.#morphContext = new MorphContext(this.#element);
    this.#eventListener = { handleEvent: this.handleEvent.bind(this) };

    this.register(this.#schema.fetcherAttribute, Directives.Fetcher);
    this.register(this.#schema.revalidateAttribute, Directives.Revalidate);
    this.register(this.#schema.submitOnChangeAttribute, Directives.SubmitOnChange);
  }

  static start(options: ApplicationOptions): Promise<Application> {
    const application = new Application(options);
    return application.start();
  }

  async start(): Promise<this> {
    this.#router.subscribe(this.#navigationContext.to.bind(this.#navigationContext));
    this.#router.initialize();

    this.#element.addEventListener('click', this.#eventListener);
    this.#element.addEventListener('submit', this.#eventListener);

    await domReady();

    for (const controller of this.#controllers) {
      controller.start();
    }
    this.#morphContext.start();

    return this;
  }

  stop(): this {
    this.#router.dispose();

    for (const controller of this.#controllers) {
      controller.stop();
    }
    this.#morphContext.stop();

    this.#element.removeEventListener('click', this.#eventListener);
    this.#element.removeEventListener('submit', this.#eventListener);

    return this;
  }

  private register(directiveAttributeName: string, DirectiveClass: DirectiveConstructor) {
    const factory: DirectiveFactory = (element) =>
      new DirectiveClass(element, this.#router, this.#schema);
    const controller = new DirectiveController(this.#element, directiveAttributeName, factory);
    this.#controllers.add(controller);
  }

  private handleEvent(event: Event): void {
    const target = (event.composedPath && event.composedPath()[0]) || event.target;

    if (event.type == 'click') {
      this.onClick(event as MouseEvent, target);
    } else if (event.type == 'submit') {
      this.onSubmit(event as SubmitEvent, target);
    }
  }

  private fetcherDone(fetcherKey: string, fetcher: Fetcher, form: Element) {
    switch (fetcher.data?.format) {
      case 'turbo-stream':
        this.handleTurboStream(form, fetcher.data.content);
        break;
      case 'json':
        this.handleJSON(form, { fetcherKey, data: fetcher.data.content });
        break;
      case 'html':
        this.handleHTML(fetcher.data.content, { fetcher });
    }
  }

  private navigationDone(navigation: NavigationStates['Idle'], data?: RouteData) {
    switch (data?.format) {
      case 'html':
        this.handleHTML(data.content, { navigation });
        break;
      case 'turbo-stream':
        invariant(false, 'Navigation can not return turbo-stream');
        break;
      case 'json':
        invariant(false, 'Navigation can not return json');
        break;
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

  private handleTurboStream(_: Element, content: string) {
    this.#morphContext.pause();
    renderTurboStreamTemplate(content, { forceAttribute: this.#schema.forceAttribute });
    this.#morphContext.restart();
  }

  private handleHTML(content: string, detail: RenderDetail) {
    const doc = parseHTML(content);
    this.beforeRender(doc.documentElement, detail);
    this.#morphContext.pause();
    morphDocument(doc, { forceAttribute: this.#schema.forceAttribute });
    this.#morphContext.restart();
    this.afterRender(detail);
  }

  private handleJSON(target: Element, content: { fetcherKey: string; data: unknown }) {
    dispatch(this.#schema.fetcherJSONEvent, { target, detail: content });
  }

  private submitForm(form: HTMLFormElement, submitter?: HTMLSubmitterElement) {
    const { url, method, formData } = getFormSubmissionInfo(form, location.pathname, { submitter });
    const replace =
      submitter?.hasAttribute(this.#schema.replaceAttribute) ||
      form.hasAttribute(this.#schema.replaceAttribute);
    const href = relativeURL(url);
    const options = { formMethod: method, formData, replace };
    const fetcherKey = getFetcherKey(form);

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
    const replace = link.hasAttribute(this.#schema.replaceAttribute);

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

  private beforeRender(documentElement: HTMLElement, detail: RenderDetail) {
    dispatch(this.#schema.beforeRenderEvent, {
      target: this.#element,
      detail: { ...detail, documentElement },
    });
  }

  private afterRender(detail: RenderDetail) {
    dispatch(this.#schema.renderEvent, { target: this.#element, detail });
  }
}
