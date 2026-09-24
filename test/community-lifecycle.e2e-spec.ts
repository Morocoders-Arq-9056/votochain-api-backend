import { HttpStatus, ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { GlobalExceptionFilter } from './../src/shared/interfaces/rest/filters/global-exception.filter.js';

describe('Community lifecycle (e2e)', () => {
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
  const name = (tag: string) => `e2e-${tag}-${Date.now()}`;
  // Register performs no IAM gate (UC1), so any well-formed person id founds.
  const founder = `per-e2e-${Date.now()}`;
  const stranger = `per-unknown-${Date.now()}`;

  async function register(tag: string): Promise<{ id: string }> {
    const res = await server()
      .post('/api/v1/communities')
      .send({ name: name(tag), domicile: 'Lima, Peru', contact: 'contact@example.dev', adminPersonId: founder })
      .expect(HttpStatus.CREATED);

    expect(res.body.communityId).toMatch(/^com-/);
    expect(res.body.standing).toBe('REGISTERED');
    expect(res.headers.location).toContain(res.body.communityId);
    return { id: res.body.communityId as string };
  }

  const policy = { threshold: 51, basis: 'members', majorityRule: 'simple-majority' };

  it('POST /api/v1/communities → 201 + REGISTERED with founding admin', async () => {
    const { id } = await register('new');
    const res = await server().get(`/api/v1/communities/${id}`).expect(HttpStatus.OK);

    expect(res.body.admins).toHaveLength(1);
    expect(res.body.admins[0].personId).toBe(founder);
    expect(res.body.policy).toBeNull();
  });

  it('register → policy → activate → standing accepts members and proposals', async () => {
    const { id } = await register('flow');

    await server().put(`/api/v1/communities/${id}/policy`).send(policy).expect(HttpStatus.OK);
    const activated = await server().post(`/api/v1/communities/${id}/activate`).expect(HttpStatus.OK);
    expect(activated.body.standing).toBe('ACTIVE');

    const standing = await server().get(`/api/v1/communities/${id}/standing`).expect(HttpStatus.OK);
    expect(standing.body).toMatchObject({ standing: 'ACTIVE', acceptsMembers: true, acceptsProposals: true });

    const answered = await server().get(`/api/v1/communities/${id}/policy`).expect(HttpStatus.OK);
    expect(answered.body).toMatchObject(policy);
  });

  it('activate before any policy → 422 PolicyUndefined', async () => {
    const { id } = await register('nopolitics');
    const res = await server().post(`/api/v1/communities/${id}/activate`)
      .expect(HttpStatus.UNPROCESSABLE_ENTITY);

    expect(res.body.statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
  });

  it('duplicate name → 409', async () => {
    const dup = name('dup');
    const body = { name: dup, domicile: 'Lima, Peru', contact: 'contact@example.dev', adminPersonId: founder };
    await server().post('/api/v1/communities').send(body).expect(HttpStatus.CREATED);
    await server().post('/api/v1/communities').send(body).expect(HttpStatus.CONFLICT);
  });

  it('suspend → refuses beginnings; reactivate → accepts again', async () => {
    const { id } = await register('pause');
    await server().put(`/api/v1/communities/${id}/policy`).send(policy).expect(HttpStatus.OK);
    await server().post(`/api/v1/communities/${id}/activate`).expect(HttpStatus.OK);

    await server().post(`/api/v1/communities/${id}/suspend`).send({ reason: 'roll review' }).expect(HttpStatus.OK);
    const suspended = await server().get(`/api/v1/communities/${id}/standing`).expect(HttpStatus.OK);
    expect(suspended.body).toMatchObject({ standing: 'SUSPENDED', acceptsMembers: false, acceptsProposals: false });

    await server().post(`/api/v1/communities/${id}/reactivate`).expect(HttpStatus.OK);
    const active = await server().get(`/api/v1/communities/${id}/standing`).expect(HttpStatus.OK);
    expect(active.body).toMatchObject({ standing: 'ACTIVE', acceptsMembers: true });
  });

  it('remove last admin while ACTIVE → 409', async () => {
    const { id } = await register('lastadmin');
    await server().put(`/api/v1/communities/${id}/policy`).send(policy).expect(HttpStatus.OK);
    await server().post(`/api/v1/communities/${id}/activate`).expect(HttpStatus.OK);

    await server().delete(`/api/v1/communities/${id}/admins/${founder}`).expect(HttpStatus.CONFLICT);
  });

  it('appoint unknown person → 404', async () => {
    const { id } = await register('stranger');
    await server().post(`/api/v1/communities/${id}/admins`)
      .send({ personId: stranger })
      .expect(HttpStatus.NOT_FOUND);
  });

  it('archive → terminal: settings, policy and activate all refuse', async () => {
    const { id } = await register('end');
    await server().put(`/api/v1/communities/${id}/policy`).send(policy).expect(HttpStatus.OK);
    await server().post(`/api/v1/communities/${id}/activate`).expect(HttpStatus.OK);
    await server().post(`/api/v1/communities/${id}/archive`).send({ reason: 'dissolved' }).expect(HttpStatus.OK);

    await server().patch(`/api/v1/communities/${id}/settings`)
      .send({ name: name('x'), domicile: 'Lima, Peru', contact: 'contact@example.dev' })
      .expect(HttpStatus.CONFLICT);
    await server().put(`/api/v1/communities/${id}/policy`).send(policy).expect(HttpStatus.CONFLICT);
    await server().post(`/api/v1/communities/${id}/activate`).expect(HttpStatus.CONFLICT);

    const standing = await server().get(`/api/v1/communities/${id}/standing`).expect(HttpStatus.OK);
    expect(standing.body).toMatchObject({ standing: 'ARCHIVED', acceptsMembers: false });
  });

  it('GET unknown community → 404', async () => {
    await server().get('/api/v1/communities/com-missing').expect(HttpStatus.NOT_FOUND);
  });
});
