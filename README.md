# Remix Router Turbo [![npm package][npm-badge]][npm] [![build][build-badge]][build]

[npm-badge]: https://img.shields.io/npm/v/remix-router-turbo.svg
[npm]: https://www.npmjs.org/package/remix-router-turbo
[build-badge]: https://github.com/tchak/remix-router-turbo/workflows/CI/badge.svg
[build]: https://github.com/tchak/remix-router-turbo/actions

## Why?

At work we have a 6 years old reasonably big rails app. It powers quite a successful service while being run by a small team. It's an old school, server rendered rails app. The team is not interested at all in migrating to a JavaScript framework. But we do have some pieces of the app that requires dynamic components. Recently we introduced [hotwired/turbo](https://hotwired.dev) into our code base and it is quite a success. The team likes a lot the minimal JavaScript API surface. But turbo has problems. Those problems are very similar to the ones solved by [@remix-run/router](https://www.npmjs.com/package/@remix-run/router). The main one is coordinating multiple submitting forms on one page without full reloads.

## How?

This is a first attempt to replace [turbo-drive](https://turbo.hotwired.dev/handbook/drive) with remix based router. It does several things:
 - intercepts `click` and `submit` events to navigate with client router
 - use [morphdom](https://github.com/patrick-steele-idem/morphdom) to render pages
 - bypass remix routing if `data-turbo="false"` is set on links and forms
 - provide a directive to register fetchers (`data-turbo-fetcher`)
 - provide a directive to submit forms on changes (`data-turbo-submit-on-change`)
 - provide a directive to revalidate pages (`data-turbo-revalidate`)
 - in fetcher responses, accepts [turbo-stream](https://turbo.hotwired.dev/handbook/streams) format and bypass revalidation in those cases
 - if `data-turbo-method` is used on `<a>` it will submit the link instead of navigating
 - if `data-turbo-disabled` is used on `<input>`, `<select>` or `<button>` it will atomatically disable them during submission
 - if `data-turbo-confirm` is used on `<a>` or `<form>` it will ask for confirmation before submitting/navigating

## Demo

[remix rails demo](https://github.com/tchak/rails-remix-demo)

## Install

With `yarn`

```bash
yarn add remix-router-turbo
```

With `npm`

```bash
npm install remix-router-turbo
```

## Usage

In order to use this router you need to generate (or write) a JSON array of all the routes exposed by your server. You must add `method` to route handles in order for router to register loaders and actions. No nested routing for now – we might explore the possibility later but it will require a much more involved server. All the requests to your server will have a header `x-requested-with: remix`. In order for redirects to work properly you must respond with a `204` and a `x-remix-redirect: <url>` header instead of the usual `30*` and a `location: <url>` header.

Most of the library is implemented as a collection of directives. They are similar to [stimulus](https://stimulus.hotwired.dev) controllers.

```ts
import { createBrowserTurboRouter, RouteObject } from 'remix-router-turbo';

const routes: RouteObject[] = [
  {
    path: '/',
    id: 'root',
    handle: { method: 'get' }
  },
  {
    path: '/login',
    id: 'login',
    handle: { method: ['get', 'post'] }
  }
];

const router = createBrowserTurboRouter({ routes, debug: true });

```

```html
<html>
  <body>
    <form>
      (...)
    </form>

    <div data-turbo="false">
      <form>
        (...)
      </form>
    </div>

    <ul>
      <li id="item_1">
        <form data-turbo-fetcher>
          (...)
        </form>
      </li>
      <li id="item_2">
        <form data-turbo-fetcher>
          (...)
        </form>
      </li>
    </ul>
  </body>
</html>
```
