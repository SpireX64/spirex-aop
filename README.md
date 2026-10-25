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
