import { TypedRule, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import {
    isBinaryExpression,
    isPrefixUnaryExpression,
    unionTypeParts,
    isFalsyType,
    isTypeOfExpression,
    isTextualLiteral,
    isIdentifier,
    isEmptyObjectType,
    isIntersectionType,
    isStrictCompilerOptionEnabled,
    isPropertyAccessExpression,
    isElementAccessExpression,
    isParenthesizedExpression,
} from 'tsutils';
import { lateBoundPropertyNames, getPropertyOfType, unwrapParens } from '../utils';

interface TypePredicate {
    nullable: boolean;
    check(type: ts.Type): boolean;
}

interface Equals {
    negated: boolean;
    strict: boolean;
}

const primitiveFlags = ts.TypeFlags.BigIntLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.NumberLike | ts.TypeFlags.StringLike |
    ts.TypeFlags.ESSymbolLike | ts.TypeFlags.Undefined | ts.TypeFlags.Void;

const predicates: Record<string, TypePredicate> = {
    object: {
        nullable: true,
        check(type) {
            return (type.flags & primitiveFlags) === 0 && !isTypeofFunction(type);
        },
    },
    number: {
        nullable: false,
        check: checkFlags(ts.TypeFlags.NumberLike),
    },
    bigint: {
        nullable: false,
        check: checkFlags(ts.TypeFlags.BigIntLike),
    },
    string: {
        nullable: false,
        check: checkFlags(ts.TypeFlags.StringLike),
    },
    boolean: {
        nullable: false,
        check: checkFlags(ts.TypeFlags.BooleanLike),
    },
    symbol: {
        nullable: false,
        check: checkFlags(ts.TypeFlags.ESSymbolLike),
    },
    function: {
        nullable: false,
        check: isTypeofFunction,
    },
    null: {
        nullable: true,
        check: checkFlags(ts.TypeFlags.Null),
    },
    undefined: {
        nullable: true,
        check: checkFlags(ts.TypeFlags.Undefined | ts.TypeFlags.Void),
    },
    nullOrUndefined: {
        nullable: true,
        check: checkFlags(ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void),
    },
};

@excludeDeclarationFiles
export class Rule extends TypedRule {
    private strictNullChecks = isStrictCompilerOptionEnabled(this.program.getCompilerOptions(), 'strictNullChecks');

    public apply() {
        for (const node of this.context.getFlatAst()) {
            switch (node.kind) {
                case ts.SyntaxKind.IfStatement:
                    this.checkCondition((<ts.IfStatement>node).expression);
                    break;
                case ts.SyntaxKind.ConditionalExpression:
                    this.checkCondition((<ts.ConditionalExpression>node).condition);
                    break;
                case ts.SyntaxKind.WhileStatement:
                case ts.SyntaxKind.DoStatement:
                    if ((<ts.WhileStatement | ts.DoStatement>node).expression.kind !== ts.SyntaxKind.TrueKeyword)
                        this.checkCondition((<ts.WhileStatement | ts.DoStatement>node).expression);
                    break;
                case ts.SyntaxKind.ForStatement: {
                    const {condition} = <ts.ForStatement>node;
                    if (condition !== undefined && condition.kind !== ts.SyntaxKind.TrueKeyword)
                        this.checkCondition(condition);
                    break;
                }
                case ts.SyntaxKind.SwitchStatement:
                    this.checkSwitch(<ts.SwitchStatement>node);
                    break;
                case ts.SyntaxKind.BinaryExpression:
                    if (isLogicalOperator((<ts.BinaryExpression>node).operatorToken.kind)) {
                        this.checkCondition((<ts.BinaryExpression>node).left);
                    } else if (isEqualityOperator((<ts.BinaryExpression>node).operatorToken.kind)) {
                        this.checkNode(<ts.BinaryExpression>node);
                    }
                    break;
                case ts.SyntaxKind.PrefixUnaryExpression:
                    if ((<ts.PrefixUnaryExpression>node).operator === ts.SyntaxKind.ExclamationToken)
                        this.checkCondition((<ts.PrefixUnaryExpression>node).operand);
            }
        }
    }

    private checkSwitch(node: ts.SwitchStatement) {
        for (const clause of node.caseBlock.clauses) {
            if (clause.kind === ts.SyntaxKind.DefaultClause)
                continue;
            this.maybeFail(clause, this.isConstantComparison(node.expression, clause.expression, ts.SyntaxKind.EqualsEqualsEqualsToken));
        }
    }

    private checkCondition(node: ts.Expression) {
        return this.maybeFail(node, this.isTruthyFalsy(node, true));
    }

    private checkNode(node: ts.Expression) {
        return this.maybeFail(node, this.isTruthyFalsy(node, false));
    }

    private maybeFail(node: ts.Node, result: boolean | undefined) {
        if (result !== undefined)
            return this.addFindingAtNode(node, result ? 'Expression is always truthy.' : 'Expression is always falsy.');
    }

    private isTruthyFalsy(node: ts.Expression, nested: boolean): boolean | undefined {
        if (isBinaryExpression(node)) {
            if (isEqualityOperator(node.operatorToken.kind)) // TODO check <, >, <=, >= with literal types
                return nested ? undefined : this.isConstantComparison(node.left, node.right, node.operatorToken.kind);
        } else if (isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
            return;
        } else if (isParenthesizedExpression(node)) {
            return this.isTruthyFalsy(node.expression, true);
        }
        return this.executePredicate(this.getTypeOfExpression(node), truthyFalsy);
    }

    private isConstantComparison(left: ts.Expression, right: ts.Expression, operator: ts.EqualityOperator) {
        left = unwrapParens(left);
        right = unwrapParens(right);
        const equals: Equals = {
            negated: operator === ts.SyntaxKind.ExclamationEqualsEqualsToken || operator === ts.SyntaxKind.ExclamationEqualsToken,
            strict: operator === ts.SyntaxKind.ExclamationEqualsEqualsToken || operator === ts.SyntaxKind.EqualsEqualsEqualsToken,
        };
        let result = this.checkEquals(left, right, equals);
        if (result === undefined)
            result = this.checkEquals(right, left, equals);
        return result;
    }

    private checkEquals(left: ts.Expression, right: ts.Expression, equals: Equals): boolean | undefined {
        let predicate: TypePredicate;
        if (isTypeOfExpression(left)) {
            left = unwrapParens(left.expression);
            if (right.kind === ts.SyntaxKind.NullKeyword || isUndefined(right))
                return equals.negated;
            let literal: string;
            if (isTextualLiteral(right)) {
                literal = right.text;
            } else {
                let type = this.getTypeOfExpression(right);
                type = this.checker.getBaseConstraintOfType(type) || type;
                if ((type.flags & ts.TypeFlags.StringLiteral) === 0)
                    return;
                literal = (<ts.StringLiteralType>type).value;
            }
            switch (literal) {
                default:
                    return equals.negated;
                case 'number':
                case 'string':
                case 'boolean':
                case 'symbol':
                case 'object':
                case 'function':
                case 'undefined':
                case 'bigint':
                    predicate = predicates[literal];
            }
        } else if (right.kind === ts.SyntaxKind.NullKeyword) {
            predicate = equals.strict ? predicates.null : predicates.nullOrUndefined;
        } else if (isUndefined(right)) {
            predicate = equals.strict ? predicates.undefined : predicates.nullOrUndefined;
        } else {
            return;
        }
        return this.nullAwarePredicate(this.getTypeOfExpression(left), predicate);
    }

    private nullAwarePredicate(type: ts.Type, predicate: TypePredicate): boolean | undefined {
        if (!this.strictNullChecks && predicate.nullable)
            return;
        const result = this.executePredicate(
            type,
            // empty object type can contain anything but `null | undefined`
            // TODO use assignability check to avoid false positives
            predicate.nullable ? predicate.check : (t) => isEmptyObjectType(t) ? undefined : predicate.check(t),
        );
        return result && !this.strictNullChecks
            ? undefined
            : result;
    }

    private executePredicate(type: ts.Type, predicate: (type: ts.Type) => boolean | undefined) {
        let result: boolean | undefined;
        for (let t of unionTypeParts(type)) {
            if (t.flags & (ts.TypeFlags.TypeVariable | ts.TypeFlags.Instantiable)) {
                const constraint = this.checker.getBaseConstraintOfType(t);
                if (constraint === undefined)
                    return;
                t = constraint;
            }
            if (t.flags & (ts.TypeFlags.Any | ts.TypeFlags.Never | ts.TypeFlags.Unknown))
                return;
            switch (isIntersectionType(t) ? this.matchIntersectionType(t, predicate) : predicate(t)) {
                case true:
                    if (result === false)
                        return;
                    result = true;
                    break;
                case false:
                    if (result === true)
                        return;
                    result = false;
                    break;
                default:
                    return;
            }
        }
        return result;
    }

    /**
     * If one of the types in the intersection matches the precicate, this function returns true.
     * Otherwise if any of the types results in undefined, this function returns undefined.
     * If every type results in false, it returns false.
     */
    private matchIntersectionType(type: ts.IntersectionType, predicate: (type: ts.Type) => boolean | undefined) {
        let result: boolean | undefined = false;
        for (const t of type.types) {
            switch (this.executePredicate(t, predicate)) {
                case true:
                    return true;
                case undefined:
                    result = undefined;
            }
        }
        return result;
    }

    private getTypeOfExpression(node: ts.Expression): ts.Type {
        const type = this.checker.getTypeAtLocation(node);
        if (!this.strictNullChecks)
            return type;
        if (unionTypeParts(type).some((t) => (t.flags & ts.TypeFlags.Undefined) !== 0))
            return type;
        if (!isPropertyAccessExpression(node) && !isElementAccessExpression(node))
            return type;
        const objectType = this.checker.getApparentType(this.checker.getTypeAtLocation(node.expression));
        if (objectType.getStringIndexType() === undefined && objectType.getNumberIndexType() === undefined)
            return type;
        if (isPropertyAccessExpression(node)) {
            if (objectType.getProperty(node.name.text) !== undefined)
                return type;
        } else {
            const names = lateBoundPropertyNames(node.argumentExpression, this.checker);
            if (names.known && names.properties.every(({symbolName}) => getPropertyOfType(objectType, symbolName) !== undefined))
                return type;
        }
        return this.checker.getNullableType(type, ts.TypeFlags.Undefined);
    }
}

function isUndefined(node: ts.Expression): node is ts.Identifier {
    return isIdentifier(node) && node.originalKeywordKind === ts.SyntaxKind.UndefinedKeyword;
}

function truthyFalsy(type: ts.Type) {
    if (type.flags & ts.TypeFlags.PossiblyFalsy) {
        if (isFalsyType(type))
            return false;
        return type.flags & ts.TypeFlags.Literal ? true : undefined;
    }
    // TODO use assignability check
    return isEmptyObjectType(type) ? undefined : true;
}

function isLogicalOperator(kind: ts.BinaryOperator) {
    return kind === ts.SyntaxKind.AmpersandAmpersandToken || kind === ts.SyntaxKind.BarBarToken;
}

function isEqualityOperator(kind: ts.BinaryOperator): kind is ts.EqualityOperator {
    switch (kind) {
        case ts.SyntaxKind.ExclamationEqualsEqualsToken:
        case ts.SyntaxKind.ExclamationEqualsToken:
        case ts.SyntaxKind.EqualsEqualsEqualsToken:
        case ts.SyntaxKind.EqualsEqualsToken:
            return true;
        default:
            return false;
    }
}

function checkFlags(flags: ts.TypeFlags) {
    return (type: ts.Type) => (type.flags & flags) !== 0;
}

function isTypeofFunction(type: ts.Type) {
    if (type.getCallSignatures().length !== 0 || type.getConstructSignatures().length !== 0)
            return true;
    // check if this could be the global `Function` type
    return type.symbol !== undefined && type.symbol.escapedName === 'Function' &&
        hasPropertyOfKind(type, 'apply', ts.SymbolFlags.Method) &&
        hasPropertyOfKind(type, 'arguments', ts.SymbolFlags.Property) &&
        hasPropertyOfKind(type, 'bind', ts.SymbolFlags.Method) &&
        hasPropertyOfKind(type, 'call', ts.SymbolFlags.Method) &&
        hasPropertyOfKind(type, 'caller', ts.SymbolFlags.Property) &&
        hasPropertyOfKind(type, 'length', ts.SymbolFlags.Property) &&
        hasPropertyOfKind(type, 'prototype', ts.SymbolFlags.Property);
}

function hasPropertyOfKind(type: ts.Type, name: string, flag: ts.SymbolFlags) {
    const property = type.getProperty(name);
    return property !== undefined && (property.flags & flag) !== 0;
}
