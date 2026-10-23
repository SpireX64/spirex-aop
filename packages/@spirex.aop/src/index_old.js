/// <reference path="./index.d.ts"/>

// #region Shortcuts
var readOnly = Object.freeze;
var isArr = Array.isArray;
// #endregion Shortcuts

// #region Symbols and Constants
var $selector = Symbol();
var $annotationsSet = Symbol();
var $annotationType = Symbol();
// #endregion

/**
 * @param {string | RegExp} strOrRegex
 * @returns {boolean}
 */
function matchStringOrRegex(strOrRegex, value) {
    if (strOrRegex instanceof RegExp)
        return strOrRegex.test(value)
    else
        return strOrRegex === value;
}

var factoryAspect = (aspectType) => (selector, definition) => readOnly({
    ...definition,
    $aspect: aspectType,
    [$selector]: selector,
});

export function defineAnnotation(name) {
    var annotationFactory = (...args) => readOnly({ name, args, [$annotationType]: true })
    return Object.defineProperties(annotationFactory, {
        [$annotationType]: { value: true },
        name: { value: name },
    });
}

function annotateMember(instance, selector, annotations) {
    if (instance == null
        || !(selector in instance)
        || !isArr(annotations)
        || annotations.length === 0
    ) return instance

    /** @type {Set} */
    var instanceAnnotationsSet = instance[$annotationsSet];
    if (instanceAnnotationsSet) {
        for (var ann of annotations)
            instanceAnnotationsSet.add(ann);
    } else {
        instance[$annotationsSet] = new Set(annotations);
    }
}

function isMatchAspect(instance, aspect) {
    var aspectSelectors = aspect[$selector];

    // Class check
    var className = instance.constructor.name;
    var classNameSelectors = aspectSelectors.className;
    if (classNameSelectors) {
        if (!isArr(classNameSelectors)) classNameSelectors = [classNameSelectors];
        var isClassMatch = classNameSelectors.some(
            classNameSelector => matchStringOrRegex(classNameSelector, className),
        );
        if (!isClassMatch) return false;
    }

    if (aspect.$aspect === 'm') {
        // --- Method Aspect ---

        // Take all member names that match selector
        // 'undefined' selector is 'any method'
        var methodSelector = aspectSelectors.memberName;
        var methodNames = Object.getOwnPropertyNames(instance);
        if (methodSelector)
            methodNames = methodNames.filter(name => matchStringOrRegex(methodSelector, name));

        // Map names to methods references and check function type
        var methorRefs = methodNames
            .map(name => instance[name])
            .filter(method => typeof method === 'function');


    } else {
        // --- Accessor Aspect ---

        // Extract all prop descriptors of the instance
        var descriptors = Object.getOwnPropertyDescriptors(instance);

        // Get all properties names that match selector
        // 'undefined' selector is 'any property'
        var propSelector = aspectSelectors.memberName;
        var propNames = Object.keys(descriptors);
        if (propSelector)
            propNames = propNames.filter(name => matchStringOrRegex(propSelector, name));

        // Filter descriptors
        descriptors = propNames.reduce((out, propName) => (out[propName] = descriptors[propName], out), {});

    }
}

function wrapToAspectProxy(instance, aspects) {

}

export var Aspect = readOnly({
    method: factoryAspect('m'),
    accessor: factoryAspect('a'),
    annotate: annotateMember,
    apply: wrapToAspectProxy,
});
