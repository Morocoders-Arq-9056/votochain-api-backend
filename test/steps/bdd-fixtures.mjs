import { Before } from '@cucumber/cucumber';
import { createHmac, randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: ['.env.local', '.env'], override: true, quiet: true });

const apiBase = (process.env.BDD_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const api = async (method, path, body) => {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : undefined; } catch { payload = text; }
  if (!response.ok) {
    throw new Error(`BDD fixture setup failed (${method} ${path}): HTTP ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
};

const token = () => randomUUID().replaceAll('-', '').slice(0, 12);
const registerUser = async (tag) => {
  const email = `bdd-${tag}-${token()}@votachain.dev`;
  const user = await api('POST', '/api/v1/users', { email, password: 'S3gura-2026' });
  return { ...user, email };
};

const registerCommunity = async (tag, personId, withPolicy) => {
  const community = await api('POST', '/api/v1/communities', {
    name: `BDD ${tag} ${token()}`,
    domicile: 'Lima, Peru',
    contact: `bdd-${token()}@example.dev`,
    adminPersonId: personId,
  });
  if (withPolicy) {
    await api('PUT', `/api/v1/communities/${community.communityId}/policy`, {
      threshold: 51,
      basis: 'members',
      majorityRule: 'simple-majority',
    });
  }
  return community;
};

const requestChallenge = async (personId, purpose) => {
  const challenge = await api('POST', '/api/v1/challenges', { personId, purpose });
  return challenge.challengeId;
};

const hashChallengeCode = async (challengeId, code, status, expired = false) => {
  const client = new pg.Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await client.connect();
  try {
    const hash = process.env.OTP_HASHER === 'fake'
      ? `fake:${code}`
      : createHmac('sha256', process.env.OTP_HMAC_SECRET).update(code, 'utf8').digest('hex');
    await client.query(
      `UPDATE verification.challenges
       SET code_hash = $1, standing = $2, requested_at = $3, expires_at = $4, updated_at = now()
       WHERE id = $5`,
      [
        hash,
        status,
        expired ? new Date(Date.now() - 10 * 60_000) : new Date(),
        expired ? new Date(Date.now() - 60_000) : new Date(Date.now() + 5 * 60_000),
        challengeId,
      ],
    );
  } finally {
    await client.end();
  }
};

Before(async function ({ pickle }) {
  const runId = token();
  const mainUser = await registerUser(`main-${runId}`);
  await api('POST', `/api/v1/users/${mainUser.userId}/email/verifications`, { email: mainUser.email });
  await api('POST', '/api/v1/consents', {
    personId: mainUser.personId,
    scope: 'EMAIL_NOTIFICATIONS',
    policyVersion: 'bdd-test-v1',
  });
  const noConsentUser = await registerUser(`no-consent-${runId}`);
  await api('POST', '/api/v1/consents', {
    personId: noConsentUser.personId,
    scope: 'EMAIL_NOTIFICATIONS',
    policyVersion: 'bdd-test-v1',
  });
  await api('POST', '/api/v1/consents/EMAIL_NOTIFICATIONS/revoke', {
    personId: noConsentUser.personId,
  });
  const readyCommunity = await registerCommunity(`ready-${runId}`, mainUser.personId, true);
  const unreadyCommunity = await registerCommunity(`unready-${runId}`, mainUser.personId, false);

  Object.assign(process.env, {
    BDD_USER_EMAIL: mainUser.email,
    BDD_USER_ID: mainUser.userId,
    BDD_USER_PASSWORD: 'S3gura-2026',
    BDD_PERSON_ID: mainUser.personId,
    BDD_NO_CONSENT_PERSON_ID: noConsentUser.personId,
    BDD_AVAILABLE_EMAIL: `bdd-changed-${runId}@votachain.dev`,
    BDD_NEW_SECRET: 'Nueva-Clave-2026',
    BDD_READY_COMMUNITY_ID: readyCommunity.communityId,
    BDD_UNREADY_COMMUNITY_ID: unreadyCommunity.communityId,
    BDD_COMMUNITY_NAME: `BDD standalone-${runId}`,
    BDD_COMMUNITY_CONTACT: `bdd-community-${runId}@example.dev`,
    BDD_SIGNUP_EMAIL: `bdd-signup-${runId}@votachain.dev`,
    BDD_OTP_CODE: '246810',
  });

  if (pickle.name === 'Confirm a challenge using its valid code' ||
      pickle.name === 'Reject an incorrect challenge answer' ||
      pickle.name === 'Reject an expired challenge answer') {
    const challengeId = await requestChallenge(mainUser.personId, 'email-verification');
    const isExpired = pickle.name === 'Reject an expired challenge answer';
    await hashChallengeCode(challengeId, process.env.BDD_OTP_CODE, 'OPEN', isExpired);
    process.env.BDD_CHALLENGE_ID = challengeId;
    process.env.BDD_EXPIRED_CHALLENGE_ID = challengeId;
  }

  if (pickle.name === 'Reset a secret after a confirmed recovery challenge') {
    const challenge = await api('POST', '/api/v1/challenges/by-email', {
      email: mainUser.email,
      purpose: 'password-reset',
    });
    await hashChallengeCode(challenge.challengeId, process.env.BDD_OTP_CODE, 'OPEN');
    await api('POST', `/api/v1/challenges/${challenge.challengeId}/answers`, { code: process.env.BDD_OTP_CODE });
    process.env.BDD_RESET_CHALLENGE_ID = challenge.challengeId;
  }

  if (pickle.name === 'Reject a reset without a confirmed recovery challenge') {
    const challenge = await api('POST', '/api/v1/challenges/by-email', {
      email: mainUser.email,
      purpose: 'password-reset',
    });
    process.env.BDD_OPEN_RESET_CHALLENGE_ID = challenge.challengeId;
  }
});
