import { describe, expect, test } from 'vitest';
import { Aspect, defineAnnotation } from './index.js';

describe('defineAnnotation', () => {
    test('returns a constructor producing frozen { name, args } annotations', () => {
        // Arrange --------------
        var WatchLog = defineAnnotation('WatchLog');

        // Act --------------
        var annotation = WatchLog(1, 'x');

        // Assert --------------
        expect(annotation).toEqual({ name: 'WatchLog', args: [1, 'x'] });
        expect(annotation).is.frozen;
    });
});

describe('Aspect.annotate / Aspect.getAnnotations', () => {
    test('stores annotations per member and returns them by instance + key', () => {
        // Arrange --------------
        var Tag = defineAnnotation('Tag');
        var instance = { foo() {}, bar() {} };

        // Act --------------
        Aspect.annotate(instance, 'foo', [Tag('a'), Tag('b')]);

        // Assert --------------
        expect(Aspect.getAnnotations(instance, 'foo')).toEqual([Tag('a'), Tag('b')]);
    });

    test('returns annotations via method target meta', () => {
        // Arrange --------------
        var Tag = defineAnnotation('Tag');
        var instance = { foo() {} };
        Aspect.annotate(instance, 'foo', [Tag('m')]);
        var meta = { thisRef: instance, methodRef: instance.foo, params: [] };

        // Act --------------
        var annotations = Aspect.getAnnotations(meta);

        // Assert --------------
        expect(annotations).toEqual([Tag('m')]);
    });

    test('returns annotations via accessor target meta', () => {
        // Arrange --------------
        var Tag = defineAnnotation('Tag');
        var instance = { value: 42 };
        Aspect.annotate(instance, 'value', [Tag('a')]);
        var meta = {
            thisRef: instance,
            name: 'value',
            descriptor: Object.getOwnPropertyDescriptor(instance, 'value'),
        };

        // Act --------------
        var annotations = Aspect.getAnnotations(meta);

        // Assert --------------
        expect(annotations).toEqual([Tag('a')]);
    });

    test('annotations of one member do not leak onto another member', () => {
        // Arrange --------------
        var Tag = defineAnnotation('Tag');
        var instance = { foo() {}, bar() {} };

        // Act --------------
        Aspect.annotate(instance, 'foo', [Tag('only-foo')]);

        // Assert --------------
        expect(Aspect.getAnnotations(instance, 'bar')).toEqual([]);
        expect(Aspect.getAnnotations(instance, 'foo')).toEqual([Tag('only-foo')]);
    });
});

describe('Aspect.method', () => {
    test('returns a frozen method aspect carrying the definition and selector', () => {
        // Arrange --------------
        var selector = { memberName: 'foo' };
        var beforeCall = () => {};
        var definition = { displayName: 'LogMethod', beforeCall: beforeCall };

        // Act --------------
        var aspect = Aspect.method(selector, definition);

        // Assert --------------
        expect(aspect).is.frozen;
        expect(aspect.$aspect).toBe('m');
        expect(aspect.displayName).toBe('LogMethod');
        expect(aspect.beforeCall).toBe(beforeCall);
        expect(Object.getOwnPropertySymbols(aspect).length).toBeGreaterThan(0);
    });
});

describe('Aspect.accessor', () => {
    test('returns a frozen accessor aspect carrying the definition and selector', () => {
        // Arrange --------------
        var selector = { memberName: 'value' };
        var beforeGetter = () => {};
        var definition = { displayName: 'WatchValue', beforeGetter: beforeGetter };

        // Act --------------
        var aspect = Aspect.accessor(selector, definition);

        // Assert --------------
        expect(aspect).is.frozen;
        expect(aspect.$aspect).toBe('a');
        expect(aspect.displayName).toBe('WatchValue');
        expect(aspect.beforeGetter).toBe(beforeGetter);
        expect(Object.getOwnPropertySymbols(aspect).length).toBeGreaterThan(0);
    });
});

describe('Aspect.apply selector matching', () => {
    test('matches className against instance.constructor.name', () => {
        // Arrange --------------
        class Sample { foo() {} }
        var instance = new Sample();
        var aspect = Aspect.method({ className: 'Sample' }, { beforeCall: () => {} });

        // Act --------------
        var wrapped = Aspect.apply(instance, [aspect]);

        // Assert --------------
        expect(wrapped).not.toBe(instance);
    });

    test('does not wrap when className does not match', () => {
        // Arrange --------------
        class Sample { foo() {} }
        var instance = new Sample();
        var aspect = Aspect.method({ className: 'Other' }, { beforeCall: () => {} });

        // Act --------------
        var wrapped = Aspect.apply(instance, [aspect]);

        // Assert --------------
        expect(wrapped).toBe(instance);
    });

    test('matches memberName as a string', () => {
        // Arrange --------------
        var instance = { foo() {}, bar() {} };
        var aspect = Aspect.method({ memberName: 'foo' }, { beforeCall: () => {} });

        // Act --------------
        var wrapped = Aspect.apply(instance, [aspect]);

        // Assert --------------
        expect(wrapped).not.toBe(instance);
    });

    test('matches memberName as a RegExp', () => {
        // Arrange --------------
        var instance = { foo() {}, bar() {} };
        var aspect = Aspect.method({ memberName: /^fo/ }, { beforeCall: () => {} });

        // Act --------------
        var wrapped = Aspect.apply(instance, [aspect]);

        // Assert --------------
        expect(wrapped).not.toBe(instance);
    });

    test('matches memberName as an array of patterns', () => {
        // Arrange --------------
        var instance = { foo() {}, bar() {} };
        var aspect = Aspect.method({ memberName: ['nope', /bar$/] }, { beforeCall: () => {} });

        // Act --------------
        var wrapped = Aspect.apply(instance, [aspect]);

        // Assert --------------
        expect(wrapped).not.toBe(instance);
    });

    test('absent memberName matches all members including plain data properties', () => {
        // Arrange --------------
        var instance = { value: 42 };
        var aspect = Aspect.accessor({}, { beforeGetter: () => {} });

        // Act --------------
        var wrapped = Aspect.apply(instance, [aspect]);

        // Assert --------------
        expect(wrapped).not.toBe(instance);
    });

    test('annotations selector matches members carrying the annotation instance', () => {
        // Arrange --------------
        var Tag = defineAnnotation('Tag');
        var instance = { foo() {}, bar() {} };
        Aspect.annotate(instance, 'foo', [Tag('x')]);
        var aspect = Aspect.method({ annotations: Tag('x') }, { beforeCall: () => {} });

        // Act --------------
        var wrapped = Aspect.apply(instance, [aspect]);

        // Assert --------------
        expect(wrapped).not.toBe(instance);
    });

    test('annotations selector matches members carrying an annotation of the given ctor', () => {
        // Arrange --------------
        var Tag = defineAnnotation('Tag');
        var instance = { foo() {}, bar() {} };
        Aspect.annotate(instance, 'foo', [Tag('x')]);
        var aspect = Aspect.method({ annotations: Tag }, { beforeCall: () => {} });

        // Act --------------
        var wrapped = Aspect.apply(instance, [aspect]);

        // Assert --------------
        expect(wrapped).not.toBe(instance);
    });

    test('does not wrap when no member carries the selected annotation', () => {
        // Arrange --------------
        var Tag = defineAnnotation('Tag');
        var Other = defineAnnotation('Other');
        var instance = { foo() {} };
        Aspect.annotate(instance, 'foo', [Other('x')]);
        var aspect = Aspect.method({ annotations: Tag }, { beforeCall: () => {} });

        // Act --------------
        var wrapped = Aspect.apply(instance, [aspect]);

        // Assert --------------
        expect(wrapped).toBe(instance);
    });

    test('supports plain objects with members as own properties', () => {
        // Arrange --------------
        var instance = { foo() {} };
        var aspect = Aspect.method({ memberName: 'foo' }, { beforeCall: () => {} });

        // Act --------------
        var wrapped = Aspect.apply(instance, [aspect]);

        // Assert --------------
        expect(wrapped).not.toBe(instance);
    });

    test('an aspect whose selector matches no member is ignored and does not wrap', () => {
        // Arrange --------------
        var instance = { foo() {} };
        var aspect = Aspect.method({ memberName: 'missing' }, { beforeCall: () => {} });

        // Act --------------
        var wrapped = Aspect.apply(instance, [aspect]);

        // Assert --------------
        expect(wrapped).toBe(instance);
    });
});
