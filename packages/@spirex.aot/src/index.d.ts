export type TAnnotation = {
    readonly name: string;
    readonly args: readonly unknown[];
};
export type TAnnotationCtor<Args extends any[]> = (...args: Args) => TAnnotation;

export declare function defineAnnotation<Args extends any[]>(name: string): TAnnotationCtor<Args>;

export type TNamePattern<T = string> = RegExp | T;
export type TAnnorationOrCtor = TAnnotationCtor<any> | TAnnotation

export type TMemberSelector<T = string> = {
    readonly className?: readonly TNamePattern[] | TNamePattern | undefined;
    readonly memberName?: readonly TNamePattern<T>[] | TNamePattern<T> | undefined;
    readonly annotations?: readonly TAnnorationOrCtor[] | TAnnorationOrCtor | undefined;
};

export type TAccessorAspect = { readonly $aspect: 'a' };
export type TMethodAspect = { readonly $aspect: 'm' };
export type TAnyAspect = TAccessorAspect | TMethodAspect;

export type TMethodAspectTarget = {
    thisRef: unknown;
    methodRef: Function;
    params: unknown[];
}

export type TAccessorAspectTarget = {
    thisRef: unknown;
    name: string;
    descriptor: PropertyDescriptor;
}

export type TMethodProceedFunction = () => unknown;
export type TAccessorGetFunction = () => unknown;
export type TAccessorSetFunction = (value: unknown) => void;

export type TMethodAspectDelegate = (meta: TMethodAspectTarget, returnValue: unknown) => void;
export type TMethodAspectAroundDelegate = (meta: TMethodAspectTarget, proceed: TMethodProceedFunction) => void;
export type TMethodAspectCatch = (meta: TMethodAspectTarget, error: unknown) => void;

export type TAccessorAspectDelegate = (meta: TAccessorAspectTarget, value: unknown) => void;
export type TMethodAspectAroundGetterDelegate = (meta: TMethodAspectTarget, get: TAccessorGetFunction) => void;
export type TMethodAspectAroundSetterDelegate = (meta: TMethodAspectTarget, set: TAccessorSetFunction) => void;
export type TAccessorAspectCatch = (meta: TAccessorAspectTarget, error: unknown) => void;

export type TMethodAspectDefinition = {
    displayName?: string;

    beforeCall?: TMethodAspectDelegate;
    aroundCall?: TMethodAspectAroundDelegate;
    afterCall?: TMethodAspectDelegate;
    onThrow?: TMethodAspectCatch;
}

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

export interface IAspect {
    method(selector: TMemberSelector, definition: TMethodAspectDefinition): TMethodAspect;
    accessor(selector: TMemberSelector, definition: TAccessorAspectDefinition): TAccessorAspect;

    getAnnotations(target: TMethodAspectTarget | TAccessorAspectTarget): readonly TAnnotation[];
    getAnnotations<T extends object>(target: T, selector: keyof T): readonly TAnnotation[];

    annotate<T extends object>(instance: T, selector: keyof T, annotations: readonly TAnnotation[]): void;
    apply<T extends object>(target: T, aspects: readonly TAnyAspect[]): T;
}

export declare const Aspect: IAspect;
