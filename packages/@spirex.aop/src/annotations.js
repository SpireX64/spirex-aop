/// <reference path="./annotations.d.ts"/>

// #region Shortcuts
// Aliases for frequently used standard functions (minified bundle size rule:
// an alias exists only when used more than once and shorter than the original).
var readOnly = Object.freeze;
var isArr = Array.isArray;
var defineProps = Object.defineProperties;
var hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
// #endregion Shortcuts

// #region Symbols
// Internal state is hidden behind module-private symbols: they are reachable
// only via Object.getOwnPropertySymbols, keeping them out of the user's way.
var $annotationType = Symbol(); // marks annotation ctors and instances
var $annotations = Symbol(); // target → per-member annotation lists (null-proto map)
var $own = Symbol(); // store key for memberless (target-level) annotations
// #endregion Symbols

// #region Annotations
/**
 * Defines an annotation type.
 * @param {string} name Annotation name.
 * @returns {TAnnotationCtor<any>} Constructor producing frozen `{ name, args }` annotations.
 */
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

/**
 * Attaches annotations to a class (constructor) or instance — to one member
 * when `memberName` is given (for a class, the member lives on its
 * prototype), or to the target itself (memberless) when omitted. A lone
 * annotation is normalized to a one-element array.
 * @param {TAnnotation | readonly TAnnotation[]} annotations Annotation(s) to attach.
 * @param {object} classOrInstance Target class (constructor) or instance.
 * @param {string} [memberName] Member name.
 */
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

/**
 * Structural equality of two annotations: same name and same args.
 * @param {TAnnotation} a
 * @param {TAnnotation} b
 * @returns {boolean}
 */
function isSameAnnotation(a, b) {
    if (a === b) return true;
    if (a.name !== b.name || a.args.length !== b.args.length) return false;
    for (var i = 0; i < a.args.length; i++)
        if (a.args[i] !== b.args[i]) return false;
    return true;
}

/**
 * Builds the read chain for a target: the target itself, then its
 * constructor (for instances), then base constructors up the prototype
 * chain — nearest first.
 * @param {object} classOrInstance Target class (constructor) or instance.
 * @returns {object[]} The chain, nearest first.
 */
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

/**
 * Merges the annotation lists stored under `key` across the chain,
 * nearest-first, deduplicated by name+args.
 * @param {object[]} chain Read chain from {@link getAnnotationChain}.
 * @param {string | symbol} key Member name, or `$own` for memberless annotations.
 * @returns {TAnnotation[]} The merged annotations.
 */
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

/**
 * Returns the annotations of a class or instance — of one member when
 * `memberName` is given, or the target's own (memberless) annotations when
 * omitted. Reads merge instance → class → base classes up the prototype
 * chain, nearest-first, deduplicated by name+args.
 * @param {object} classOrInstance Target class (constructor) or instance.
 * @param {string} [memberName] Member name.
 * @returns {readonly TAnnotation[]} The annotations (empty when none).
 */
export function getAnnotations(classOrInstance, memberName) {
    if (classOrInstance == null) return [];
    var key = memberName === undefined ? $own : memberName;
    return readOnly(mergeAnnotations(getAnnotationChain(classOrInstance), key));
}
/**
 * Matches one annotation reference (instance or constructor) against a list:
 * a constructor matches by annotation name, an instance matches structurally.
 * @param {readonly TAnnotation[]} list Annotation list.
 * @param {TAnnotationOrCtor} item Annotation instance or constructor.
 * @returns {boolean}
 */
function matchAnnotation(list, item) {
    return list.some(
        typeof item === "function"
            ? (ann) => ann.name === item.name
            : (ann) => isSameAnnotation(ann, item),
    );
}

/**
 * Checks whether a class or instance carries the given annotation (by
 * instance or constructor), respecting the inheritance merge.
 * @param {object} classOrInstance Target class (constructor) or instance.
 * @param {TAnnotationOrCtor} annotationOrCtor Annotation instance or constructor.
 * @returns {boolean}
 */
export function hasAnnotation(classOrInstance, annotationOrCtor) {
    if (classOrInstance == null) return false;
    return matchAnnotation(
        mergeAnnotations(getAnnotationChain(classOrInstance), $own),
        annotationOrCtor,
    );
}
// #endregion Annotations
