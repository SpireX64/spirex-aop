/// <reference path="./index.d.ts"/>

// The annotations API lives in ./annotations.js (standalone subpath) and is
// re-exported at the bottom for convenience; the aspect runtime never reads it.
import {
    annotate,
    defineAnnotation,
    getAnnotations,
    hasAnnotation,
} from "./annotations.js";

// #region Shortcuts
// Aliases for frequently used standard functions (minified bundle size rule:
// an alias exists only when used more than once and shorter than the original).
var readOnly = Object.freeze;
var isArr = Array.isArray;
var getProto = Object.getPrototypeOf;
var rGet = Reflect.get;
var rSet = Reflect.set;
var len = (a) => a.length;
// #endregion Shortcuts

// #region Symbols
// Internal state is hidden behind module-private symbols: they are reachable
// only via Object.getOwnPropertySymbols, keeping them out of the user's way.
var $selector = Symbol(); // aspect → its TMemberSelector
var $proxy = Symbol(); // target → its Aspect Proxy (identity marker for isWrapped)
var $aspects = Symbol(); // target → currently applied aspects, in apply-list order
var $matched = Symbol(); // target → per-member matched-aspect memo (apply-time)
// #endregion Symbols

// #region Aspects
/**
 * Builds an aspect factory for the given aspect type tag.
 * @param {'m' | 'a'} aspectType `'m'` — method aspect, `'a'` — accessor aspect.
 * @returns {(selector: TMemberSelector, definition: object) => TAnyAspect}
 *   Factory producing a frozen aspect: the definition fields, the `$aspect`
 *   type tag, and the selector hidden under the `$selector` symbol.
 */
var factoryAspect = (aspectType) => (selector, definition) =>
    readOnly({
        ...definition,
        $aspect: aspectType,
        [$selector]: selector,
    });
// #endregion Aspects

// #region Matching
/**
 * Matches a value against a string-or-RegExp pattern.
 * @param {string | RegExp} strOrRegex Pattern.
 * @param {string} value Value to test.
 * @returns {boolean}
 */
function matchStringOrRegex(strOrRegex, value) {
    if (strOrRegex instanceof RegExp) return strOrRegex.test(value);
    else return strOrRegex === value;
}

/**
 * Matches a value against a pattern or an array of patterns (any match wins).
 * @param {TNamePattern | readonly TNamePattern[]} pattern Pattern(s).
 * @param {string} value Value to test.
 * @returns {boolean}
 */
function isMatchPattern(pattern, value) {
    if (isArr(pattern))
        return pattern.some((item) => matchStringOrRegex(item, value));
    return matchStringOrRegex(pattern, value);
}

/**
 * Lists all member names of an instance — own properties AND prototype-chain
 * members (plain data properties included; `constructor` and Object.prototype
 * excluded). Symbol-keyed internal state never appears here.
 * @param {object} instance Target instance.
 * @returns {string[]} Member names.
 */
function getMemberNames(instance) {
    var names = [];
    var obj = instance;
    while (obj != null && obj !== Object.prototype) {
        var ownNames = Object.getOwnPropertyNames(obj);
        for (var i = 0; i < len(ownNames); i++) {
            var name = ownNames[i];
            if (name !== "constructor" && names.indexOf(name) < 0)
                names.push(name);
        }
        obj = getProto(obj);
    }
    return names;
}

/**
 * Finds a member's property descriptor, walking the prototype chain.
 * @param {object} instance Target instance.
 * @param {string} name Member name.
 * @returns {PropertyDescriptor | undefined}
 */
function findMemberDescriptor(instance, name) {
    var obj = instance;
    while (obj != null) {
        var desc = Object.getOwnPropertyDescriptor(obj, name);
        if (desc) return desc;
        obj = getProto(obj);
    }
    return undefined;
}

/**
 * Checks one member against an aspect's selector: method aspects require a
 * function member; `memberName` restricts by name pattern (absent = all
 * members, including plain data properties); `predicate` receives
 * `{ thisRef, name, descriptor }` and must be truthy.
 * @param {object} instance Target instance.
 * @param {string} name Member name.
 * @param {TAnyAspect} aspect The aspect.
 * @param {TMemberSelector} selector The aspect's selector.
 * @returns {boolean}
 */
function isMatchMember(instance, name, aspect, selector) {
    var desc;
    if (aspect.$aspect === "m" || selector.predicate)
        desc = findMemberDescriptor(instance, name);
    if (aspect.$aspect === "m" && (!desc || typeof desc.value !== "function"))
        return false;
    if (selector.memberName && !isMatchPattern(selector.memberName, name))
        return false;
    if (
        selector.predicate &&
        !selector.predicate({ thisRef: instance, name: name, descriptor: desc })
    )
        return false;
    return true;
}

/**
 * Checks whether an aspect matches any member of an instance
 * (`className` is tested against `instance.constructor.name` first).
 * @param {object} instance Target instance.
 * @param {TAnyAspect} aspect The aspect.
 * @returns {boolean}
 */
function isMatchAspect(instance, aspect) {
    var selector = aspect[$selector] || {};

    if (
        selector.className &&
        !isMatchPattern(selector.className, instance.constructor.name)
    )
        return false;

    return getMemberNames(instance).some((name) =>
        isMatchMember(instance, name, aspect, selector),
    );
}
// #endregion Matching

// #region Weaving
/**
 * Builds the per-member match memo: member name → matched aspects split by
 * type (`m`/`a`), in apply-list order. Computed at apply/re-apply time only —
 * selector and predicate evaluation stays off the proxy hot path.
 * @param {object} instance Target instance.
 * @param {readonly TAnyAspect[]} applied Currently applied aspects.
 * @returns {object} The memo (null-proto map).
 */
function buildMatchMemo(instance, applied) {
    var memo = Object.create(null);
    for (var name of getMemberNames(instance)) {
        var entry = { m: [], a: [] };
        for (var aspect of applied) {
            if (isMatchMember(instance, name, aspect, aspect[$selector] || {}))
                entry[aspect.$aspect].push(aspect);
        }
        if (len(entry.m) > 0 || len(entry.a) > 0) memo[name] = entry;
    }
    return memo;
}

/**
 * Reads the memoized method aspects matching a member (apply-list order).
 * @param {object} target Proxy target.
 * @param {string} name Member name.
 * @returns {TAnyAspect[]} Matching method aspects (empty when none).
 */
function getMethodHooks(target, name) {
    var memo = target[$matched];
    var entry = memo != null ? memo[name] : undefined;
    return entry ? entry.m : [];
}

/**
 * Reads the memoized accessor aspects matching a member (apply-list order).
 * @param {object} target Proxy target.
 * @param {string} name Member name.
 * @returns {TAnyAspect[]} Matching accessor aspects (empty when none).
 */
function getAccessorHooks(target, name) {
    var memo = target[$matched];
    var entry = memo != null ? memo[name] : undefined;
    return entry ? entry.a : [];
}

/**
 * Getter pipeline: `beforeGetter` (list order) → nested `aroundGetter` around
 * the original read → `afterGetter` (reverse order). An `aroundGetter` return
 * value overwrites the result; `get()` keeps the original. On error the hybrid
 * `onGetterThrows` chain runs instead of `afterGetter`.
 * @param {TAnyAspect[]} hooks Matching accessor aspects, in apply-list order.
 * @param {TAccessorAspectTarget} meta Accessor hook meta.
 * @param {TAccessorGetFunction} read Thunk performing the original read.
 * @returns {unknown} The final getter result.
 */
function callGetterPipeline(hooks, meta, read) {
    for (var aspect of hooks)
        if (aspect.beforeGetter) aspect.beforeGetter(meta, undefined);

    // Nested arounds: built innermost-out; the IIFE binds hook/next per
    // iteration (var is function-scoped — plain closures would share bindings).
    var get = read;
    for (var i = len(hooks) - 1; i >= 0; i--) {
        var aroundGetter = hooks[i].aroundGetter;
        if (aroundGetter)
            get = (
                (hook, next) => () =>
                    hook(meta, next)
            )(aroundGetter, get);
    }
    var result;
    try {
        result = get();
    } catch (error) {
        return runErrorHooks(hooks, "onGetterThrows", meta, error);
    }

    for (var j = len(hooks) - 1; j >= 0; j--) {
        var afterGetter = hooks[j].afterGetter;
        if (afterGetter) afterGetter(meta, result);
    }
    return result;
}

/**
 * Setter pipeline: `beforeSetter` (list order) → nested `aroundSetter` → the
 * original write → `afterSetter` (reverse order, with the final stored value).
 * `aroundSetter` overwrites the stored value via `set(newValue)`; not calling
 * `set` skips the write. On error the hybrid `onSetterThrows` chain runs
 * instead of `afterSetter`; a handled error accepts the write.
 * @param {TAnyAspect[]} hooks Matching accessor aspects, in apply-list order.
 * @param {TAccessorAspectTarget} meta Accessor hook meta.
 * @param {unknown} value The incoming value.
 * @param {TAccessorSetFunction} write Thunk performing the original write.
 */
function callSetterPipeline(hooks, meta, value, write) {
    for (var aspect of hooks)
        if (aspect.beforeSetter) aspect.beforeSetter(meta, value);

    var storedValue = value;
    var set = (v) => {
        storedValue = v;
        write(v);
    };
    for (var i = len(hooks) - 1; i >= 0; i--) {
        var aroundSetter = hooks[i].aroundSetter;
        if (aroundSetter)
            set = (
                (hook, next) => () =>
                    hook(meta, next)
            )(aroundSetter, set);
    }
    try {
        set(value);
    } catch (error) {
        runErrorHooks(hooks, "onSetterThrows", meta, error);
        return;
    }

    for (var j = len(hooks) - 1; j >= 0; j--) {
        var afterSetter = hooks[j].afterSetter;
        if (afterSetter) afterSetter(meta, storedValue);
    }
}

/**
 * Hybrid error model: All error hooks run in reverse aspect
 * order with the thrown error; a re-throwing hook does not stop the chain;
 * a hook returning a value marks the error handled and substitutes the result;
 * otherwise the original error propagates.
 * @param {TAnyAspect[]} hooks Matching aspects, in apply-list order.
 * @param {string} hookName `'onThrow'` | `'onGetterThrows'` | `'onSetterThrows'`.
 * @param {TMethodAspectTarget | TAccessorAspectTarget} meta Hook meta.
 * @param {unknown} error The thrown error.
 * @returns {unknown} The substituted result when handled.
 * @throws The original error when no hook handled it.
 */
function runErrorHooks(hooks, hookName, meta, error) {
    var handled = false;
    var result;
    for (var k = len(hooks) - 1; k >= 0; k--) {
        var onThrow = hooks[k][hookName];
        if (onThrow) {
            try {
                var handledValue = onThrow(meta, error);
                if (handledValue !== undefined) {
                    result = handledValue;
                    handled = true;
                }
            } catch {
                /* a re-throwing hook does not stop the chain */
            }
        }
    }
    if (!handled) throw error;
    return result;
}

/**
 * Runs `afterCall` hooks in reverse aspect order with the final return value.
 * @param {TAnyAspect[]} hooks Matching method aspects, in apply-list order.
 * @param {TMethodAspectTarget} meta Method hook meta.
 * @param {unknown} result The final call result.
 */
function runMethodAfterHooks(hooks, meta, result) {
    for (var j = len(hooks) - 1; j >= 0; j--) {
        var after = hooks[j].afterCall;
        if (after) after(meta, result);
    }
}

/**
 * Method pipeline: `beforeCall` (list order) → nested `aroundCall` around the
 * original method → `afterCall` (reverse order, final value). `proceed` is
 * pre-bound to `thisRef` and `params`; an `aroundCall` return value overwrites
 * the result (`return proceed()` keeps the original). Errors go to the hybrid
 * `onThrow` chain instead of `afterCall`. Async parity: a Promise result is
 * chained on settle (resolved value → `afterCall`, rejection → `onThrow`,
 * substituted value → resolved value); sync results are never Promise-wrapped.
 * @param {TAnyAspect[]} hooks Matching method aspects, in apply-list order.
 * @param {unknown} thisRef The wrapped instance the call was made on.
 * @param {Function} methodRef The original method.
 * @param {unknown[]} params Call arguments.
 * @returns {unknown} The final call result.
 */
function callMethodPipeline(hooks, thisRef, methodRef, params) {
    var meta = { thisRef: thisRef, methodRef: methodRef, params: params };

    for (var aspect of hooks)
        if (aspect.beforeCall) aspect.beforeCall(meta, undefined);

    var proceed = () => methodRef.apply(thisRef, params);
    for (var i = len(hooks) - 1; i >= 0; i--) {
        var around = hooks[i].aroundCall;
        if (around)
            proceed = (
                (hook, next) => () =>
                    hook(meta, next)
            )(around, proceed);
    }

    var result;
    try {
        result = proceed();
    } catch (error) {
        return runErrorHooks(hooks, "onThrow", meta, error);
    }

    if (result instanceof Promise)
        return result.then(
            (value) => {
                runMethodAfterHooks(hooks, meta, value);
                return value;
            },
            (reason) => runErrorHooks(hooks, "onThrow", meta, reason),
        );

    runMethodAfterHooks(hooks, meta, result);
    return result;
}

var aspectProxyHandlers = {
    get(target, key, receiver) {
        if (typeof key !== "string" || key === "constructor")
            return rGet(target, key, receiver);

        var accessorHooks = getAccessorHooks(target, key);
        if (len(accessorHooks) > 0) {
            var meta = {
                thisRef: receiver,
                name: key,
                descriptor: findMemberDescriptor(target, key),
            };
            return callGetterPipeline(accessorHooks, meta, () =>
                rGet(target, key, receiver),
            );
        }

        var value = Reflect.get(target, key, receiver);
        if (typeof value !== "function") return value;
        var methodHooks = getMethodHooks(target, key);
        if (len(methodHooks) === 0) return value;
        return (...args) =>
            callMethodPipeline(methodHooks, receiver, value, args);
    },
    set(target, key, value, receiver) {
        if (typeof key !== "string" || key === "constructor")
            return rSet(target, key, value, receiver);

        var hooks = getAccessorHooks(target, key);
        if (len(hooks) === 0) return rSet(target, key, value, receiver);

        var meta = {
            thisRef: receiver,
            name: key,
            descriptor: findMemberDescriptor(target, key),
        };
        callSetterPipeline(hooks, meta, value, (v) =>
            rSet(target, key, v, receiver),
        );
        return true;
    },
};

function isWrapped(instance) {
    return instance != null && instance[$proxy] === instance;
}

function getAspects(instance) {
    var applied = instance != null ? instance[$aspects] : undefined;
    return applied ? readOnly(applied.slice()) : [];
}

/**
 * Applies aspects to an instance. Returns the original object untouched when
 * no aspect matches any member. Otherwise a single Aspect Proxy per object:
 * re-`apply` re-checks selectors, updates the symbol-hidden applied-aspects
 * list in place, and rebuilds the per-member match memo instead of creating
 * a new proxy; the same aspect instance is never added twice; an aspect
 * matching no member is ignored.
 * @param {object} instance Target instance (or its existing Aspect Proxy).
 * @param {readonly TAnyAspect[]} aspects Aspects to apply.
 * @returns {object} The Aspect Proxy, or the original instance when nothing matched.
 */
function applyAspects(instance, aspects) {
    if (instance == null || !isArr(aspects)) return instance;

    var applied = instance[$aspects] ? instance[$aspects].slice() : [];
    for (var aspect of aspects) {
        if (applied.indexOf(aspect) < 0 && isMatchAspect(instance, aspect))
            applied.push(aspect);
    }
    if (len(applied) === 0) return instance;

    var existingProxy = instance[$proxy];
    if (existingProxy) {
        instance[$aspects] = applied;
        instance[$matched] = buildMatchMemo(instance, applied);
        return existingProxy;
    }

    var proxyInstance = new Proxy(instance, aspectProxyHandlers);
    instance[$proxy] = proxyInstance;
    instance[$aspects] = applied;
    instance[$matched] = buildMatchMemo(instance, applied);
    return proxyInstance;
}
// #endregion Weaving

// #region Predicate helpers
/**
 * Structural equality of two annotations: same name and same args.
 * Local to the aspect module — withAnnotations is aspect-side, so the
 * comparison lives here (the annotations module keeps its own copy).
 * @param {TAnnotation} a
 * @param {TAnnotation} b
 * @returns {boolean}
 */
function isSameAnnotation(a, b) {
    if (a === b) return true;
    if (a.name !== b.name || len(a.args) !== len(b.args)) return false;
    for (var i = 0; i < len(a.args); i++)
        if (a.args[i] !== b.args[i]) return false;
    return true;
}

/**
 * Builds a member predicate truthy only when every listed annotation is
 * present on the member identified by the meta (respecting the inheritance
 * merge). A constructor entry matches by annotation name, an instance entry
 * matches structurally. User-invoked helper: it reads annotation storage via
 * the annotations module's public API — the matching runtime never does.
 * @param {readonly TAnnotationOrCtor[]} list Required annotations (instances or ctors).
 * @returns {(meta: TAnnotationPredicateMeta) => boolean} The predicate.
 */
export function withAnnotations(list) {
    return (meta) => {
        var present = getAnnotations(meta.thisRef, meta.name);
        return list.every((item) =>
            present.some(
                typeof item === "function"
                    ? (ann) => ann.name === item.name
                    : (ann) => isSameAnnotation(ann, item),
            ),
        );
    };
}
// #endregion Predicate helpers

// #region Public API
// withAnnotations is aspect-side (unusable without aspects) — implemented above.
export { annotate, defineAnnotation, getAnnotations, hasAnnotation };

/**
 * The aspect API surface (see `IAspect` in `index.d.ts`).
 * @type {IAspect}
 */
export var Aspect = readOnly({
    method: factoryAspect("m"),
    accessor: factoryAspect("a"),
    apply: applyAspects,
    isWrapped: isWrapped,
    getAspects: getAspects,
});
// #endregion Public API
