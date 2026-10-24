/// <reference path="./annotations.d.ts"/>

// #region Shortcuts
// Aliases for frequently used standard functions (minified bundle size rule:
// an alias exists only when used more than once and shorter than the original).
var readOnly = Object.freeze;
var isArr = Array.isArray;
var defineProps = Object.defineProperties;
// #endregion Shortcuts

// #region Symbols
// Internal state is hidden behind module-private symbols: they are reachable
// only via Object.getOwnPropertySymbols, keeping them out of the user's way.
var $annotationType = Symbol(); // marks annotation ctors and instances
var $annotations = Symbol(); // target → per-member annotation lists (null-proto map)
// #endregion Symbols

// #region Annotations
/**
 * Defines an annotation type.
 * @param {string} name Annotation name.
 * @returns {TAnnotationCtor<any>} Constructor producing frozen `{ name, args }` annotations.
 */
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

/**
 * Attaches annotations to one member of a class or instance (per-member
 * storage — annotations of one member never leak onto another). A lone
 * annotation is normalized to a one-element array.
 * @param {TAnnotation | readonly TAnnotation[]} annotations Annotation(s) to attach.
 * @param {object} classOrInstance Target class (constructor) or instance.
 * @param {string} [memberName] Member name.
 */
export function annotate(annotations, classOrInstance, memberName) {
    if (annotations != null && !isArr(annotations)) annotations = [annotations];
    if (classOrInstance == null
        || !(memberName in classOrInstance)
        || !isArr(annotations)
        || annotations.length === 0
    ) return;

    var store = classOrInstance[$annotations];
    // Null-prototype map: prototype keys (e.g. 'constructor') must not read as annotations.
    if (!store) store = classOrInstance[$annotations] = Object.create(null);

    var list = store[memberName];
    store[memberName] = list ? list.concat(annotations) : annotations.slice();
}

/**
 * Returns the annotations of one member of a class or instance.
 * @param {object} classOrInstance Target class (constructor) or instance.
 * @param {string} [memberName] Member name.
 * @returns {readonly TAnnotation[]} The member's annotations (empty when none).
 */
export function getAnnotations(classOrInstance, memberName) {
    var store = classOrInstance != null ? classOrInstance[$annotations] : undefined;
    var list = store != null ? store[memberName] : undefined;
    return list ? readOnly(list.slice()) : [];
}
// #endregion Annotations
