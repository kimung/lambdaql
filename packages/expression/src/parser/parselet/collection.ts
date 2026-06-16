import type { PrefixParselet, InfixParselet } from "./index.js";

export class ParseletCollection {
  readonly prefix = new Map<string, PrefixParselet>();
  readonly infix = new Map<string, InfixParselet>();
  addPrefix(p: PrefixParselet): void {
    this.prefix.set(p.key, p);
  }
  addInfix(p: InfixParselet): void {
    this.infix.set(p.key, p);
  }
}
