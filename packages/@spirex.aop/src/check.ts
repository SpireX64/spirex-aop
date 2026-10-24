// istanbul ignore file

import { Aspect, defineAnnotation } from "./index";
import { annotate } from "./annotations";

export const WatchLog = defineAnnotation("WatchLog");
export const Deprecated = defineAnnotation<[since: string]>("Deprecated");

export const LogMethodAspect = Aspect.method(
    { memberName: /trigger/i },
    {
        afterCall: () => {},
        onThrow: () => {},
    },
);

export class Sample {
    public constructor() {
        annotate([WatchLog()], this, "trigger");
        annotate([Deprecated("1.3.5")], this, "percent");
    }

    public trigger(): void {}

    public get percent(): number {
        return 2;
    }

    public set percent(value: number) {}
}

const sampleInst = Aspect.apply(new Sample(), [LogMethodAspect]);
