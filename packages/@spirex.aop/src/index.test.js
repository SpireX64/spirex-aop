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

    test('accepts a single annotation object and returns it as a one-element array', () => {
        // Arrange --------------
        var Deprecated = defineAnnotation('Deprecated');
        var instance = { doAction() { } };

        // Act --------------
        Aspect.annotate(instance, 'doAction', Deprecated('1.2.3'));

        // Assert --------------
        expect(Aspect.getAnnotations(instance, 'doAction')).toEqual([Deprecated('1.2.3')]);
    });

    test('a single annotation object is visible via method target meta', () => {
        // Arrange --------------
        var Deprecated = defineAnnotation('Deprecated');
        var instance = { doAction() { } };
        var meta = { thisRef: instance, methodRef: instance.doAction, params: [] };

        // Act --------------
        Aspect.annotate(instance, 'doAction', Deprecated('1.2.3'));

        // Assert --------------
        expect(Aspect.getAnnotations(meta)).toEqual([Deprecated('1.2.3')]);
    });
});

describe('Aspect.method', () => {
    test('returns a frozen method aspect carrying the definition and selector', () => {
        // Arrange --------------
        var selector = { memberName: 'foo' };
        var beforeCall = () => { };
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

describe('Aspect.apply lifecycle and introspection', () => {
    test('returns the original object and isWrapped is false when no aspect matches', () => {
        // Arrange --------------
        var instance = { foo() {} };
        var aspect = Aspect.method({ memberName: 'missing' }, { beforeCall: () => {} });

        // Act --------------
        var result = Aspect.apply(instance, [aspect]);

        // Assert --------------
        expect(result).toBe(instance);
        expect(Aspect.isWrapped(result)).is.false;
    });

    test('returns a wrapped proxy and isWrapped is true when an aspect matches', () => {
        // Arrange --------------
        var instance = { foo() {} };
        var aspect = Aspect.method({ memberName: 'foo' }, { beforeCall: () => {} });

        // Act --------------
        var wrapped = Aspect.apply(instance, [aspect]);

        // Assert --------------
        expect(wrapped).not.toBe(instance);
        expect(Aspect.isWrapped(wrapped)).is.true;
    });

    test('re-apply on a wrapped object returns the same proxy', () => {
        // Arrange --------------
        var instance = { foo() {} };
        var aspect = Aspect.method({ memberName: 'foo' }, { beforeCall: () => {} });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        var reapplied = Aspect.apply(wrapped, [aspect]);

        // Assert --------------
        expect(reapplied).toBe(wrapped);
    });

    test('re-apply after annotating new members picks up the new matches', () => {
        // Arrange --------------
        var Tag = defineAnnotation('Tag');
        var instance = { foo() {}, bar() {} };
        var aspectFoo = Aspect.method({ memberName: 'foo' }, { beforeCall: () => {} });
        var aspectTagged = Aspect.method({ annotations: Tag }, { beforeCall: () => {} });
        var wrapped = Aspect.apply(instance, [aspectFoo]);

        // Act --------------
        Aspect.annotate(instance, 'bar', [Tag()]);
        var updated = Aspect.apply(wrapped, [aspectTagged]);

        // Assert --------------
        expect(updated).toBe(wrapped);
        expect(Aspect.getAspects(updated)).toEqual([aspectFoo, aspectTagged]);
    });

    test('does not add the same aspect instance twice', () => {
        // Arrange --------------
        var instance = { foo() {} };
        var aspect = Aspect.method({ memberName: 'foo' }, { beforeCall: () => {} });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        var reapplied = Aspect.apply(wrapped, [aspect]);

        // Assert --------------
        expect(Aspect.getAspects(reapplied)).toEqual([aspect]);
    });

    test('getAspects returns the applied aspects in apply-list order', () => {
        // Arrange --------------
        var instance = { foo() {} };
        var first = Aspect.method({ memberName: 'foo' }, { beforeCall: () => {} });
        var second = Aspect.method({ memberName: /fo/ }, { afterCall: () => {} });

        // Act --------------
        var wrapped = Aspect.apply(instance, [first, second]);

        // Assert --------------
        expect(Aspect.getAspects(wrapped)).toEqual([first, second]);
    });

    test('an aspect with no matching members is not counted as added', () => {
        // Arrange --------------
        var instance = { foo() {} };
        var matching = Aspect.method({ memberName: 'foo' }, { beforeCall: () => {} });
        var notMatching = Aspect.method({ memberName: 'missing' }, { beforeCall: () => {} });

        // Act --------------
        var wrapped = Aspect.apply(instance, [matching, notMatching]);

        // Assert --------------
        expect(Aspect.getAspects(wrapped)).toEqual([matching]);
    });
});

describe('Aspect method pipeline', () => {
    test('runs beforeCall hooks in apply-list order', () => {
        // Arrange --------------
        var calls = [];
        var instance = { foo() {} };
        var first = Aspect.method({ memberName: 'foo' }, { beforeCall: () => calls.push('first') });
        var second = Aspect.method({ memberName: 'foo' }, { beforeCall: () => calls.push('second') });
        var wrapped = Aspect.apply(instance, [first, second]);

        // Act --------------
        wrapped.foo();

        // Assert --------------
        expect(calls).toEqual(['first', 'second']);
    });

    test('nests aroundCall hooks around the original call', () => {
        // Arrange --------------
        var calls = [];
        var instance = { foo() { calls.push('original'); } };
        var outer = Aspect.method({ memberName: 'foo' }, {
            aroundCall: (meta, proceed) => {
                calls.push('outer-in');
                var result = proceed();
                calls.push('outer-out');
                return result;
            },
        });
        var inner = Aspect.method({ memberName: 'foo' }, {
            aroundCall: (meta, proceed) => {
                calls.push('inner-in');
                var result = proceed();
                calls.push('inner-out');
                return result;
            },
        });
        var wrapped = Aspect.apply(instance, [outer, inner]);

        // Act --------------
        wrapped.foo();

        // Assert --------------
        expect(calls).toEqual(['outer-in', 'inner-in', 'original', 'inner-out', 'outer-out']);
    });

    test('passes aroundCall a proceed pre-bound to thisRef and params', () => {
        // Arrange --------------
        var calls = [];
        var instance = { base: 10, add(a, b) { return this.base + a + b; } };
        var aspect = Aspect.method({ memberName: 'add' }, {
            aroundCall: (meta, proceed) => {
                calls.push('around');
                return proceed();
            },
        });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        var result = wrapped.add(1, 2);

        // Assert --------------
        expect(calls).toEqual(['around']);
        expect(result).toBe(13);
    });

    test('return proceed() preserves the original result', () => {
        // Arrange --------------
        var calls = [];
        var instance = { foo() { return 'original'; } };
        var aspect = Aspect.method({ memberName: 'foo' }, {
            aroundCall: (meta, proceed) => {
                calls.push('around');
                return proceed();
            },
        });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        var result = wrapped.foo();

        // Assert --------------
        expect(calls).toEqual(['around']);
        expect(result).toBe('original');
    });

    test('an aroundCall return value overwrites the result', () => {
        // Arrange --------------
        var instance = { foo() { return 'original'; } };
        var aspect = Aspect.method({ memberName: 'foo' }, { aroundCall: () => 'overwritten' });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        var result = wrapped.foo();

        // Assert --------------
        expect(result).toBe('overwritten');
    });

    test('runs afterCall hooks in reverse order with the final return value', () => {
        // Arrange --------------
        var calls = [];
        var instance = { foo() { return 'original'; } };
        var overwrite = Aspect.method({ memberName: 'foo' }, { aroundCall: () => 'final' });
        var first = Aspect.method({ memberName: 'foo' }, {
            afterCall: (meta, value) => calls.push(['first', value]),
        });
        var second = Aspect.method({ memberName: 'foo' }, {
            afterCall: (meta, value) => calls.push(['second', value]),
        });
        var wrapped = Aspect.apply(instance, [overwrite, first, second]);

        // Act --------------
        wrapped.foo();

        // Assert --------------
        expect(calls).toEqual([['second', 'final'], ['first', 'final']]);
    });

    test('provides thisRef, methodRef and params in the method meta', () => {
        // Arrange --------------
        var metas = [];
        var instance = { foo(a, b) {} };
        var aspect = Aspect.method({ memberName: 'foo' }, { beforeCall: meta => metas.push(meta) });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        wrapped.foo(1, 'x');

        // Assert --------------
        expect(metas[0].thisRef).toBe(wrapped);
        expect(metas[0].methodRef).toBe(instance.foo);
        expect(metas[0].params).toEqual([1, 'x']);
    });
});

describe('Aspect method onThrow', () => {
    test('runs onThrow instead of afterCall on error', () => {
        // Arrange --------------
        var calls = [];
        var error = new Error('boom');
        var instance = { foo() { throw error; } };
        var aspect = Aspect.method({ memberName: 'foo' }, {
            afterCall: () => { calls.push('after'); },
            onThrow: (meta, err) => { calls.push(['onThrow', err]); },
        });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        try { wrapped.foo(); } catch (e) { /* expected */ }

        // Assert --------------
        expect(calls).toEqual([['onThrow', error]]);
    });

    test('runs all onThrow hooks in reverse aspect order with the thrown error', () => {
        // Arrange --------------
        var calls = [];
        var error = new Error('boom');
        var instance = { foo() { throw error; } };
        var first = Aspect.method({ memberName: 'foo' }, {
            onThrow: (meta, err) => { calls.push(['first', err]); },
        });
        var second = Aspect.method({ memberName: 'foo' }, {
            onThrow: (meta, err) => { calls.push(['second', err]); },
        });
        var wrapped = Aspect.apply(instance, [first, second]);

        // Act --------------
        try { wrapped.foo(); } catch (e) { /* expected */ }

        // Assert --------------
        expect(calls).toEqual([['second', error], ['first', error]]);
    });

    test('propagates the error to the caller by default', () => {
        // Arrange --------------
        var calls = [];
        var error = new Error('boom');
        var instance = { foo() { throw error; } };
        var aspect = Aspect.method({ memberName: 'foo' }, {
            onThrow: () => { calls.push('onThrow'); },
        });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        var caught;
        try { wrapped.foo(); } catch (e) { caught = e; }

        // Assert --------------
        expect(calls).toEqual(['onThrow']);
        expect(caught).toBe(error);
    });

    test('a hook returning a value marks the error handled and substitutes the result', () => {
        // Arrange --------------
        var instance = { foo() { throw new Error('boom'); } };
        var aspect = Aspect.method({ memberName: 'foo' }, { onThrow: () => 'recovered' });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        var result = wrapped.foo();

        // Assert --------------
        expect(result).toBe('recovered');
    });

    test('a re-throwing hook does not prevent the remaining hooks from running', () => {
        // Arrange --------------
        var calls = [];
        var error = new Error('boom');
        var instance = { foo() { throw error; } };
        var first = Aspect.method({ memberName: 'foo' }, {
            onThrow: () => { calls.push('first'); },
        });
        var second = Aspect.method({ memberName: 'foo' }, {
            onThrow: (meta, err) => {
                calls.push('second');
                throw err;
            },
        });
        var wrapped = Aspect.apply(instance, [first, second]);

        // Act --------------
        var caught;
        try { wrapped.foo(); } catch (e) { caught = e; }

        // Assert --------------
        expect(calls).toEqual(['second', 'first']);
        expect(caught).toBe(error);
    });
});

describe('Aspect async method parity', () => {
    test('keeps a sync method synchronous (the intercepted result is not a Promise)', () => {
        // Arrange --------------
        var calls = [];
        var instance = { foo() { return 'sync'; } };
        var aspect = Aspect.method({ memberName: 'foo' }, {
            afterCall: (meta, value) => { calls.push(['after', value]); },
        });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        var result = wrapped.foo();

        // Assert --------------
        expect(result).not.toBeInstanceOf(Promise);
        expect(result).toBe('sync');
        expect(calls).toEqual([['after', 'sync']]);
    });

    test('fires afterCall after settle with the resolved value of a Promise-returning method', async () => {
        // Arrange --------------
        var calls = [];
        var instance = { foo() { return Promise.resolve('async-result'); } };
        var aspect = Aspect.method({ memberName: 'foo' }, {
            afterCall: (meta, value) => { calls.push(['after', value]); },
        });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        var result = await wrapped.foo();

        // Assert --------------
        expect(result).toBe('async-result');
        expect(calls).toEqual([['after', 'async-result']]);
    });

    test('routes a rejection reason to onThrow', async () => {
        // Arrange --------------
        var calls = [];
        var error = new Error('async-boom');
        var instance = { foo() { return Promise.reject(error); } };
        var aspect = Aspect.method({ memberName: 'foo' }, {
            onThrow: (meta, err) => { calls.push(['onThrow', err]); },
        });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        var caught;
        try { await wrapped.foo(); } catch (e) { caught = e; }

        // Assert --------------
        expect(calls).toEqual([['onThrow', error]]);
        expect(caught).toBe(error);
    });

    test('an onThrow-substituted result becomes the resolved value of the returned promise', async () => {
        // Arrange --------------
        var instance = { foo() { return Promise.reject(new Error('boom')); } };
        var aspect = Aspect.method({ memberName: 'foo' }, { onThrow: () => 'recovered' });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        var result = await wrapped.foo();

        // Assert --------------
        expect(result).toBe('recovered');
    });
});

describe('Aspect accessor pipeline', () => {
    test('runs beforeGetter hooks in apply-list order', () => {
        // Arrange --------------
        var calls = [];
        var instance = { get prop() { return 1; } };
        var first = Aspect.accessor({ memberName: 'prop' }, {
            beforeGetter: () => { calls.push('first'); },
        });
        var second = Aspect.accessor({ memberName: 'prop' }, {
            beforeGetter: () => { calls.push('second'); },
        });
        var wrapped = Aspect.apply(instance, [first, second]);

        // Act --------------
        var value = wrapped.prop;

        // Assert --------------
        expect(value).toBe(1);
        expect(calls).toEqual(['first', 'second']);
    });

    test('runs afterGetter hooks in reverse order', () => {
        // Arrange --------------
        var calls = [];
        var instance = { get prop() { return 1; } };
        var first = Aspect.accessor({ memberName: 'prop' }, {
            afterGetter: () => { calls.push('first'); },
        });
        var second = Aspect.accessor({ memberName: 'prop' }, {
            afterGetter: () => { calls.push('second'); },
        });
        var wrapped = Aspect.apply(instance, [first, second]);

        // Act --------------
        var value = wrapped.prop;

        // Assert --------------
        expect(value).toBe(1);
        expect(calls).toEqual(['second', 'first']);
    });

    test('fires getter hooks on plain data property reads when memberName is absent', () => {
        // Arrange --------------
        var calls = [];
        var instance = { value: 42 };
        var aspect = Aspect.accessor({}, {
            beforeGetter: meta => { calls.push(meta.name); },
        });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        var value = wrapped.value;

        // Assert --------------
        expect(value).toBe(42);
        expect(calls).toEqual(['value']);
    });

    test('aroundGetter get() keeps the original value', () => {
        // Arrange --------------
        var calls = [];
        var instance = { get prop() { return 'original'; } };
        var aspect = Aspect.accessor({ memberName: 'prop' }, {
            aroundGetter: (meta, get) => {
                calls.push('around');
                return get();
            },
        });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        var value = wrapped.prop;

        // Assert --------------
        expect(calls).toEqual(['around']);
        expect(value).toBe('original');
    });

    test('an aroundGetter return value overwrites the getter result', () => {
        // Arrange --------------
        var instance = { get prop() { return 'original'; } };
        var aspect = Aspect.accessor({ memberName: 'prop' }, { aroundGetter: () => 'overwritten' });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        var value = wrapped.prop;

        // Assert --------------
        expect(value).toBe('overwritten');
    });

    test('runs beforeSetter and afterSetter around the write', () => {
        // Arrange --------------
        var calls = [];
        var instance = {
            _v: 0,
            get prop() { return this._v; },
            set prop(v) { this._v = v; },
        };
        var aspect = Aspect.accessor({ memberName: 'prop' }, {
            beforeSetter: (meta, value) => { calls.push(['before', value]); },
            afterSetter: (meta, value) => { calls.push(['after', value]); },
        });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        wrapped.prop = 7;

        // Assert --------------
        expect(calls).toEqual([['before', 7], ['after', 7]]);
        expect(instance.prop).toBe(7);
    });

    test('aroundSetter overwrites the stored value via set(newValue)', () => {
        // Arrange --------------
        var instance = { value: 0 };
        var aspect = Aspect.accessor({ memberName: 'value' }, {
            aroundSetter: (meta, set) => { set(99); },
        });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        wrapped.value = 7;

        // Assert --------------
        expect(instance.value).toBe(99);
    });

    test('provides thisRef, name and descriptor in the accessor meta', () => {
        // Arrange --------------
        var metas = [];
        var instance = { value: 42 };
        var aspect = Aspect.accessor({ memberName: 'value' }, {
            beforeGetter: meta => { metas.push(meta); },
        });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        var value = wrapped.value;

        // Assert --------------
        expect(metas[0].thisRef).toBe(wrapped);
        expect(metas[0].name).toBe('value');
        expect(metas[0].descriptor)
            .toEqual(Object.getOwnPropertyDescriptor(instance, 'value'));
    });
});

describe('Aspect accessor onThrow', () => {
    test('runs onGetterThrows instead of afterGetter on getter error', () => {
        // Arrange --------------
        var calls = [];
        var error = new Error('boom');
        var instance = { get prop() { throw error; } };
        var aspect = Aspect.accessor({ memberName: 'prop' }, {
            afterGetter: () => { calls.push('after'); },
            onGetterThrows: (meta, err) => { calls.push(['onGetterThrows', err]); },
        });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        try { var value = wrapped.prop; } catch (e) { /* expected */ }

        // Assert --------------
        expect(calls).toEqual([['onGetterThrows', error]]);
    });

    test('runs all onGetterThrows hooks in reverse order with the thrown error', () => {
        // Arrange --------------
        var calls = [];
        var error = new Error('boom');
        var instance = { get prop() { throw error; } };
        var first = Aspect.accessor({ memberName: 'prop' }, {
            onGetterThrows: (meta, err) => { calls.push(['first', err]); },
        });
        var second = Aspect.accessor({ memberName: 'prop' }, {
            onGetterThrows: (meta, err) => { calls.push(['second', err]); },
        });
        var wrapped = Aspect.apply(instance, [first, second]);

        // Act --------------
        try { var value = wrapped.prop; } catch (e) { /* expected */ }

        // Assert --------------
        expect(calls).toEqual([['second', error], ['first', error]]);
    });

    test('propagates the getter error to the caller by default', () => {
        // Arrange --------------
        var calls = [];
        var error = new Error('boom');
        var instance = { get prop() { throw error; } };
        var aspect = Aspect.accessor({ memberName: 'prop' }, {
            onGetterThrows: () => { calls.push('onGetterThrows'); },
        });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        var caught;
        try { var value = wrapped.prop; } catch (e) { caught = e; }

        // Assert --------------
        expect(calls).toEqual(['onGetterThrows']);
        expect(caught).toBe(error);
    });

    test('an onGetterThrows return value substitutes the getter result', () => {
        // Arrange --------------
        var instance = { get prop() { throw new Error('boom'); } };
        var aspect = Aspect.accessor({ memberName: 'prop' }, { onGetterThrows: () => 'recovered' });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        var value = wrapped.prop;

        // Assert --------------
        expect(value).toBe('recovered');
    });

    test('runs onSetterThrows instead of afterSetter on setter error', () => {
        // Arrange --------------
        var calls = [];
        var error = new Error('boom');
        var instance = { set prop(v) { throw error; } };
        var aspect = Aspect.accessor({ memberName: 'prop' }, {
            afterSetter: () => { calls.push('after'); },
            onSetterThrows: (meta, err) => { calls.push(['onSetterThrows', err]); },
        });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        try { wrapped.prop = 1; } catch (e) { /* expected */ }

        // Assert --------------
        expect(calls).toEqual([['onSetterThrows', error]]);
    });

    test('an onSetterThrows return value marks the error handled and accepts the write', () => {
        // Arrange --------------
        var calls = [];
        var instance = { set prop(v) { throw new Error('boom'); } };
        var aspect = Aspect.accessor({ memberName: 'prop' }, {
            onSetterThrows: () => {
                calls.push('onSetterThrows');
                return 'handled';
            },
        });
        var wrapped = Aspect.apply(instance, [aspect]);

        // Act --------------
        var caught;
        try { wrapped.prop = 1; } catch (e) { caught = e; }

        // Assert --------------
        expect(calls).toEqual(['onSetterThrows']);
        expect(caught).toBeUndefined();
    });
});
