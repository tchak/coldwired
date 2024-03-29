# @coldwired/router [![npm package][npm-badge]][npm]

[npm-badge]: https://img.shields.io/npm/v/@coldwired/router.svg
[npm]: https://www.npmjs.com/package/@coldwired/router

## Why?

At work we have a six-year-old reasonably big rails app. It powers quite a successful service while being run by a small team. It's an old school, server rendered rails app. The team is not interested at all in migrating to a JavaScript framework. But we do have some pieces of the app that requires dynamic components. Recently we introduced [hotwired/turbo](https://hotwired.dev) into our code base and it is quite a success. The team likes the minimal JavaScript API surface a lot. But turbo has problems. Those problems are very similar to the ones solved by [@remix-run/router](https://www.npmjs.com/package/@remix-run/router). The main one is coordinating multiple submitting forms on one page without full reloads.

## How?

This project is an almost "drop in" replacement of [turbo-drive](https://turbo.hotwired.dev/handbook/drive) with [remix](https://www.npmjs.com/package/@remix-run/router) based router. It does several things:
 - intercepts `click` and `submit` events to navigate with client router
 - use [morphdom](https://github.com/patrick-steele-idem/morphdom) to render pages
 - bypass in browser routing if `data-turbo="false"` is set on links and forms
 - provide a directive to register fetchers (`data-turbo-fetcher`)
 - provide a directive to submit forms on changes (`data-turbo-submit-on-change`)
 - provide a directive to revalidate pages (`data-turbo-revalidate`)
 - in fetcher responses, accepts [turbo-stream](https://turbo.hotwired.dev/handbook/streams) format and bypass revalidation in those cases
 - if `data-turbo-method` is used on `<a>` it will submit the link instead of navigating
 - if `data-turbo-disabled` is used on `<input>`, `<select>` or `<button>` it will atomatically disable them during submission
 - if `data-turbo-confirm` is used on `<a>` or `<form>` it will ask for confirmation before submitting/navigating
 - preserve `class` attribute changes between renders unless `data-turbo-force` directive is used
 - preserve `aria-` and related attributes changes between renders unless `data-turbo-force` directive is used
 - preserve `value` on touched `<input>` and `<select>` between renders unless `data-turbo-force` directive is used
 - extends [turbo-stream](https://turbo.hotwired.dev/handbook/streams) with ability to delay actions
 - extends [turbo-stream](https://turbo.hotwired.dev/handbook/streams) with ability to pin actions between renders

## Demo

[@coldwired rails demo](https://github.com/tchak/coldwired-rails-demo)

## Usage

In order to use this router you need to generate (or write) a JSON array of all the routes exposed by your server. You must add `method` to route handles in order for router to register loaders and actions. No nested routing for now – we might explore the possibility later but it will require a much more involved server. All the requests to your server will have a header `x-requested-with: coldwire`. In order for redirects to work properly you must respond with a `204` and a `x-coldwire-redirect: <url>` header instead of the usual `30*` and a `location: <url>` header.

```ts
import { Application, type RouteObject } from '@coldwired/router';

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

const application = await Application.start({ routes });

```

```html
<html>
  <body data-turbo>
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
