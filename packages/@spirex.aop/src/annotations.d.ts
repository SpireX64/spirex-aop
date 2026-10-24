/** An annotation instance: frozen `{ name, args }` produced by an annotation constructor. */
export type TAnnotation = {
    readonly name: string;
    readonly args: readonly unknown[];
};

/** Constructor producing frozen {@link TAnnotation} instances. */
export type TAnnotationCtor<Args extends any[]> = (...args: Args) => TAnnotation;

/** Annotation reference: an annotation instance or its constructor. */
export type TAnnotationOrCtor = TAnnotationCtor<any> | TAnnotation;

/** Metadata passed to annotation predicates (`withAnnotations`). */
export type TAnnotationPredicateMeta = {
    /** The wrapped instance the member was accessed on. */
    thisRef: unknown;
    /** Member name. */
    name: string;
    /** The member's property descriptor. */
    descriptor: PropertyDescriptor;
};

/**
 * Defines an annotation type.
 * @param name Annotation name.
 * @returns A constructor producing frozen `{ name, args }` annotation instances.
 */
export declare function defineAnnotation<Args extends any[]>(name: string): TAnnotationCtor<Args>;

/**
 * Attaches annotations to a class or instance — to one member when
 * `memberName` is given, or to the target itself (memberless) when omitted.
 * Class annotations are stored on the constructor and inherited by subclass
 * instances. A lone annotation is normalized to a one-element array.
 */
export declare function annotate(
    annotations: TAnnotation | readonly TAnnotation[],
    classOrInstance: object,
    memberName?: string,
): void;

/**
 * Returns the target's own (memberless) annotations.
 * Reads merge instance → class → base classes up the prototype chain,
 * nearest-first, deduplicated by name+args.
 */
export declare function getAnnotations(classOrInstance: object): readonly TAnnotation[];
/**
 * Returns the annotations of one member of a class or instance.
 * Reads merge instance → class → base classes up the prototype chain,
 * nearest-first, deduplicated by name+args.
 */
export declare function getAnnotations(classOrInstance: object, memberName: string): readonly TAnnotation[];

/**
 * Builds a predicate truthy only when every listed annotation is present on
 * the member identified by the meta (respecting the inheritance merge).
 */
export declare function withAnnotations(
    list: readonly TAnnotationOrCtor[],
): (meta: TAnnotationPredicateMeta) => boolean;

/**
 * Checks whether a class or instance carries the given annotation (by
 * instance or constructor), respecting the inheritance merge.
 */
export declare function hasAnnotation(
    classOrInstance: object,
    annotationOrCtor: TAnnotationOrCtor,
): boolean;
