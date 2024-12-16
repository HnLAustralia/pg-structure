"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_object_1 = __importDefault(require("./db-object"));
/**
 * Abstract class which represent a database constraint. Provides attributes and methods related to constraint.
 */
class Constraint extends db_object_1.default {
    /** @ignore */
    constructor(args) {
        super(args);
        this.isDeferrable = args.isDeferrable;
        this.isDeferred = args.isDeferred;
    }
}
exports.default = Constraint;
//# sourceMappingURL=constraint.js.map