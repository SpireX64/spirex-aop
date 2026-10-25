/// <reference path="./index.d.ts"/>

import {
    annotate,
    defineAnnotation,
    getAnnotations,
    hasAnnotation,
} from "./annotations.js";

// #region Shortcuts
var readOnly = Object.freeze;
var isArr = Array.isArray;
var getProto = Object.getPrototypeOf;
var rGet = Reflect.get;
var rSet = Reflect.set;
var len = (a) => a.length;
// #endregion Shortcuts

// #region Symbols
var $selector = Symbol(); // aspect selector
var $proxy = Symbol(); // proxy identity (isWrapped)
var $aspects = Symbol(); // applied aspects
var $matched = Symbol(); // per-member match memo
// #endregion Symbols

// #region Aspects
/** Builds an aspect factory producing frozen aspects tagged by type. */
var factoryAspect = (aspectType) => (selector, definition) =>
    readOnly({
        ...definition,
        $aspect: aspectType,
        [$selector]: selector,
    });
// #endregion Aspects

// #region Matching
function matchStringOrRegex(strOrRegex, value) {
    if (strOrRegex instanceof RegExp) return strOrRegex.test(value);
    else return strOrRegex === value;
}

function isMatchPattern(pattern, value) {
    if (isArr(pattern))
        return pattern.some((item) => matchStringOrRegex(item, value));
    return matchStringOrRegex(pattern, value);
}

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

function findMemberDescriptor(instance, name) {
    var obj = instance;
    while (obj != null) {
        var desc = Object.getOwnPropertyDescriptor(obj, name);
        if (desc) return desc;
        obj = getProto(obj);
    }
    return undefined;
}

/** Checks one member against an aspect's selector (method aspects require a function member). */
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

/** Checks whether an aspect matches any member of an instance. */
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
/** Builds the per-member match memo; runs at apply/re-apply time only. */
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

function getMethodHooks(target, name) {
    var memo = target[$matched];
    var entry = memo != null ? memo[name] : undefined;
    return entry ? entry.m : [];
}

function getAccessorHooks(target, name) {
    var memo = target[$matched];
    var entry = memo != null ? memo[name] : undefined;
    return entry ? entry.a : [];
}

/** Getter pipeline: beforeGetter, nested aroundGetter around the read, afterGetter in reverse. */
function callGetterPipeline(hooks, meta, read) {
    for (var aspect of hooks)
        if (aspect.beforeGetter) aspect.beforeGetter(meta, undefined);

    // Nested arounds: built innermost-out; the IIFE binds hook/next per
    // iteration (var is function-scoped, plain closures would share bindings).
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

/** Setter pipeline: beforeSetter, nested aroundSetter, the write, afterSetter in reverse. */
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

function runMethodAfterHooks(hooks, meta, result) {
    for (var j = len(hooks) - 1; j >= 0; j--) {
        var after = hooks[j].afterCall;
        if (after) after(meta, result);
    }
}

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
function isSameAnnotation(a, b) {
    if (a === b) return true;
    if (a.name !== b.name || len(a.args) !== len(b.args)) return false;
    for (var i = 0; i < len(a.args); i++)
        if (a.args[i] !== b.args[i]) return false;
    return true;
}

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
export { annotate, defineAnnotation, getAnnotations, hasAnnotation };

/** The aspect API surface */
export var Aspect = readOnly({
    method: factoryAspect("m"),
    accessor: factoryAspect("a"),
    apply: applyAspects,
    isWrapped: isWrapped,
    getAspects: getAspects,
});
// #endregion Public API
