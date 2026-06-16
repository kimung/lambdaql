import type { TokenKind } from "./kind.js";

export interface IToken {
  readonly kind: TokenKind;
  readonly value: unknown;
  readonly key: string;
}

export class Token implements IToken {
  constructor(
    public readonly kind: TokenKind,
    public readonly value: unknown,
    public readonly key: string,
    public readonly line?: number,
    public readonly col?: number,
  ) {}

  loc(): string {
    return this.line != null ? ` at ${this.line}:${this.col}` : "";
  }

  toString(): string {
    return `Token(${this.kind}, ${String(this.value)})`;
  }
}
