/** An annotation instance: frozen `{ name, args }` produced by an annotation constructor. */
export type TAnnotation = {
    readonly name: string;
    readonly args: readonly unknown[];
};

/** Constructor producing frozen {@link TAnnotation} instances. */
export type TAnnotationCtor<Args extends any[]> = (...args: Args) => TAnnotation;

/**
 * Defines an annotation type.
 * @param name Annotation name.
 * @returns A constructor producing frozen `{ name, args }` annotation instances.
 */
export declare function defineAnnotation<Args extends any[]>(name: string): TAnnotationCtor<Args>;

/** Name matcher: an exact string or a regular expression. */
export type TNamePattern<T = string> = RegExp | T;

/** Annotation selector entry: an annotation instance or its constructor. */
export type TAnnotationOrCtor = TAnnotationCtor<any> | TAnnotation

/**
 * Selects the members an aspect applies to. An absent `memberName` matches
 * ALL members of the instance, including plain data properties.
 */
export type TMemberSelector<T = string> = {
    /** Matched against `instance.constructor.name`. */
    readonly className?: readonly TNamePattern[] | TNamePattern | undefined;
    /** Member name pattern(s); absent = all members. */
    readonly memberName?: readonly TNamePattern<T>[] | TNamePattern<T> | undefined;
    /** Matches only members carrying the given annotation (by instance or ctor). */
    readonly annotations?: readonly TAnnotationOrCtor[] | TAnnotationOrCtor | undefined;
};

/** Accessor aspect (tagged `$aspect: 'a'`). */
export type TAccessorAspect = { readonly $aspect: 'a' };
/** Method aspect (tagged `$aspect: 'm'`). */
export type TMethodAspect = { readonly $aspect: 'm' };
/** Any aspect. */
export type TAnyAspect = TAccessorAspect | TMethodAspect;

/** Metadata passed to method aspect hooks. */
export type TMethodAspectTarget = {
    /** The wrapped instance the call was made on. */
    thisRef: unknown;
    /** The original method. */
    methodRef: Function;
    /** Call arguments. */
    params: unknown[];
}

/** Metadata passed to accessor aspect hooks. */
export type TAccessorAspectTarget = {
    /** The wrapped instance the member was accessed on. */
    thisRef: unknown;
    /** Member name. */
    name: string;
    /** The member's property descriptor. */
    descriptor: PropertyDescriptor;
}

/**
 * Continuation passed to `aroundCall`: invokes the rest of the chain
 * (pre-bound to `thisRef` and `params`) and returns its result.
 */
export type TMethodProceedFunction = () => unknown;
/** Continuation passed to `aroundGetter`: performs the original read. */
export type TAccessorGetFunction = () => unknown;
/** Continuation passed to `aroundSetter`: stores the given value. */
export type TAccessorSetFunction = (value: unknown) => void;

/** `beforeCall`/`afterCall` hook; `afterCall` receives the final return value. */
export type TMethodAspectDelegate = (meta: TMethodAspectTarget, returnValue: unknown) => void;
/** `aroundCall` hook: its return value is the final call result (`return proceed()` keeps the original). */
export type TMethodAspectAroundDelegate = (meta: TMethodAspectTarget, proceed: TMethodProceedFunction) => unknown;
/**
 * `onThrow` hook (hybrid model): all hooks run in reverse aspect order; the
 * error propagates by default; returning a value marks it handled and
 * substitutes the call result (for async methods, the resolved value).
 */
export type TMethodAspectCatch = (meta: TMethodAspectTarget, error: unknown) => void;

/** `beforeGetter`/`afterGetter`/`beforeSetter`/`afterSetter` hook. */
export type TAccessorAspectDelegate = (meta: TAccessorAspectTarget, value: unknown) => void;
/** `aroundGetter` hook: its return value is the final getter result (`return get()` keeps the original). */
export type TMethodAspectAroundGetterDelegate = (meta: TAccessorAspectTarget, get: TAccessorGetFunction) => unknown;
/** `aroundSetter` hook: overwrites the stored value by calling `set(newValue)`; not calling `set` skips the write. */
export type TMethodAspectAroundSetterDelegate = (meta: TAccessorAspectTarget, set: TAccessorSetFunction) => void;
/**
 * Accessor error hook (`onGetterThrows`/`onSetterThrows`), same hybrid model
 * as {@link TMethodAspectCatch}: a returned value substitutes the getter
 * result or accepts the setter write.
 */
export type TAccessorAspectCatch = (meta: TAccessorAspectTarget, error: unknown) => void;

/** Method aspect hooks. `before*`/`around*` run in apply-list order, `after*` in reverse. */
export type TMethodAspectDefinition = {
    displayName?: string;

    beforeCall?: TMethodAspectDelegate;
    aroundCall?: TMethodAspectAroundDelegate;
    afterCall?: TMethodAspectDelegate;
    onThrow?: TMethodAspectCatch;
}

/** Accessor aspect hooks. `before*`/`around*` run in apply-list order, `after*` in reverse. */
export type TAccessorAspectDefinition = {
    displayName?: string;

    beforeGetter?: TAccessorAspectDelegate;
    aroundGetter?: TMethodAspectAroundGetterDelegate;
    afterGetter?: TAccessorAspectDelegate;
    onGetterThrows?: TAccessorAspectCatch;

    beforeSetter?: TAccessorAspectDelegate;
    aroundSetter?: TMethodAspectAroundSetterDelegate;
    afterSetter?: TAccessorAspectDelegate;
    onSetterThrows?: TAccessorAspectCatch;
}

/** The aspect API surface. */
export interface IAspect {
    /** Creates a method aspect. */
    method(selector: TMemberSelector, definition: TMethodAspectDefinition): TMethodAspect;
    /** Creates an accessor aspect. */
    accessor(selector: TMemberSelector, definition: TAccessorAspectDefinition): TAccessorAspect;

    /** Returns the annotations of the member identified by a hook meta. */
    getAnnotations(target: TMethodAspectTarget | TAccessorAspectTarget): readonly TAnnotation[];
    /** Returns the annotations of one member of an instance. */
    getAnnotations<T extends object>(target: T, selector: keyof T): readonly TAnnotation[];

    /** Attaches annotations to one member of an instance. */
    annotate<T extends object>(instance: T, selector: keyof T, annotations: readonly TAnnotation[]): void;
    /**
     * Applies aspects to an instance: returns the Aspect Proxy, or the
     * original object when no aspect matches. One proxy per object —
     * re-applying re-checks selectors and updates the existing proxy.
     */
    apply<T extends object>(instance: T, aspects: readonly TAnyAspect[]): T;

    /** Checks whether an instance is an Aspect Proxy. */
    isWrapped(instance: unknown): boolean;
    /** Returns the aspects currently applied to an instance, in apply-list order. */
    getAspects(instance: unknown): readonly TAnyAspect[];
}

/** The aspect API. */
export declare const Aspect: IAspect;
