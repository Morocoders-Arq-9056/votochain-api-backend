import { DefaultNamingStrategy, type NamingStrategyInterface } from 'typeorm';

/**
 * Converts a camelCase string to snake_case.
 * @param value The camelCase string to convert.
 * @returns The converted snake_case string.
 */
function toSnake(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/**
 * Pluralizes a given string based on simple English rules.
 * @param value The string to pluralize.
 * @returns The pluralized form of the string.
 */
function pluralize(value: string): string {
  if (value.endsWith('s')) return value;
  if (value.endsWith('y')) return value.slice(0, -1) + 'ies';
  return `${value}s`;
}

/**
 * Custom naming strategy for TypeORM that converts table and column names to snake_case.
 * This strategy also pluralizes table names based on simple English rules.
 * 
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-12
 */
export class SnakeNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  override tableName(targetName: string, userSpecifiedName: string | undefined): string {
    if (userSpecifiedName) return userSpecifiedName;
    return toSnake(pluralize(targetName));
  }

  override columnName(
    propertyName: string,
    customName: string,
    embeddedPrefixes: string[],
  ): string {
    if (customName) return customName;
    return toSnake([...embeddedPrefixes, propertyName].join('_'));
  }

  override joinColumnName(relationName: string, referencedColumnName: string): string {
    return toSnake(`${relationName}_${referencedColumnName}`);
  }
}