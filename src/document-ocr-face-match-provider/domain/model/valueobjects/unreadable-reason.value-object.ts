/**
 * Closed set of reasons an examination could not be judged. Closed at 5.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
export const UnreadableReason = {
  BLURRY: 'BLURRY',
  GLARE: 'GLARE',
  CROPPED: 'CROPPED',
  EXPIRED: 'EXPIRED',
  MISMATCHED_TYPE: 'MISMATCHED_TYPE',
} as const;
export type UnreadableReason = (typeof UnreadableReason)[keyof typeof UnreadableReason];

export function parseUnreadableReason(v: string): UnreadableReason {
  if (!(Object.values(UnreadableReason) as string[]).includes(v))
    throw new Error(`invalid unreadable reason: ${v}`);
  return v as UnreadableReason;
}
