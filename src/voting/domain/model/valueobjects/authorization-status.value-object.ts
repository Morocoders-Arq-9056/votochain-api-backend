export const AuthorizationStatus = { PENDING: 'PENDING', CONSUMED: 'CONSUMED', EXPIRED: 'EXPIRED', DENIED: 'DENIED' } as const;
export type AuthorizationStatus = (typeof AuthorizationStatus)[keyof typeof AuthorizationStatus];

export function parseAuthorizationStatus(v: string): AuthorizationStatus {
  if (!(Object.values(AuthorizationStatus) as string[]).includes(v)) throw new Error(`invalid authorization status: ${v}`);
  return v as AuthorizationStatus;
}
