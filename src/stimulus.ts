import { Application } from '@hotwired/stimulus';
import type { Router } from '@remix-run/router';

export function getStimulusApplication(router: Router, application?: Application) {
  if (!application) {
    application = new Application();
  }
  registry.set(application, router);
  return application;
}

export function getRouter(application: Application): Router {
  return registry.get(application) as Router;
}

const registry = new WeakMap<Application, Router>();
