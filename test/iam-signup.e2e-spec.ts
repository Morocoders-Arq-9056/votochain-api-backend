import { HttpStatus, ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { GlobalExceptionFilter } from './../src/shared/interfaces/rest/filters/global-exception.filter.js';

describe('IAM signup (e2e)', () => {
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

  const email = (tag: string) => `signup-${tag}-${Date.now()}@votachain.dev`;

  it('POST /api/v1/iam/users/signup → 201 + UserResource without token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/iam/users/signup')
      .send({ email: email('new') })
      .expect(HttpStatus.CREATED);

    expect(res.body.userId).toMatch(/^usr-/);
    expect(res.body.email).toContain('@votachain.dev');
    expect(res.body.token).toBeUndefined();
  });

  it('POST the same email twice → 201 then 409', async () => {
    const dup = email('dup');
    await request(app.getHttpServer())
      .post('/api/v1/iam/users/signup')
      .send({ email: dup })
      .expect(HttpStatus.CREATED);
    const res = await request(app.getHttpServer())
      .post('/api/v1/iam/users/signup')
      .send({ email: dup })
      .expect(HttpStatus.CONFLICT);

    expect(res.body.statusCode).toBe(HttpStatus.CONFLICT);
  });

  it('POST a malformed email → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/iam/users/signup')
      .send({ email: 'not-an-email' })
      .expect(HttpStatus.BAD_REQUEST);
  });
});
