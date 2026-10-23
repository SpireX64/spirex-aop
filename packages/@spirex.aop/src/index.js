/// <reference path="./index.d.ts"/>

// #region Shortcuts
var readOnly = Object.freeze;
var isArr = Array.isArray;
var getProto = Object.getPrototypeOf;
var getOwnNames = Object.getOwnPropertyNames;
var getOwnPropDesc = Object.getOwnPropertyDescriptor;
var defineProps = Object.defineProperties;
var len = (a) => a.length;
// #endregion Shortcuts

// #region Symbols
var $selector = Symbol();
var $annotationType = Symbol();
var $annotations = Symbol();
var $proxy = Symbol();
var $aspects = Symbol();
// #endregion Symbols

// #region Annotations
export function defineAnnotation(name) {
    var annotationFactory = (...args) => readOnly(defineProps(
        { name, args },
        { [$annotationType]: { value: true } },
    ));
    return defineProps(annotationFactory, {
        [$annotationType]: { value: true },
        name: { value: name },
    });
}

function annotateMember(instance, key, annotations) {
    if (instance == null
        || !(key in instance)
        || !isArr(annotations)
        || len(annotations) === 0
    ) return;

    var store = instance[$annotations];
    if (!store) store = instance[$annotations] = Object.create(null);

    var list = store[key];
    store[key] = list ? list.concat(annotations) : annotations.slice();
}

function findMemberKey(instance, methodRef) {
    var obj = instance;
    while (obj != null) {
        var names = getOwnNames(obj);
        for (var i = 0; i < len(names); i++) {
            var desc = getOwnPropDesc(obj, names[i]);
            if (desc && desc.value === methodRef) return names[i];
        }
        obj = getProto(obj);
    }
    return undefined;
}

function getAnnotations(target, key) {
    var instance, memberKey;
    if (key !== undefined) {
        instance = target;
        memberKey = key;
    } else if (typeof target.name === 'string') {
        instance = target.thisRef;
        memberKey = target.name;
    } else {
        instance = target.thisRef;
        memberKey = findMemberKey(instance, target.methodRef);
    }

    var store = instance != null ? instance[$annotations] : undefined;
    var list = store != null ? store[memberKey] : undefined;
    return list ? readOnly(list.slice()) : [];
}
// #endregion Annotations

// #region Aspects
var factoryAspect = (aspectType) => (selector, definition) => readOnly({
    ...definition,
    $aspect: aspectType,
    [$selector]: selector,
});
// #endregion Aspects

// #region Matching
function matchStringOrRegex(strOrRegex, value) {
    if (strOrRegex instanceof RegExp)
        return strOrRegex.test(value)
    else
        return strOrRegex === value;
}

function isMatchPattern(pattern, value) {
    if (isArr(pattern)) return pattern.some(item => matchStringOrRegex(item, value));
    return matchStringOrRegex(pattern, value);
}

function isSameAnnotation(a, b) {
    if (a === b) return true;
    if (a.name !== b.name || len(a.args) !== len(b.args)) return false;
    for (var i = 0; i < len(a.args); i++)
        if (a.args[i] !== b.args[i]) return false;
    return true;
}

function isMatchAnnotations(selector, memberAnnotations) {
    var selectors = isArr(selector) ? selector : [selector];
    return selectors.some(item => memberAnnotations.some(
        typeof item === 'function'
            ? ann => ann.name === item.name
            : ann => isSameAnnotation(ann, item),
    ));
}

function getMemberNames(instance) {
    var names = [];
    var obj = instance;
    while (obj != null && obj !== Object.prototype) {
        var ownNames = getOwnNames(obj);
        for (var i = 0; i < len(ownNames); i++) {
            var name = ownNames[i];
            if (name !== 'constructor' && names.indexOf(name) < 0) names.push(name);
        }
        obj = getProto(obj);
    }
    return names;
}

function findMemberDescriptor(instance, name) {
    var obj = instance;
    while (obj != null) {
        var desc = getOwnPropDesc(obj, name);
        if (desc) return desc;
        obj = getProto(obj);
    }
    return undefined;
}

function isMatchMember(instance, name, aspect, selector) {
    if (aspect.$aspect === 'm') {
        var desc = findMemberDescriptor(instance, name);
        if (!desc || typeof desc.value !== 'function') return false;
    }
    if (selector.memberName && !isMatchPattern(selector.memberName, name)) return false;
    if (selector.annotations
        && !isMatchAnnotations(selector.annotations, getAnnotations(instance, name))
    ) return false;
    return true;
}

function isMatchAspect(instance, aspect) {
    var selector = aspect[$selector] || {};

    if (selector.className && !isMatchPattern(selector.className, instance.constructor.name))
        return false;

    return getMemberNames(instance).some(name => isMatchMember(instance, name, aspect, selector));
}
// #endregion Matching

// #region Weaving
function getMethodHooks(target, name) {
    var aspects = target[$aspects] || [];
    return aspects.filter(
        aspect => aspect.$aspect === 'm'
            && isMatchMember(target, name, aspect, aspect[$selector] || {}),
    );
}

function callMethodPipeline(hooks, thisRef, methodRef, params) {
    var meta = { thisRef: thisRef, methodRef: methodRef, params: params };

    for (var aspect of hooks)
        if (aspect.beforeCall) aspect.beforeCall(meta, undefined);

    var proceed = () => methodRef.apply(thisRef, params);
    for (var i = len(hooks) - 1; i >= 0; i--) {
        var around = hooks[i].aroundCall;
        if (around) proceed = ((hook, next) => () => hook(meta, next))(around, proceed);
    }
    var result = proceed();

    for (var j = len(hooks) - 1; j >= 0; j--) {
        var after = hooks[j].afterCall;
        if (after) after(meta, result);
    }
    return result;
}

var aspectProxyHandlers = {
    get(target, key, receiver) {
        var value = Reflect.get(target, key, receiver);
        if (typeof value !== 'function' || key === 'constructor') return value;
        var hooks = getMethodHooks(target, key);
        if (len(hooks) === 0) return value;
        return (...args) => callMethodPipeline(hooks, receiver, value, args);
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
        return existingProxy;
    }

    var proxyInstance = new Proxy(instance, aspectProxyHandlers);
    instance[$proxy] = proxyInstance;
    instance[$aspects] = applied;
    return proxyInstance;
}
// #endregion Weaving

// #region Public API
export var Aspect = readOnly({
    method: factoryAspect('m'),
    accessor: factoryAspect('a'),
    annotate: annotateMember,
    getAnnotations: getAnnotations,
    apply: applyAspects,
    isWrapped: isWrapped,
    getAspects: getAspects,
});
// #endregion Public API
