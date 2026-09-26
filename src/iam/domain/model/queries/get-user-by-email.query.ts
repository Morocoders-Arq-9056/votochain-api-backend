export class GetUserByEmailQuery {
  constructor(public readonly email: string) {
    if (!email?.trim()) throw new Error('email required');
  }
}
