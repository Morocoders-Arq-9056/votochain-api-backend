import { HttpStatus, ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { GlobalExceptionFilter } from './../src/shared/interfaces/rest/filters/global-exception.filter.js';

describe('IAM identity lifecycle (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirror main.ts: global prefix + pipes + filters live in bootstrap,
    // Test.createTestingModule does not inherit them.
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());
  const email = (tag: string) => `lifecycle-${tag}-${Date.now()}@votachain.dev`;

  async function signUp(tag: string): Promise<{ id: string; email: string }> {
    const address = email(tag);
    const res = await server().post('/api/v1/users').send({ email: address }).expect(HttpStatus.CREATED);

    expect(res.body.userId).toMatch(/^usr-/);
    expect(res.body.token).toBeUndefined();
    expect(res.headers.location).toContain(res.body.userId);
    return { id: res.body.userId as string, email: address };
  }

  async function signUpActive(tag: string): Promise<{ id: string; email: string }> {
    const created = await signUp(tag);
    await server()
      .post(`/api/v1/users/${created.id}/email/verifications`)
      .send({ email: created.email })
      .expect(HttpStatus.CREATED);
    return created;
  }

  it('POST /api/v1/users → 201 + UserResource without token', async () => {
    const { email: address } = await signUp('new');
    expect(address).toContain('@votachain.dev');
  });

  it('POST the same email twice → 201 then 409', async () => {
    const dup = email('dup');
    await server().post('/api/v1/users').send({ email: dup }).expect(HttpStatus.CREATED);
    const res = await server().post('/api/v1/users').send({ email: dup }).expect(HttpStatus.CONFLICT);

    expect(res.body.statusCode).toBe(HttpStatus.CONFLICT);
  });

  it('POST a malformed email → 400', async () => {
    await server().post('/api/v1/users').send({ email: 'not-an-email' }).expect(HttpStatus.BAD_REQUEST);
  });

  it('sign-in → sign-out moves the session open then closed', async () => {
    const { id, email: address } = await signUpActive('session');

    const opened = await server()
      .post('/api/v1/auth/sign-in')
      .send({ email: address, proofKind: 'LOCAL' })
      .expect(HttpStatus.OK);
    expect(opened.body.session).toBe('SESSION_OPEN');

    await server().post('/api/v1/auth/sign-out').send({ email: address }).expect(HttpStatus.NO_CONTENT);
    const closed = await server().get(`/api/v1/users/${id}`).expect(HttpStatus.OK);
    expect(closed.body.session).toBe('SESSION_CLOSED');
  });

  it('sign-in unknown address → 404; sign-out unknown address → 404', async () => {
    await server()
      .post('/api/v1/auth/sign-in')
      .send({ email: 'ghost@votachain.dev', proofKind: 'LOCAL' })
      .expect(HttpStatus.NOT_FOUND);
    await server()
      .post('/api/v1/auth/sign-out')
      .send({ email: 'ghost@votachain.dev' })
      .expect(HttpStatus.NOT_FOUND);
  });

  it('sign-out with no open session → 409', async () => {
    const { email: address } = await signUp('nosession');
    await server().post('/api/v1/auth/sign-out').send({ email: address }).expect(HttpStatus.CONFLICT);
  });

  it('suspend → restore moves standing SUSPENDED then ACTIVE', async () => {
    const { id } = await signUp('standing');

    const suspended = await server()
      .patch(`/api/v1/users/${id}/standing`)
      .send({ standing: 'SUSPENDED', reason: 'abuse' })
      .expect(HttpStatus.OK);
    expect(suspended.body.standing).toBe('SUSPENDED');

    const restored = await server()
      .patch(`/api/v1/users/${id}/standing`)
      .send({ standing: 'ACTIVE' })
      .expect(HttpStatus.OK);
    expect(restored.body.standing).toBe('ACTIVE');
  });

  it('suspend without reason → 422', async () => {
    const { id } = await signUp('noreason');
    await server()
      .patch(`/api/v1/users/${id}/standing`)
      .send({ standing: 'SUSPENDED' })
      .expect(HttpStatus.UNPROCESSABLE_ENTITY);
  });

  it('change secret → 200; change email → 200 unverified; verify → 201 ACTIVE', async () => {
    const { id } = await signUp('contact');

    await server().patch(`/api/v1/users/${id}/secret`).send({ newSecret: 'ref-2' }).expect(HttpStatus.OK);

    const changed = email('changed');
    const emailChanged = await server()
      .patch(`/api/v1/users/${id}/email`)
      .send({ newEmail: changed })
      .expect(HttpStatus.OK);
    expect(emailChanged.body.email).toBe(changed);
    expect(emailChanged.body.emailVerified).toBe(false);

    const verified = await server()
      .post(`/api/v1/users/${id}/email/verifications`)
      .send({ email: changed })
      .expect(HttpStatus.CREATED);
    expect(verified.body.emailVerified).toBe(true);
    expect(verified.body.standing).toBe('ACTIVE');
  });

  it('link → 201 + Location; link again → 409; unlink → 204', async () => {
    const { id } = await signUpActive('outside');

    const linked = await server()
      .post(`/api/v1/users/${id}/outside-identities`)
      .send({ provider: 'auth0', externalId: 'auth0|123456' })
      .expect(HttpStatus.CREATED);
    expect(linked.headers.location).toContain(`/api/v1/users/${id}/outside-identities/auth0`);

    await server()
      .post(`/api/v1/users/${id}/outside-identities`)
      .send({ provider: 'auth0', externalId: 'auth0|123456' })
      .expect(HttpStatus.CONFLICT);

    await server().delete(`/api/v1/users/${id}/outside-identities/auth0`).expect(HttpStatus.NO_CONTENT);
  });

  it('grant held role → 409; revoke missing role → 409', async () => {
    const { id } = await signUp('roles');

    await server().post(`/api/v1/users/${id}/roles`).send({ role: 'USER' }).expect(HttpStatus.CONFLICT);
    await server().delete(`/api/v1/users/${id}/roles/ADMIN`).expect(HttpStatus.CONFLICT);
  });

  it('sub-resource reads: session state, roles, outside-identities', async () => {
    const { id } = await signUpActive('reads');

    const user = await server().get(`/api/v1/users/${id}`).expect(HttpStatus.OK);
    expect(user.body.session).toBe('SESSION_CLOSED');

    const roles = await server().get(`/api/v1/users/${id}/roles`).expect(HttpStatus.OK);
    expect(roles.body).toContain('USER');

    const factors = await server().get(`/api/v1/users/${id}/outside-identities`).expect(HttpStatus.OK);
    expect(factors.body).toHaveLength(0);

    await server()
      .post(`/api/v1/users/${id}/outside-identities`)
      .send({ provider: 'auth0', externalId: 'auth0|123456' })
      .expect(HttpStatus.CREATED);
    const linked = await server().get(`/api/v1/users/${id}/outside-identities`).expect(HttpStatus.OK);
    expect(linked.body).toMatchObject([{ provider: 'auth0' }]);
  });

  it('GET unknown user → 404', async () => {
    await server().get('/api/v1/users/usr-missing').expect(HttpStatus.NOT_FOUND);
  });
});
