export class RawExpression {
  readonly kind = 'RawExpression' as const
  constructor(
    public readonly sql:    string,
    public readonly params: readonly unknown[],
  ) {}
}
