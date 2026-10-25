import { describe, expect, test } from "vitest";
import {
    annotate,
    defineAnnotation,
    getAnnotations,
    hasAnnotation,
} from "./annotations.js";

describe("defineAnnotation", () => {
    test("returns a constructor producing frozen { name, args } annotations", () => {
        // Arrange --------------
        var WatchLog = defineAnnotation("WatchLog");

        // Act --------------
        var annotation = WatchLog(1, "x");

        // Assert --------------
        expect(annotation).toEqual({ name: "WatchLog", args: [1, "x"] });
        expect(annotation).is.frozen;
    });
});

describe("annotate / getAnnotations", () => {
    test("stores annotations per member and returns them by instance + member name", () => {
        // Arrange --------------
        var Tag = defineAnnotation("Tag");
        var instance = { foo() {}, bar() {} };

        // Act --------------
        annotate([Tag("a"), Tag("b")], instance, "foo");

        // Assert --------------
        expect(getAnnotations(instance, "foo")).toEqual([Tag("a"), Tag("b")]);
    });

    test("normalizes a single annotation to a one-element array", () => {
        // Arrange --------------
        var Deprecated = defineAnnotation("Deprecated");
        var instance = { doAction() {} };

        // Act --------------
        annotate(Deprecated("1.2.3"), instance, "doAction");

        // Assert --------------
        expect(getAnnotations(instance, "doAction")).toEqual([
            Deprecated("1.2.3"),
        ]);
    });

    test("annotations of one member do not leak onto another member", () => {
        // Arrange --------------
        var Tag = defineAnnotation("Tag");
        var instance = { foo() {}, bar() {} };

        // Act --------------
        annotate([Tag("only-foo")], instance, "foo");

        // Assert --------------
        expect(getAnnotations(instance, "bar")).toEqual([]);
        expect(getAnnotations(instance, "foo")).toEqual([Tag("only-foo")]);
    });

    test("annotating the same member twice concatenates the annotations", () => {
        // Arrange --------------
        var Tag = defineAnnotation("Tag");
        var instance = { foo() {} };

        // Act --------------
        annotate([Tag("a")], instance, "foo");
        annotate([Tag("b")], instance, "foo");

        // Assert --------------
        expect(getAnnotations(instance, "foo")).toEqual([Tag("a"), Tag("b")]);
    });

    test("returns an empty list for a null target", () => {
        // Arrange --------------
        var target = null;

        // Act --------------
        var annotations = getAnnotations(target);

        // Assert --------------
        expect(annotations).toEqual([]);
    });
});

describe("annotate input validation", () => {
    test("throws TypeError on a null target", () => {
        // Arrange --------------
        var Tag = defineAnnotation("Tag");

        // Act --------------
        var act = () => annotate([Tag()], null);

        // Assert --------------
        expect(act).toThrow(TypeError);
    });

    test("throws TypeError on an undefined target", () => {
        // Arrange --------------
        var Tag = defineAnnotation("Tag");

        // Act --------------
        var act = () => annotate([Tag()], undefined);

        // Assert --------------
        expect(act).toThrow(TypeError);
    });

    test("throws TypeError on null annotations", () => {
        // Arrange --------------
        var instance = {};

        // Act --------------
        var act = () => annotate(null, instance);

        // Assert --------------
        expect(act).toThrow(TypeError);
    });

    test("throws TypeError on undefined annotations", () => {
        // Arrange --------------
        var instance = {};

        // Act --------------
        var act = () => annotate(undefined, instance);

        // Assert --------------
        expect(act).toThrow(TypeError);
    });

    test("throws TypeError on an unknown member name of an instance target", () => {
        // Arrange --------------
        var Tag = defineAnnotation("Tag");
        var instance = { foo() {} };

        // Act --------------
        var act = () => annotate([Tag()], instance, "missing");

        // Assert --------------
        expect(act).toThrow(TypeError);
    });

    test("throws TypeError on an unknown member name of a constructor target", () => {
        // Arrange --------------
        var Tag = defineAnnotation("Tag");
        class Service {
            foo() {}
        }

        // Act --------------
        var act = () => annotate([Tag()], Service, "missing");

        // Assert --------------
        expect(act).toThrow(TypeError);
    });

    test("an empty annotations array is a no-op", () => {
        // Arrange --------------
        var instance = {};

        // Act --------------
        annotate([], instance);

        // Assert --------------
        expect(getAnnotations(instance)).toEqual([]);
    });

    test("throws TypeError when the member is missing on a target function without a prototype", () => {
        // Arrange --------------
        var Tag = defineAnnotation("Tag");
        var target = () => {};

        // Act --------------
        var act = () => annotate([Tag()], target, "missing");

        // Assert --------------
        expect(act).toThrow(TypeError);
    });
});

describe("annotate / getAnnotations — class, memberless, inheritance", () => {
    test("annotates a class member by passing the constructor", () => {
        // Arrange --------------
        var Route = defineAnnotation("Route");
        class AuthController {
            login() {}
        }

        // Act --------------
        annotate([Route("api/auth")], AuthController, "login");

        // Assert --------------
        expect(getAnnotations(new AuthController(), "login")).toEqual([
            Route("api/auth"),
        ]);
    });

    test("annotates the class itself when memberName is omitted", () => {
        // Arrange --------------
        var Tag = defineAnnotation("Tag");
        class Service {}

        // Act --------------
        annotate([Tag("svc")], Service);

        // Assert --------------
        expect(getAnnotations(Service)).toEqual([Tag("svc")]);
    });

    test("annotates the instance itself when memberName is omitted", () => {
        // Arrange --------------
        var Tag = defineAnnotation("Tag");
        var instance = {};

        // Act --------------
        annotate([Tag("own")], instance);

        // Assert --------------
        expect(getAnnotations(instance)).toEqual([Tag("own")]);
    });

    test("merges annotations up the prototype chain nearest-first with dedup by name+args", () => {
        // Arrange --------------
        var Tag = defineAnnotation("Tag");
        class Base {
            work() {}
        }
        class Derived extends Base {
            work() {}
        }
        annotate([Tag("base"), Tag("shared")], Base, "work");
        annotate([Tag("derived"), Tag("shared")], Derived, "work");
        var instance = new Derived();
        annotate([Tag("instance")], instance, "work");

        // Act --------------
        var annotations = getAnnotations(instance, "work");

        // Assert --------------
        expect(annotations).toEqual([
            Tag("instance"),
            Tag("derived"),
            Tag("shared"),
            Tag("base"),
        ]);
    });

    test("dedups the identical annotation instance appearing twice in the chain", () => {
        // Arrange --------------
        var Tag = defineAnnotation("Tag");
        class Base {}
        class Derived extends Base {}
        var tag = Tag("shared");
        annotate([tag], Base);
        var instance = new Derived();
        annotate([tag], instance);

        // Act --------------
        var annotations = getAnnotations(instance);

        // Assert --------------
        expect(annotations).toEqual([tag]);
    });
});

describe("hasAnnotation", () => {
    test("matches a memberless annotation by instance", () => {
        // Arrange --------------
        var Tag = defineAnnotation("Tag");
        var instance = {};
        annotate([Tag("x")], instance);

        // Act --------------
        var result = hasAnnotation(instance, Tag("x"));

        // Assert --------------
        expect(result).is.true;
    });

    test("matches a memberless annotation by constructor", () => {
        // Arrange --------------
        var Tag = defineAnnotation("Tag");
        var instance = {};
        annotate([Tag("x")], instance);

        // Act --------------
        var result = hasAnnotation(instance, Tag);

        // Assert --------------
        expect(result).is.true;
    });

    test("respects the inheritance merge", () => {
        // Arrange --------------
        var Tag = defineAnnotation("Tag");
        class Base {}
        class Derived extends Base {}
        annotate([Tag("base")], Base);

        // Act --------------
        var result = hasAnnotation(new Derived(), Tag);

        // Assert --------------
        expect(result).is.true;
    });

    test("returns false when the annotation is absent", () => {
        // Arrange --------------
        var Tag = defineAnnotation("Tag");
        var Other = defineAnnotation("Other");
        var instance = {};
        annotate([Tag("x")], instance);

        // Act --------------
        var result = hasAnnotation(instance, Other);

        // Assert --------------
        expect(result).is.false;
    });

    test("returns false for a null target", () => {
        // Arrange --------------
        var Tag = defineAnnotation("Tag");

        // Act --------------
        var result = hasAnnotation(null, Tag);

        // Assert --------------
        expect(result).is.false;
    });
});
