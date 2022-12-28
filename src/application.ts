import type { Router, Fetcher, NavigationStates, FormMethod } from '@remix-run/router';
import morphdom from 'morphdom';
import invariant from 'tiny-invariant';

import type { Schema } from './schema';
import type { HTMLSubmitterElement } from './dom';
import { defaultSchema } from './schema';
import type { RouteData } from './loader';
import {
  getFormSubmissionInfo,
  shouldProcessLinkClick,
  findLinkFromClickTarget,
  parseHTML,
  isSubmitterElement,
  isFormElement,
  isFormInputElement,
  isLinkElement,
  isFormOptionElement,
  isInputElement,
  domReady,
} from './dom';
import { dispatch, expandURL, relativeURL } from './utils';
import { renderStream } from './turbo-stream';
import { Transition } from './transition';
import { getMetadata } from './metadata';
import {
  DirectiveController,
  DirectiveFactory,
  DirectiveConstructor,
} from './directive-controller';
import { difference } from './utils';
import { ClassListObserver } from './mutation-observers/class-list-observer';

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

  #eventListener: EventListenerObject;
  #transition: Transition;
  #controllers = new Set<DirectiveController>();
  #classListObserver: ClassListObserver;

  constructor({ router, element, schema, debug }: ApplicationOptions) {
    this.#router = router;
    this.#element = element ?? document.documentElement;
    this.#schema = Object.assign({}, defaultSchema, schema);
    this.#transition = new Transition(
      this.#element,
      this.#schema,
      {
        navigationDone: this.navigationDone.bind(this),
        fetcherDone: this.fetcherDone.bind(this),
      },
      debug
    );
    this.#eventListener = { handleEvent: this.handleEvent.bind(this) };

    this.register(this.#schema.fetcherAttribute, Directives.Fetcher);
    this.register(this.#schema.revalidateAttribute, Directives.Revalidate);
    this.register(this.#schema.submitOnChangeAttribute, Directives.SubmitOnChange);

    this.#classListObserver = new ClassListObserver(this.#element, {
      classListChanged: this.classListChanged.bind(this),
    });
  }

  static async start(options: ApplicationOptions) {
    const application = new Application(options);
    await application.start();
    return application;
  }

  async start() {
    this.#router.subscribe(this.#transition.to.bind(this.#transition));
    this.#router.initialize();

    this.#element.addEventListener('click', this.#eventListener);
    this.#element.addEventListener('submit', this.#eventListener);
    this.#element.addEventListener('input', this.#eventListener);

    await domReady();

    for (const controller of this.#controllers) {
      controller.start();
    }
    this.#classListObserver.observe();
  }

  stop() {
    this.#router.dispose();

    for (const controller of this.#controllers) {
      controller.stop();
    }
    this.#classListObserver.disconnect();

    this.#element.removeEventListener('click', this.#eventListener);
    this.#element.removeEventListener('submit', this.#eventListener);
    this.#element.removeEventListener('input', this.#eventListener);
  }

  register(directive: string, Directive: DirectiveConstructor) {
    const factory: DirectiveFactory = (element) =>
      new Directive(element, this.#router, this.#schema);
    const controller = new DirectiveController(this.#element, directive, factory);
    this.#controllers.add(controller);
  }

  private classListChanged(element: Element, oldClassList: Set<string>) {
    const metadata = getMetadata(element, true);
    const classList = new Set(element.classList);

    const added = difference(classList, oldClassList);
    const removed = difference(oldClassList, classList);

    for (const className of added) {
      metadata.addedClassNames.add(className);
      metadata.removedClassNames.delete(className);
    }
    for (const className of removed) {
      metadata.removedClassNames.add(className);
      metadata.addedClassNames.delete(className);
    }
  }

  private handleEvent(event: Event): void {
    const target = (event.composedPath && event.composedPath()[0]) || event.target;

    switch (event.type) {
      case 'click':
        this.onClick(event as MouseEvent, target);
        break;
      case 'submit':
        this.onSubmit(event as SubmitEvent, target);
        break;
      case 'input':
        this.onInput(target);
        break;
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

  private onInput(element: EventTarget) {
    if (isFormInputElement(element)) {
      getMetadata(element, true).touched = true;
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

  submitForm(form: HTMLFormElement, submitter?: HTMLSubmitterElement) {
    const { url, method, formData } = getFormSubmissionInfo(form, location.pathname, { submitter });
    const replace =
      submitter?.getAttribute(this.#schema.replaceAttribute) == 'true' ||
      form.getAttribute(this.#schema.replaceAttribute) == 'true';
    const href = relativeURL(url);
    const options = { formMethod: method, formData, replace };
    const fetcherKey = getMetadata(form)?.fetcherKey;

    if (fetcherKey) {
      const match = this.#router.state.matches.at(-1);
      invariant(match, 'No route matches the current URL');

      this.#router.fetch(fetcherKey, match.route.id, href, options);
    } else {
      this.#router.navigate(href, options);
    }
  }

  followOrSubmitLink(link: HTMLAnchorElement) {
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

  private onBeforeElementUpdated(fromElement: Element, toElement: Element) {
    const force = !!toElement.closest(`[${this.#schema.forceAttribute}]`);
    const metadata = getMetadata(fromElement);

    if (force && metadata) {
      if (isFormInputElement(fromElement) || isFormOptionElement(fromElement)) {
        metadata.touched = false;
      }
    }

    if (fromElement.isEqualNode(toElement)) {
      return false;
    }

    if (!force && metadata) {
      toElement.classList.add(...metadata.addedClassNames);
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

    return true;
  }

  private morph(fromElement: Element, toElement: Element, childrenOnly = false) {
    this.#classListObserver.disconnect();

    morphdom(fromElement, toElement, {
      childrenOnly,
      onBeforeElUpdated: this.onBeforeElementUpdated.bind(this),
    });

    this.#classListObserver.observe();
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
}
