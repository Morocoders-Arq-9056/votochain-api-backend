import type { DataCategory } from "../valueobjects/data-category.value-object.js";

export class GetRetentionTermsByCategoryQuery {
  constructor(public readonly category: DataCategory) {
    if (!category) throw new Error('category required');
  }
}
