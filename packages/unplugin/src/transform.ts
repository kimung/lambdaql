import * as ts from "typescript";
import MagicString from "magic-string";
import { collectQueryableScope, isQueryableShaped } from "./detect.js";
import { generateLambda } from "./generate.js";
import { QUERYABLE_METHODS, JOIN_METHODS } from "./constants.js";

export function transform(
  code: string,
  id: string,
): { code: string; map: ReturnType<MagicString["generateMap"]> } | null {
  if (!code.includes("@gamn9/data")) return null;

  const scriptKind = /\.[jt]sx$/.test(id) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(id, code, ts.ScriptTarget.ES2022, false, scriptKind);

  const { factoryNames, queryableVars } = collectQueryableScope(sf);
  if (factoryNames.size === 0) return null;

  const ms = new MagicString(code);
  let changed = false;

  function visit(node: ts.Node, localVars: ReadonlySet<string> = new Set()): void {
    // À chaque frontière de fonction, on enrichit la portée locale avec les paramètres
    // dont le type est annoté explicitement comme Queryable<...>
    if (ts.isFunctionLike(node)) {
      const fn = node as ts.FunctionLikeDeclaration;
      let extended: Set<string> | undefined;
      for (const p of fn.parameters) {
        if (ts.isIdentifier(p.name) && p.type && ts.isTypeReferenceNode(p.type)) {
          const typeName = p.type.typeName;
          if (ts.isIdentifier(typeName) && typeName.text === "Queryable") {
            if (!extended) extended = new Set(localVars);
            extended.add(p.name.text);
          }
        }
      }
      ts.forEachChild(node, (child) => visit(child, extended ?? localVars));
      return;
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      const receiver = node.expression.expression;

      if (isQueryableShaped(receiver, factoryNames, queryableVars, localVars)) {
        if (QUERYABLE_METHODS.has(method)) {
          const first = node.arguments[0];
          if (first && ts.isArrowFunction(first)) {
            ms.overwrite(first.getStart(sf), first.end, generateLambda(first, sf));
            changed = true;
          }
        } else if (JOIN_METHODS.has(method) && node.arguments.length >= 3) {
          const onArg = node.arguments[2];
          if (onArg && ts.isArrowFunction(onArg)) {
            ms.overwrite(onArg.getStart(sf), onArg.end, generateLambda(onArg, sf));
            changed = true;
          }
        }
      }
    }

    ts.forEachChild(node, (child) => visit(child, localVars));
  }

  visit(sf);

  if (!changed) return null;
  return { code: ms.toString(), map: ms.generateMap({ hires: true }) };
}
