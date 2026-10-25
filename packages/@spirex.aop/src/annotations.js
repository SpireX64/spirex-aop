/// <reference path="./annotations.d.ts"/>

// #region Shortcuts
var readOnly = Object.freeze;
var isArr = Array.isArray;
var defineProps = Object.defineProperties;
var hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
// #endregion Shortcuts

// #region Symbols
var $annotationType = Symbol(); // annotation type tag
var $annotations = Symbol(); // per-target annotation store
var $own = Symbol(); // memberless-annotation store key
// #endregion Symbols

// #region Annotations
export function defineAnnotation(name) {
    var annotationFactory = (...args) =>
        readOnly(
            defineProps({ name, args }, { [$annotationType]: { value: true } }),
        );
    return defineProps(annotationFactory, {
        [$annotationType]: { value: true },
        name: { value: name },
    });
}

export function annotate(annotations, classOrInstance, memberName) {
    if (annotations != null && !isArr(annotations)) annotations = [annotations];
    if (
        classOrInstance == null ||
        !isArr(annotations) ||
        annotations.length === 0
    )
        return;
    if (memberName !== undefined) {
        var memberExists =
            typeof classOrInstance === "function"
                ? memberName in (classOrInstance.prototype || {})
                : memberName in classOrInstance;
        if (!memberExists) return;
    }

    // The store must be OWN: constructors inherit through the prototype
    // chain (Derived.__proto__ === Base), so an inherited store would
    // otherwise be shared and mutated across the hierarchy.
    var store = hasOwn(classOrInstance, $annotations)
        ? classOrInstance[$annotations]
        : undefined;
    // Null-proto map: prototype keys (e.g. 'constructor') must not read as annotations.
    if (!store) store = classOrInstance[$annotations] = Object.create(null);

    var key = memberName === undefined ? $own : memberName;
    var list = store[key];
    store[key] = list ? list.concat(annotations) : annotations.slice();
}

function isSameAnnotation(a, b) {
    if (a === b) return true;
    if (a.name !== b.name || a.args.length !== b.args.length) return false;
    for (var i = 0; i < a.args.length; i++)
        if (a.args[i] !== b.args[i]) return false;
    return true;
}

function getAnnotationChain(classOrInstance) {
    var chain = [classOrInstance];
    var ctor =
        typeof classOrInstance === "function"
            ? Object.getPrototypeOf(classOrInstance)
            : classOrInstance.constructor;
    while (ctor != null && ctor !== Function.prototype) {
        chain.push(ctor);
        ctor = Object.getPrototypeOf(ctor);
    }
    return chain;
}

function mergeAnnotations(chain, key) {
    var merged = [];
    for (var target of chain) {
        var store = hasOwn(target, $annotations)
            ? target[$annotations]
            : undefined;
        var list = store != null ? store[key] : undefined;
        if (!list) continue;
        for (var ann of list)
            if (!merged.some((item) => isSameAnnotation(item, ann)))
                merged.push(ann);
    }
    return merged;
}

export function getAnnotations(classOrInstance, memberName) {
    if (classOrInstance == null) return [];
    var key = memberName === undefined ? $own : memberName;
    return readOnly(mergeAnnotations(getAnnotationChain(classOrInstance), key));
}

function matchAnnotation(list, item) {
    return list.some(
        typeof item === "function"
            ? (ann) => ann.name === item.name
            : (ann) => isSameAnnotation(ann, item),
    );
}

export function hasAnnotation(classOrInstance, annotationOrCtor) {
    if (classOrInstance == null) return false;
    return matchAnnotation(
        mergeAnnotations(getAnnotationChain(classOrInstance), $own),
        annotationOrCtor,
    );
}
// #endregion Annotations
