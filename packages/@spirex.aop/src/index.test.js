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
