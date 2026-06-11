export class SourceExpression {
  readonly kind = 'SourceExpression' as const
  constructor(public readonly name: string) {}
}
