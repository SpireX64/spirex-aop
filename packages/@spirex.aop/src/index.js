/// <reference path="./index.d.ts"/>

// #region Shortcuts
var readOnly = Object.freeze;
var isArr = Array.isArray;
var getProto = Object.getPrototypeOf;
var getOwnNames = Object.getOwnPropertyNames;
var getOwnPropDesc = Object.getOwnPropertyDescriptor;
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
    var annotationFactory = (...args) => readOnly(Object.defineProperties(
        { name, args },
        { [$annotationType]: { value: true } },
    ));
    return Object.defineProperties(annotationFactory, {
        [$annotationType]: { value: true },
        name: { value: name },
    });
}

function annotateMember(instance, key, annotations) {
    if (instance == null
        || !(key in instance)
        || !isArr(annotations)
        || annotations.length === 0
    ) return;

    var store = instance[$annotations];
    if (!store) store = instance[$annotations] = {};

    var list = store[key];
    store[key] = list ? list.concat(annotations) : annotations.slice();
}

function findMemberKey(instance, methodRef) {
    var obj = instance;
    while (obj != null) {
        var names = getOwnNames(obj);
        for (var i = 0; i < names.length; i++) {
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
    if (a.name !== b.name || a.args.length !== b.args.length) return false;
    for (var i = 0; i < a.args.length; i++)
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
        for (var i = 0; i < ownNames.length; i++) {
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
function applyAspects(instance, aspects) {
    if (instance == null || !isArr(aspects)) return instance;
    var hasMatch = aspects.some(aspect => isMatchAspect(instance, aspect));
    return hasMatch ? new Proxy(instance, {}) : instance;
}
// #endregion Weaving

// #region Public API
export var Aspect = readOnly({
    method: factoryAspect('m'),
    accessor: factoryAspect('a'),
    annotate: annotateMember,
    getAnnotations: getAnnotations,
    apply: applyAspects,
});
// #endregion Public API
