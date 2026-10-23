import { describe, expect, test } from 'vitest';
import { Aspect, defineAnnotation } from './index.js';

describe('defineAnnotation', () => {
    test('returns a constructor producing frozen { name, args } annotations', () => {
        var WatchLog = defineAnnotation('WatchLog');

        var annotation = WatchLog(1, 'x');

        expect(annotation).toEqual({ name: 'WatchLog', args: [1, 'x'] });
        expect(Object.isFrozen(annotation)).toBe(true);
    });
});

describe('Aspect.annotate / Aspect.getAnnotations', () => {
    test('stores annotations per member and returns them by instance + key', () => {
        var Tag = defineAnnotation('Tag');
        var instance = { foo() {}, bar() {} };

        Aspect.annotate(instance, 'foo', [Tag('a'), Tag('b')]);

        expect(Aspect.getAnnotations(instance, 'foo')).toEqual([Tag('a'), Tag('b')]);
    });

    test('returns annotations via method target meta', () => {
        var Tag = defineAnnotation('Tag');
        var instance = { foo() {} };
        Aspect.annotate(instance, 'foo', [Tag('m')]);

        var meta = { thisRef: instance, methodRef: instance.foo, params: [] };

        expect(Aspect.getAnnotations(meta)).toEqual([Tag('m')]);
    });

    test('returns annotations via accessor target meta', () => {
        var Tag = defineAnnotation('Tag');
        var instance = { value: 42 };
        Aspect.annotate(instance, 'value', [Tag('a')]);

        var meta = {
            thisRef: instance,
            name: 'value',
            descriptor: Object.getOwnPropertyDescriptor(instance, 'value'),
        };

        expect(Aspect.getAnnotations(meta)).toEqual([Tag('a')]);
    });

    test('annotations of one member do not leak onto another member', () => {
        var Tag = defineAnnotation('Tag');
        var instance = { foo() {}, bar() {} };

        Aspect.annotate(instance, 'foo', [Tag('only-foo')]);

        expect(Aspect.getAnnotations(instance, 'bar')).toEqual([]);
        expect(Aspect.getAnnotations(instance, 'foo')).toEqual([Tag('only-foo')]);
    });
});
