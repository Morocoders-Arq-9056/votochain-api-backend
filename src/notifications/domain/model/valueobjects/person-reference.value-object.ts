/**
 * Local reference to a person owned by IAM. Notifications stores no person
 * rows by design (it receives only template + address + reason); this VO lets
 * erasure scrub the person-linked render values that traveled inside a
 * dispatch without importing another context's model.
 */
export class PersonReference {
  private constructor(public readonly value: string) {}

  static of(v: string): PersonReference {
    if (!v?.trim()) throw new Error('invalid person reference');
    return new PersonReference(v);
  }

  equals(o: PersonReference): boolean { return this.value === o.value; }
  toString(): string { return this.value; }
}
