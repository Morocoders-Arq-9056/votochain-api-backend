import { HttpStatus, ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { GlobalExceptionFilter } from './../src/shared/interfaces/rest/filters/global-exception.filter.js';

describe('Verification recovery by email (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());
  const email = (tag: string) => `recovery-${tag}-${Date.now()}@votachain.dev`;

  it('POST /api/v1/challenges/by-email → 404 en dirección desconocida', async () => {
    await server()
      .post('/api/v1/challenges/by-email')
      .send({ email: 'ghost@votachain.dev', purpose: 'password-reset' })
      .expect(HttpStatus.NOT_FOUND);
  });

  it('POST /api/v1/challenges/by-email → 400 en email malformado', async () => {
    await server()
      .post('/api/v1/challenges/by-email')
      .send({ email: 'not-an-email', purpose: 'password-reset' })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('flujo: sign-up → by-email 201 → GET por email lista → secret en OPEN da 404', async () => {
    const address = email('loop');
    await server().post('/api/v1/users').send({ email: address }).expect(HttpStatus.CREATED);

    const created = await server()
      .post('/api/v1/challenges/by-email')
      .send({ email: address, purpose: 'password-reset' })
      .expect(HttpStatus.CREATED);
    expect(created.body.challengeId).toMatch(/^ch-/);
    expect(created.body.purpose).toBe('password-reset');
    expect(created.body.standing).toBe('OPEN');

    const listed = await server()
      .get('/api/v1/challenges')
      .query({ email: address, purpose: 'password-reset' })
      .expect(HttpStatus.OK);
    expect(listed.body.length).toBeGreaterThanOrEqual(1);

    // Sin confirmar no se puede rotar: 404, no se toca el secreto.
    await server()
      .post(`/api/v1/challenges/${created.body.challengeId}/secret`)
      .send({ newSecret: 'ref-2' })
      .expect(HttpStatus.NOT_FOUND);
  });

  it('GET /api/v1/challenges sin filtros → 400', async () => {
    await server().get('/api/v1/challenges').expect(HttpStatus.BAD_REQUEST);
  });
});
