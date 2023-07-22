# Coldwired [![build][build-badge]][build]

[build-badge]: https://github.com/tchak/coldwired/workflows/CI/badge.svg
[build]: https://github.com/tchak/coldwired/actions

[npm-badge-router]: https://img.shields.io/npm/v/@coldwired/router.svg
[npm-router]: https://www.npmjs.com/package/@coldwired/router
[npm-badge-actions]: https://img.shields.io/npm/v/@coldwired/actions.svg
[npm-actions]: https://www.npmjs.com/package/@coldwired/actions
[npm-badge-turbo-stream]: https://img.shields.io/npm/v/@coldwired/turbo-stream.svg
[npm-turbo-stream]: https://www.npmjs.com/package/@coldwired/turbo-stream

## What is this?

This is an attempt to bring together some ideas from [hotwired/turbo](https://hotwired.dev),
[livewire](https://livewire.laravel.com) and
[live_view](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.html) and
[@remix-run/router](https://www.npmjs.com/package/@remix-run/router). We want to stay as framework
agnostic as possible, even if currently this library is only used in production in one Rails
project.

## Packages

* @coldwired/actions [![npm package][npm-badge-actions]][npm-actions]
* @coldwired/turbo-stream [![npm package][npm-badge-turbo-stream]][npm-turbo-stream]
* @coldwired/router [![npm package][npm-badge-router]][npm-router]

## Install

```bash
pnpm add @coldwired/actions @coldwired/turbo-stream
```

## Demo

[@coldwired rails demo](https://github.com/tchak/coldwired-rails-demo)
