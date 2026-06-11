import type { SelectExpression } from './select.js'

export class UnionExpression {
  readonly kind = 'UnionExpression' as const
  constructor(
    public readonly left:  SelectExpression | UnionExpression,
    public readonly right: SelectExpression | UnionExpression,
    public readonly all:   boolean,
  ) {}
}
