import DbObject, { DbObjectConstructorArgs } from "./db-object";
/** @ignore */
export interface ConstraintConstructorArgs extends DbObjectConstructorArgs {
    isDeferrable: boolean;
    isDeferred: boolean;
}
/**
 * Abstract class which represent a database constraint. Provides attributes and methods related to constraint.
 */
export default abstract class Constraint extends DbObject {
    /** @ignore */
    constructor(args: ConstraintConstructorArgs);
    /** Is the {@link Constraint} deferrable? */
    readonly isDeferrable: boolean;
    /** Is the {@link Constraint} deferred by default? */
    readonly isDeferred: boolean;
}
//# sourceMappingURL=constraint.d.ts.map