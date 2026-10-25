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

## Example: logging method calls

Here is all it takes to log every call of a method — no base classes, no decorators, no changes to your code:

```js
import { Aspect } from "@spirex/aop"; // the library entry point

class Calculator {
    add(a, b) {
        return a + b;
    }
}

// Create a method aspect: an object with hooks that run around matching methods.
var logCalls = Aspect.method(
    { memberName: "add" }, // selector: only the `add` method
    {
        // `beforeCall` runs before the original method; `meta.params` holds the call arguments.
        beforeCall: (meta) => {
            console.log(`-> ${meta.methodRef.name}(${meta.params.join(", ")})`);
        },
        // `afterCall` runs after the original method and receives its return value.
        afterCall: (meta, returnValue) => {
            console.log(`<- ${meta.methodRef.name} returned ${returnValue}`);
        },
    },
);

var calculator = new Calculator();
// Apply the aspect: returns a wrapped instance that runs the hooks on every matching call.
calculator = Aspect.apply(calculator, [logCalls]);

calculator.add(2, 3);
// -> add(2, 3)
// <- add returned 5
```

That is the whole workflow: define an aspect, apply it, and keep calling your object as usual.
