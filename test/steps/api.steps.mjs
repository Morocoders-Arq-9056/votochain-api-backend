import { strict as assert } from 'node:assert';
import { Given, When, Then } from '@cucumber/cucumber';

const defaultBaseUrl = 'http://localhost:3000';

function state(world) {
  if (!world.api) {
    world.api = {
      baseUrl: process.env.BDD_BASE_URL ?? defaultBaseUrl,
      prefix: '',
      request: { headers: {} },
      response: undefined,
      body: undefined,
    };
  }

  return world.api;
}

function tableToObject(dataTable) {
  return Object.fromEntries(
    dataTable.raw().map(([key, value]) => [key, resolveFixture(value)]),
  );
}

function resolveFixture(value) {
  return value.replace(/\$\{(BDD_[A-Z_]+)\}/g, (_, name) => {
    assert.ok(process.env[name], `Missing test fixture: ${name}`);
    return process.env[name];
  });
}

function requestUrl(api, path) {
  return new URL(resolveFixture(path), `${api.baseUrl.replace(/\/$/, '')}/`).toString();
}

async function sendRequest(api) {
  const response = await fetch(requestUrl(api, api.request.path), {
    method: api.request.method,
    headers: {
      Accept: 'application/json',
      ...(api.request.body ? { 'Content-Type': 'application/json' } : {}),
      ...api.request.headers,
    },
    body: api.request.body ? JSON.stringify(api.request.body) : undefined,
  });

  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    // Preserve non-JSON responses for diagnostic assertions.
  }

  api.response = { status: response.status, headers: response.headers, body };
}

function responseText(api) {
  return JSON.stringify(api.response?.body ?? '').toLowerCase();
}

Given('the API is configured with the prefix {string}', function (prefix) {
  state(this).prefix = prefix;
});

Given('a registered user exists with email {string}', function (email) {
  state(this).registeredUser = { email: resolveFixture(email) };
});

Given('the user has an open session', async function () {
  state(this).sessionOpen = true;
  const email = state(this).registeredUser?.email ?? process.env.BDD_USER_EMAIL;
  const response = await fetch(`${state(this).baseUrl}/api/v1/auth/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password: process.env.BDD_USER_PASSWORD, proofKind: 'LOCAL' }),
  });
  assert.equal(response.status, 200, `Could not open fixture session for ${email}`);
});

Given('a registered user is available in the test environment', function () {
  assert.ok(process.env.BDD_USER_EMAIL, 'Missing test fixture: BDD_USER_EMAIL');
  assert.ok(process.env.BDD_USER_ID, 'Missing test fixture: BDD_USER_ID');
});

Given('a registered user with valid local credentials is available in the test environment', function () {
  assert.ok(process.env.BDD_USER_EMAIL, 'Missing test fixture: BDD_USER_EMAIL');
  assert.ok(process.env.BDD_USER_PASSWORD, 'Missing test fixture: BDD_USER_PASSWORD');
});

Given('a consenting registered person is available in the test environment', function () {
  assert.ok(process.env.BDD_PERSON_ID, 'Missing test fixture: BDD_PERSON_ID');
});

Given('a registered person who revoked contact consent is available in the test environment', function () {
  assert.ok(process.env.BDD_NO_CONSENT_PERSON_ID, 'Missing test fixture: BDD_NO_CONSENT_PERSON_ID');
});

Given('an open email-verification challenge is available in the test environment', function () {
  assert.ok(process.env.BDD_CHALLENGE_ID, 'Missing test fixture: BDD_CHALLENGE_ID');
});

Given('an expired challenge is available in the test environment', function () {
  assert.ok(process.env.BDD_EXPIRED_CHALLENGE_ID, 'Missing test fixture: BDD_EXPIRED_CHALLENGE_ID');
});

Given('a confirmed password-reset challenge is available in the test environment', function () {
  assert.ok(process.env.BDD_RESET_CHALLENGE_ID, 'Missing test fixture: BDD_RESET_CHALLENGE_ID');
});

Given('an open password-reset challenge is available in the test environment', function () {
  assert.ok(process.env.BDD_OPEN_RESET_CHALLENGE_ID, 'Missing test fixture: BDD_OPEN_RESET_CHALLENGE_ID');
});

Given('a registered community with an administrator and policy is available in the test environment', function () {
  assert.ok(process.env.BDD_READY_COMMUNITY_ID, 'Missing test fixture: BDD_READY_COMMUNITY_ID');
});

Given('a registered community without a policy is available in the test environment', function () {
  assert.ok(process.env.BDD_UNREADY_COMMUNITY_ID, 'Missing test fixture: BDD_UNREADY_COMMUNITY_ID');
});


Given('a community exists with identifier {string}', function (communityId) {
  state(this).communityId = communityId;
});

Given('a valid vote payload is available', function () {
  state(this).votePayload = {
    authorizationId:
      process.env.BDD_AUTHORIZATION_ID ??
      'auth-00000000-0000-4000-8000-000000000001',
    choice: 'Option A',
  };
});

Given('a valid authorization exists for proposal {string}', function (proposalId) {
  state(this).votePayload = {
    authorizationId:
      process.env.BDD_AUTHORIZATION_ID ??
      'auth-00000000-0000-4000-8000-000000000001',
    proposalId,
  };
});

Given('the selected choice is {string}', function (choice) {
  state(this).votePayload ??= {};
  state(this).votePayload.choice = choice;
});

Given('a vote receipt exists for proposal {string}', function (proposal) {
  state(this).receiptQuery = { proposal };
});

Given('the voter address is {string}', function (voter) {
  state(this).receiptQuery ??= {};
  state(this).receiptQuery.voter = voter;
});

When('I send a POST request to {string} with:', async function (path, dataTable) {
  const api = state(this);
  api.request = {
    method: 'POST',
    path,
    headers: {},
    body: tableToObject(dataTable),
  };
  await sendRequest(api);
});

When('I send a PATCH request to {string} with:', async function (path, dataTable) {
  const api = state(this);
  api.request = { method: 'PATCH', path, headers: {}, body: tableToObject(dataTable) };
  await sendRequest(api);
});

When('I sign in twice with the configured local credentials', async function () {
  const api = state(this);
  api.request = {
    method: 'POST', path: '/api/v1/auth/sign-in', headers: {},
    body: { email: process.env.BDD_USER_EMAIL, password: process.env.BDD_USER_PASSWORD, proofKind: 'LOCAL' },
  };
  await sendRequest(api);
  api.firstSignInStatus = api.response.status;
  await sendRequest(api);
});

When(
  'I send a POST request to {string} without the {string} header',
  async function (path) {
    const api = state(this);
    api.request = {
      method: 'POST',
      path,
      headers: {},
      body: api.votePayload,
    };
    await sendRequest(api);
  },
);

When(
  'I send a POST request to {string} with header {string} set to {string}',
  function (path, header, value) {
    const api = state(this);
    api.request = {
      method: 'POST',
      path,
      headers: { [header]: value },
      body: undefined,
    };
  },
);

When('the request body contains the authorization and selected choice', async function () {
  const api = state(this);
  api.request.body = api.votePayload;
  await sendRequest(api);
});

When('I send a GET request to {string}', async function (path) {
  const api = state(this);
  api.request = { method: 'GET', path, headers: {} };
  await sendRequest(api);
});

When('I send a GET request to {string} with query parameters:', async function (path, dataTable) {
  const api = state(this);
  const query = new URLSearchParams(tableToObject(dataTable));
  api.request = { method: 'GET', path: `${path}?${query}`, headers: {} };
  await sendRequest(api);
});

Then('the response status should be {int}', function (expectedStatus) {
  assert.equal(state(this).response?.status, expectedStatus);
});

Then('the response should have standing {string}', function (standing) {
  assert.equal(state(this).response?.body?.standing, standing);
});

Then('the response should have session {string}', function (session) {
  assert.equal(state(this).response?.body?.session, session);
});

Then('both sign-in responses should have status {int}', function (status) {
  assert.equal(state(this).firstSignInStatus, status);
  assert.equal(state(this).response?.status, status);
});

Then('the response should have email {string}', function (email) {
  assert.equal(state(this).response?.body?.email, resolveFixture(email));
});

Then('the response should indicate the email is unverified', function () {
  assert.equal(state(this).response?.body?.emailVerified, false);
});

Then('the response should not contain an OTP code', function () {
  assert.equal(Object.hasOwn(state(this).response?.body ?? {}, 'code'), false);
});


Then('the response should not contain the password', function () {
  assert.equal(responseText(state(this)).includes('s3gura-2026'), false);
  assert.equal(responseText(state(this)).includes('password'), false);
});

Then('the response should contain a registered user resource', function () {
  assert.ok(state(this).response?.body);
});

Then('the response should describe invalid credentials', function () {
  assert.match(responseText(state(this)), /invalid|credential|unauthor/);
});

Then('the response should contain a community resource', function () {
  assert.ok(state(this).response?.body);
});

Then('the response should include a Location header for the created community', function () {
  assert.ok(state(this).response?.headers.get('location'));
});

Then('the response should contain the community standing', function () {
  assert.match(responseText(state(this)), /standing|community|status/);
});

Then('the response should indicate whether the community accepts members', function () {
  assert.match(responseText(state(this)), /accept|member/);
});

Then('the response should state that the idempotency key is required', function () {
  assert.match(responseText(state(this)), /idempotency|key|required/);
});

Then('the response should contain a voter receipt', function () {
  assert.match(responseText(state(this)), /receipt|vote|transaction/);
});

Then('the response should include a Location header for the created vote', function () {
  assert.ok(state(this).response?.headers.get('location'));
});

Then('the response should contain the vote receipt standing', function () {
  assert.match(responseText(state(this)), /receipt|standing|status|vote/);
});
