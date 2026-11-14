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
    dataTable.raw().map(([key, value]) => [key, value]),
  );
}

function requestUrl(api, path) {
  return new URL(path, `${api.baseUrl.replace(/\/$/, '')}/`).toString();
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
  state(this).registeredUser = { email };
});

Given('the user has an open session', function () {
  state(this).sessionOpen = true;
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
