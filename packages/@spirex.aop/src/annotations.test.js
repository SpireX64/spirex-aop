import { describe, expect, test } from 'vitest';
import { annotate, defineAnnotation, getAnnotations, hasAnnotation, withAnnotations } from './annotations.js';

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

describe('annotate / getAnnotations — class, memberless, inheritance', () => {
    test('annotates a class member by passing the constructor', () => {
        // Arrange --------------
        var Route = defineAnnotation('Route');
        class AuthController { login() { } }

        // Act --------------
        annotate([Route('api/auth')], AuthController, 'login');

        // Assert --------------
        expect(getAnnotations(new AuthController(), 'login')).toEqual([Route('api/auth')]);
    });

    test('annotates the class itself when memberName is omitted', () => {
        // Arrange --------------
        var Tag = defineAnnotation('Tag');
        class Service { }

        // Act --------------
        annotate([Tag('svc')], Service);

        // Assert --------------
        expect(getAnnotations(Service)).toEqual([Tag('svc')]);
    });

    test('annotates the instance itself when memberName is omitted', () => {
        // Arrange --------------
        var Tag = defineAnnotation('Tag');
        var instance = { };

        // Act --------------
        annotate([Tag('own')], instance);

        // Assert --------------
        expect(getAnnotations(instance)).toEqual([Tag('own')]);
    });

    test('merges annotations up the prototype chain nearest-first with dedup by name+args', () => {
        // Arrange --------------
        var Tag = defineAnnotation('Tag');
        class Base { work() { } }
        class Derived extends Base { work() { } }
        annotate([Tag('base'), Tag('shared')], Base, 'work');
        annotate([Tag('derived'), Tag('shared')], Derived, 'work');
        var instance = new Derived();
        annotate([Tag('instance')], instance, 'work');

        // Act --------------
        var annotations = getAnnotations(instance, 'work');

        // Assert --------------
        expect(annotations).toEqual([Tag('instance'), Tag('derived'), Tag('shared'), Tag('base')]);
    });
});

describe('hasAnnotation', () => {
    test('matches a memberless annotation by instance', () => {
        // Arrange --------------
        var Tag = defineAnnotation('Tag');
        var instance = { };
        annotate([Tag('x')], instance);

        // Act --------------
        var result = hasAnnotation(instance, Tag('x'));

        // Assert --------------
        expect(result).is.true;
    });

    test('matches a memberless annotation by constructor', () => {
        // Arrange --------------
        var Tag = defineAnnotation('Tag');
        var instance = { };
        annotate([Tag('x')], instance);

        // Act --------------
        var result = hasAnnotation(instance, Tag);

        // Assert --------------
        expect(result).is.true;
    });

    test('respects the inheritance merge', () => {
        // Arrange --------------
        var Tag = defineAnnotation('Tag');
        class Base { }
        class Derived extends Base { }
        annotate([Tag('base')], Base);

        // Act --------------
        var result = hasAnnotation(new Derived(), Tag);

        // Assert --------------
        expect(result).is.true;
    });

    test('returns false when the annotation is absent', () => {
        // Arrange --------------
        var Tag = defineAnnotation('Tag');
        var Other = defineAnnotation('Other');
        var instance = { };
        annotate([Tag('x')], instance);

        // Act --------------
        var result = hasAnnotation(instance, Other);

        // Assert --------------
        expect(result).is.false;
    });
});

describe('withAnnotations', () => {
    test('the predicate is truthy when every listed annotation is present on the member', () => {
        // Arrange --------------
        var Route = defineAnnotation('Route');
        var Auth = defineAnnotation('Auth');
        var instance = { login() { } };
        annotate([Route('api/auth'), Auth()], instance, 'login');
        var predicate = withAnnotations([Route, Auth]);
        var meta = {
            thisRef: instance,
            name: 'login',
            descriptor: Object.getOwnPropertyDescriptor(instance, 'login'),
        };

        // Act --------------
        var result = predicate(meta);

        // Assert --------------
        expect(result).is.true;
    });

    test('the predicate is falsy when a listed annotation is missing', () => {
        // Arrange --------------
        var Route = defineAnnotation('Route');
        var Auth = defineAnnotation('Auth');
        var instance = { login() { } };
        annotate([Route('api/auth')], instance, 'login');
        var predicate = withAnnotations([Route, Auth]);
        var meta = {
            thisRef: instance,
            name: 'login',
            descriptor: Object.getOwnPropertyDescriptor(instance, 'login'),
        };

        // Act --------------
        var result = predicate(meta);

        // Assert --------------
        expect(result).is.false;
    });
});
