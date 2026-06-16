import * as ts from "typescript";
import { KNOWN_FACTORIES, QUERYABLE_METHODS, JOIN_METHODS, DATABASE_METHODS } from "./constants.js";

export interface QueryableScope {
  factoryNames: Set<string>;
  queryableVars: Set<string>;
}

export function collectQueryableScope(sf: ts.SourceFile): QueryableScope {
  const factoryNames = new Set<string>();
  const queryableVars = new Set<string>();

  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    const mod = (stmt.moduleSpecifier as ts.StringLiteral).text;
    if (mod !== "@gamn9/data") continue;
    const bindings = stmt.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const el of bindings.elements) {
      const originalName = el.propertyName?.text ?? el.name.text;
      if (KNOWN_FACTORIES.has(originalName)) factoryNames.add(el.name.text);
    }
  }

  if (factoryNames.size === 0) return { factoryNames, queryableVars };

  // Track top-level variable declarations assigned from factory calls or Queryable chains
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      if (isQueryableShaped(decl.initializer, factoryNames, queryableVars)) {
        queryableVars.add(decl.name.text);
      }
    }
  }

  return { factoryNames, queryableVars };
}

export function isQueryableShaped(
  node: ts.Expression,
  factoryNames: Set<string>,
  queryableVars: Set<string>,
  localVars?: ReadonlySet<string>,
): boolean {
  if (ts.isIdentifier(node)) {
    return queryableVars.has(node.text) || (localVars?.has(node.text) ?? false);
  }
  if (ts.isParenthesizedExpression(node))
    return isQueryableShaped(node.expression, factoryNames, queryableVars, localVars);
  if (ts.isAsExpression(node)) return isQueryableShaped(node.expression, factoryNames, queryableVars, localVars);
  if (ts.isNonNullExpression(node)) return isQueryableShaped(node.expression, factoryNames, queryableVars, localVars);

  if (ts.isCallExpression(node)) {
    const callee = node.expression;
    // from<User>('user') / fromRaw('...') / createDatabase(exec) — identifiant direct
    if (ts.isIdentifier(callee) && factoryNames.has(callee.text)) return true;

    if (ts.isPropertyAccessExpression(callee)) {
      const method = callee.name.text;
      // Chaîne Queryable : q.filter(...).select(...) → résultat Queryable
      if (QUERYABLE_METHODS.has(method) || JOIN_METHODS.has(method)) {
        return isQueryableShaped(callee.expression, factoryNames, queryableVars, localVars);
      }
      // Méthode Database : db.from(...) → résultat Queryable
      if (DATABASE_METHODS.has(method)) {
        return isQueryableShaped(callee.expression, factoryNames, queryableVars, localVars);
      }
    }
  }

  return false;
}
