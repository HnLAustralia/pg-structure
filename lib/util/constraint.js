/**
 * @author Özüm Eldoğan
 */
/*jslint node: true */

"use strict";

var joi             = require('joi');
var lodash          = require('lodash');
var util            = require('util');
var helper          = require('./helper.js');


/**
 * Returns object to get/set internal properties of an object.
 * @function internal
 * @private
 * @returns {object}
 */
var internal        = helper.internal;

/**
 * Allowed actions onDelete and onUpdate
 * @private
 * @type {string[]}
 */
var allowedActions = ['NO ACTION', 'CASCADE', 'SET NULL', 'RESTRICT'];

/**
 * Allowed column attributes and validations.
 * @type {{name: *, referencesSchemaName: *, referencesTableName: *, onUpdate: *, onDelete: *, table: *}}
 */
var constraintAttributes = {
    name                                : joi.string().required(),
    referencesSchema                    : joi.object().required(),
    referencesTable                     : joi.object().required(),
    onUpdate                            : joi.string().valid(allowedActions),
    onDelete                            : joi.string().valid(allowedActions),
    table                               : joi.object().required(),
    through                             : joi.object(),
    throughForeignKeyConstraint         : joi.object(),
    throughForeignKeyConstraintToSelf   : joi.object()
};

/**
 * @class
 * @param {Object} args - Constraint arguments
 * @param {string} args.name - Name of the constraint
 * @param {Schema} args.referencesSchema - {@link Schema} containing table which this constraint references to.
 * @param {Table} args.referencesTable - {@link Table} which this constraint references to.
 * @param {string} [args.onUpdate] - Action taken on update. One of: 'NO ACTION', 'CASCADE', 'SET NULL', 'RESTRICT'
 * @param {string} [args.onUpdate] - Action taken on delete. One of: 'NO ACTION', 'CASCADE', 'SET NULL', 'RESTRICT'
 * @param {Table} args.table - {@link Table} object which contains this constraint.
 * @param {Table} args.through - {@link Table} object which this constraint references through.
 * @param {Table} args.throughForeignKeyConstraint - {@link Constraint} object in through table referencing to other table.
 * @param {Table} args.throughForeignKeyConstraintToSelf - {@link Constraint} object in through table referencing to this table.
 * @param {Object} [options] - Options
 * @param {boolean} [options.allowUnknown = true] - If true, unknown parameters passed to constructor does not throw error while creating object.
 */
var Constraint = function Constraint(args, options) {
    var attr, validation;
    if (!args) { throw new Error('constraint arguments are required.'); }
    options = lodash.defaults(options || {}, { abortEarly: false, allowUnknown: false });
    validation = joi.validate(args, joi.object().keys(constraintAttributes), options);
    if (validation.error) {
        throw new Error('Error in function arguments while trying to create "' + args.name + '" constraint. ' + validation.error + '\n' + util.inspect(args, { depth: null }));
    }

    attr                    = args;
    if (attr.through) {
        //attr.foreignKeys        = attr.through.foreignKeyConstraint(attr.name).internalObjectForeignKeys();
        //attr.foreignKeysByName  = attr.through.foreignKeyConstraint(attr.name).internalObjectForeignKeysByName();
        attr.foreignKeys        = attr.throughForeignKeyConstraintToSelf.internalObjectForeignKeys();
        attr.foreignKeysByName  = attr.throughForeignKeyConstraintToSelf.internalObjectForeignKeysByName();
    } else {
        attr.foreignKeys        = [];
        attr.foreignKeysByName  = {};
    }
    internal(this).attributes = attr;
};


/**
 * This method is for internal use. Sets/gets internal object of foreignKeys.
 * @method
 * @private
 * @param {object} [value] - New value
 * @returns {object}
 */
Constraint.prototype.internalObjectForeignKeys = helper.accessor('foreignKeys');

/**
 * This method is for internal use. Sets/gets internal object of foreignKeysByName.
 * @method
 * @private
 * @param {object} [value] - New value
 * @returns {object}
 */
Constraint.prototype.internalObjectForeignKeysByName = helper.accessor('foreignKeysByName');

/**
 * @method
 * @param {string} [value] - New value
 * @returns {string}
 */
Constraint.prototype.name = helper.accessor('name');

/**
 * Gets full name of the object in database . notation.
 */
Constraint.prototype.fullName = helper.objectFullName();

/**
 * @method
 * @param {string} [value] - New value
 * @returns {string}
 */
Constraint.prototype.onUpdate = helper.accessor('onUpdate');

/**
 * @method
 * @param {string} [value] - New value
 * @returns {string}
 */
Constraint.prototype.onDelete = helper.accessor('onDelete');

/**
 * @method
 * @param {string} [value] - New value
 * @returns {string}
 */
Constraint.prototype.table = helper.accessor('table');

/**
 * @method
 * @param {string} [value] - New value
 * @returns {string}
 */
Constraint.prototype.parent = Constraint.prototype.table;

/**
 * Returns {@link Schema} object this constraint refers to.
 * @method
 * @param {Schema} [value] - New value
 * @returns {Schema}
 */
Constraint.prototype.referencesSchema = helper.accessor('referencesSchema');

/**
 * Returns {@link Table} object this constraint refers to.
 * @method
 * @param {Table} [value] - New value
 * @returns {Table}
 */
Constraint.prototype.referencesTable = helper.accessor('referencesTable');

/**
 * Returns {@link Table} object this constraint refers through.
 * @method
 * @param {Table} [value] - New value
 * @returns {Table}
 */
Constraint.prototype.through = helper.accessor('through');

/**
 * Returns {@link Constraint} (foreign key constraint) this constraint referring to other table through join table.
 * With this method it is possible to learn how this table is connected to other table.
 * @method
 * @param {Table} [value] - New value
 * @returns {Table}
 * @example
 * // Assume there are three tables for many to many relation:  cart ----< line_item >---- product
 * db.get('public.cart').hasManyThrough('cart_has_products').foreignKey(0).name(); // equals 'cart_id'
 * db.get('public.cart').hasManyThrough('cart_has_products').throughForeignKeyConstraint().foreignKey(0).name() // equals 'product_id'
 */
Constraint.prototype.throughForeignKeyConstraint = helper.accessor('throughForeignKeyConstraint');

/**
 * Returns {@link Constraint} (foreign key constraint) this constraint referring to itself through join table.
 * With this method it is possible to learn how this table is connected to other table.
 * @method
 * @param {Table} [value] - New value
 * @returns {Table}
 * @example
 */
Constraint.prototype.throughForeignKeyConstraintToSelf = helper.accessor('throughForeignKeyConstraintToSelf');

/**
 * Adds foreign key to the constraint and returns it.
 * @method
 * @private
 * @param {Column} column - Column to add as foreign key
 * @returns {Column}
 */
Constraint.prototype.addForeignKey = helper.addObject('foreignKeysByName', 'foreignKeys', null, 'table');

/**
 * Returns foreign key as a {@link Column} object with given name or order number.
 * @param {string | integer} nameOrPos - Name or order number of the foreign key
 * @method
 * @returns {Column}
 * @throws Will throw error if foreign key does not exists.
 */
Constraint.prototype.foreignKey = helper.getObject('foreignKeysByName', 'foreignKeys');

/**
 * Returns true if foreign key object with given name or order number exists.
 * @param {string | integer} nameOrPos - Name or order number of the foreign key
 * @method
 * @returns {boolean}
 */
Constraint.prototype.foreignKeyExist = helper.objectExist('foreignKeysByName', 'foreignKeys');

/**
 * @callback columnCallback
 * @param {Column} column - Column object
 */

/**
 * Retrieves all foreign keys in the constraint. If callback is provided, it is executed for each foreign key column.
 * Callback is passed {@link Column} object as parameter. If no callback is provided, returns a plain object. Object keys are column names,
 * values are {@link Column} objects.
 * @method
 * @param {columnCallback} [callback] - Callback to be executed for each column.
 * @returns {object.<string, Column> | undefined}
 */
Constraint.prototype.foreignKeysByName = helper.objectsByName('foreignKeysByName');

/**
 * Retrieves all foreign keys in the constraint. If callback is provided, it is executed for each foreign key column.
 * Callback is passed {@link Column} object as parameter. If no callback is provided, returns an array which
 * contains foreign key {@link Column} objects.
 * @method
 * @param {columnCallback} [callback] - Callback to be executed for each column.
 * @returns {object.<string, Column> | undefined}
 */
Constraint.prototype.foreignKeys = helper.objectsByOrder('foreignKeys');


module.exports = function (args, options) {
    return new Constraint(args, options);
};