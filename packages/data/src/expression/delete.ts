import type { LambdaExpression } from '@gamn9/expression'
import type { SourceExpression } from './source.js'

export class DeleteExpression {
  readonly kind = 'DeleteExpression' as const
  constructor(
    public readonly source: SourceExpression,
    public readonly where:  LambdaExpression,
  ) {}
}
