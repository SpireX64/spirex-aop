# @spirex/aop

![NPM Type Definitions](https://img.shields.io/npm/types/%40spirex%2Faop?style=for-the-badge)
[![NPM Version](https://img.shields.io/npm/v/%40spirex%2Faop?style=for-the-badge)](https://www.npmjs.com/package/@spirex/aop)
![GitHub License](https://img.shields.io/github/license/spirex64/spirex-aop?style=for-the-badge)
[![Codecov](https://img.shields.io/codecov/c/github/spirex64/spirex-aop?token=VXQZK5WDSY&flag=aop&style=for-the-badge)](https://codecov.io/github/SpireX64/spirex-aop)

`@spirex/aop` is an aspect-oriented programming (AOP) library that works with any JavaScript/TypeScript project and is very easy to use.

## What is AOP?

Aspect-oriented programming (AOP) is a programming paradigm for separating cross-cutting concerns — logic that is needed in many places but is not part of the core business code. Typical examples are logging, validation, transactions, and authorization.

Without AOP, such code is either duplicated across methods and classes or mixed into business logic, making it harder to read and maintain. AOP solves this by letting you define the shared behavior once — as an *aspect* made of *advice* that runs before, after, or around a method call — and then apply it wherever it is needed.

Under the hood, `@spirex/aop` wraps an object with a proxy that intercepts the selected method calls and runs the advice around them. Your business code stays clean and untouched, while the cross-cutting logic lives in one place — no duplication, no noise.

## Installation

Any package manager works:

```sh
npm install @spirex/aop
```

```sh
yarn add @spirex/aop
```

```sh
pnpm add @spirex/aop
```

### Requirements

The library is written in JavaScript and ships with full TypeScript typing support (`.d.ts` declarations included). It has zero runtime dependencies and is distributed in UMD, ESM, and CJS builds; the main entry is about 4.7 kb minified (~1.85 kb gzip).

The only requirement is the JavaScript runtime itself: it must support `Proxy`, `Reflect`, and `Promise`. This limits the range of supported environments — any engine without these standard features cannot run the library.

A standalone annotations module is also available via the `@spirex/aop/annotations` subpath import.
