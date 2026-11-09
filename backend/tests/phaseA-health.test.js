import request from 'supertest';
import { app } from './helpers/db.js';

// Phase A (A5): a lightweight liveness probe that does not touch the database or expose secrets.

describe('Phase A health endpoint', () => {
  it('responds with a public, secret-free liveness payload', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
