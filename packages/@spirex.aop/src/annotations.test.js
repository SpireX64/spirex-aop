import { describe, expect, test } from 'vitest';
import { annotate, defineAnnotation, getAnnotations } from './annotations.js';

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

describe('annotate / getAnnotations', () => {
    test('stores annotations per member and returns them by instance + member name', () => {
        // Arrange --------------
        var Tag = defineAnnotation('Tag');
        var instance = { foo() { }, bar() { } };

        // Act --------------
        annotate([Tag('a'), Tag('b')], instance, 'foo');

        // Assert --------------
        expect(getAnnotations(instance, 'foo')).toEqual([Tag('a'), Tag('b')]);
    });

    test('normalizes a single annotation to a one-element array', () => {
        // Arrange --------------
        var Deprecated = defineAnnotation('Deprecated');
        var instance = { doAction() { } };

        // Act --------------
        annotate(Deprecated('1.2.3'), instance, 'doAction');

        // Assert --------------
        expect(getAnnotations(instance, 'doAction')).toEqual([Deprecated('1.2.3')]);
    });

    test('annotations of one member do not leak onto another member', () => {
        // Arrange --------------
        var Tag = defineAnnotation('Tag');
        var instance = { foo() { }, bar() { } };

        // Act --------------
        annotate([Tag('only-foo')], instance, 'foo');

        // Assert --------------
        expect(getAnnotations(instance, 'bar')).toEqual([]);
        expect(getAnnotations(instance, 'foo')).toEqual([Tag('only-foo')]);
    });
});
