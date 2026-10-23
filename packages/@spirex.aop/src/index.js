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

function getAnnotations(target, ...rest) {
    var instance, memberKey;
    if (rest.length > 0) {
        instance = target;
        memberKey = rest[0];
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
// #endregion Matching

// #region Weaving
// #endregion Weaving

// #region Public API
export var Aspect = readOnly({
    method: factoryAspect('m'),
    accessor: factoryAspect('a'),
    annotate: annotateMember,
    getAnnotations: getAnnotations,
});
// #endregion Public API
