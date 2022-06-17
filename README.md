# Remix Router Turbo [![Build Status](https://github.com/tchak/remix-router-turbo/workflows/CI/badge.svg)](https://github.com/tchak/remix-router-turbo/actions)

# Why?

At work we have a reasonably old reasonably big rails app. It powers quite a successful service while being run by a minimal team. It's an old school, server rendered rails app. The team is not interested at all in migrating to a JavaScript framework. But we do have some pieces of the app that requires dynamic components. Recently we introduced [hotwired/turbo](https://hotwired.dev) into our code base and it is quite a success. The team likes a lot the minimal JavaScript API surface. But turbo has problems. Those problems are very similar to the ones solved by @remix-run/router. The main one is coordinating multiple submitting forms on one page without full reloads.

# How ?

This is a first attempt to replace [turbo-drive](https://turbo.hotwired.dev/handbook/drive) with remix based router. It does several things:
 - rake task to generate `@remix-run/router` compatible routes config
 - intercepts `click` and `submit` events to navigate with client router
 - use [morphdom](https://github.com/patrick-steele-idem/morphdom) to render pages
 - bypass remix routing if `data-turbo="false"` is set on links and forms
 - provide [stimulus](https://stimulus.hotwired.dev) controller to register fetchers (`data-controller="fetcher"`)
 - provide [stimulus](https://stimulus.hotwired.dev) controller to submit forms on changes (`data-controller="submit-on-change"`)
 - provide [stimulus](https://stimulus.hotwired.dev) controller to revalidate pages (`data-controller="revalidate"`)
 - in fetcher responses accepts [turbo-stream](https://turbo.hotwired.dev/handbook/streams) format and bypass revalidation in those cases

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

In order to use this router you need to generate (or write) a JSON array of all the routes exposed by your server. You should add `_loader: true` to `GET` only routes and `_action: true` to any route that you expect to handle any other HTTP methods. No nested routing for now – we might explore the possibility later but it will require a much more involved server. All the requests to your server will have a header `x-remix: true`. In order for redirects to work properly you should respond with a `204` and a `x-remix-redirect: <url>` header instead of the usual `30*` and a `location: <url>` header.

```ts
import { createBrowserTurboRouter, RouteObject } from 'remix-router-turbo';

const routes: RouteObject[] = [
  {
    path: '/',
    id: 'root',
    handle: { _loader: true }
  },
  {
    path: '/login',
    id: 'login',
    handle: { _loader: true, _action: true }
  }
];

const router = createBrowserTurboRouter({ routes, debug: true });

```
