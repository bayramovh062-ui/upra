import path from 'path';
import fs from 'fs';
import request from 'supertest';
import { app, auth, cleanUpUsers, prisma } from './helpers/db.js';
import { PASSWORD, api, createContractWithMilestones, fundAndSubmit, registerAdmin, registerPair } from './helpers/p2.js';
import { fundMilestone, topUp } from '../src/services/financialService.js';

// Plan P3: file uploads/attachments. Uses local storage fallback (no Cloudinary in tests).
// Creates small in-memory buffers; does not hit external services.

const PREFIX = 'plan3up';
const PAIR = { client: `${PREFIX}_c1@upra.com`, freelancer: `${PREFIX}_f1@upra.com` };
const ADMIN_EMAIL = `${PREFIX}_admin@upra.com`;
const OUTSIDER_EMAIL = `${PREFIX}_out@upra.com`;
const ALL = [PAIR.client, PAIR.freelancer, ADMIN_EMAIL, OUTSIDER_EMAIL];

const file = (name, content, type) => Buffer.from(content);

describe('Plan P3 file uploads', () => {
  let pair, admin, outsider;

  beforeAll(async () => {
    await cleanUpUsers(ALL);
    pair = await registerPair(PREFIX, 1);
    admin = await registerAdmin(ADMIN_EMAIL);
    const r = await request(app).post('/api/auth/register').send({ email: OUTSIDER_EMAIL, password: PASSWORD, fullName: 'Outsider', role: 'CLIENT' });
    outsider = { token: r.body.token, user: r.body.user };
    process.env.UPLOAD_PROVIDER = 'local';
  });

  afterAll(async () => {
    await cleanUpUsers(ALL);
  });

  it('uploads avatar and updates profile', async () => {
    const res = await request(app)
      .post('/api/attachments/avatar')
      .set(auth(pair.c.token))
      .attach('file', Buffer.from('fakepng'), { filename: 'avatar.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.avatarUrl).toMatch(/\/api\/uploads\/local\//);
    expect(res.body.attachment).toMatchObject({ purpose: 'AVATAR', mimeType: 'image/png', filename: 'avatar.png' });
    const me = await request(app).get('/api/auth/me').set(auth(pair.c.token));
    expect(me.body.user.avatarUrl).toBe(res.body.avatarUrl);
  });

  it('rejects invalid avatar type and enforces access rules', async () => {
    const bad = await request(app)
      .post('/api/attachments/avatar')
      .set(auth(pair.c.token))
      .attach('file', Buffer.from('%PDF-1.4'), { filename: 'x.pdf', contentType: 'application/pdf' });
    expect(bad.status).toBe(400);

    // create funded milestone context for submission upload access checks
    const contract = await createContractWithMilestones({
      clientToken: pair.c.token,
      freelancerToken: pair.f.token,
      milestones: [{ title: 'Deliver', amount: 50 }],
      title: 'Upload context',
    });
    const m = contract.milestones[0];
    await topUp(pair.c.user.id, m.amountCents);
    await fundMilestone(m.id, pair.c.user.id);

    const outsiderUp = await request(app)
      .post(`/api/attachments/milestones/${m.id}/files`)
      .set(auth(outsider.token))
      .attach('files', Buffer.from('hello'), { filename: 'note.txt', contentType: 'text/plain' });
    expect([403, 404]).toContain(outsiderUp.status);

    const clientUp = await request(app)
      .post(`/api/attachments/milestones/${m.id}/files`)
      .set(auth(pair.c.token))
      .attach('files', Buffer.from('hello'), { filename: 'note.txt', contentType: 'text/plain' });
    expect(clientUp.status).toBe(403);

    const ok = await request(app)
      .post(`/api/attachments/milestones/${m.id}/files`)
      .set(auth(pair.f.token))
      .attach('files', Buffer.from('deliverable'), { filename: 'deliverable.txt', contentType: 'text/plain' });
    expect(ok.status).toBe(201);
    expect(ok.body.attachments[0]).toMatchObject({ purpose: 'MILESTONE_SUBMIT', contractId: contract.id, milestoneId: m.id });
  });

  it('allows dispute evidence for parties and admin can view dispute attachments', async () => {
    const contract = await createContractWithMilestones({
      clientToken: pair.c.token,
      freelancerToken: pair.f.token,
      milestones: [{ title: 'Disputed', amount: 60 }],
      title: 'Dispute upload',
    });
    const m = contract.milestones[0];
    await fundAndSubmit(pair.c.user.id, pair.f.user.id, m);
    const opened = await request(app)
      .post(`/api/milestones/${m.id}/dispute`)
      .set(auth(pair.f.token))
      .send({ reason: 'Work was rejected unfairly' });
    expect(opened.status).toBe(201);
    const disputeId = opened.body.dispute.id;

    const up = await request(app)
      .post(`/api/attachments/disputes/${disputeId}/files`)
      .set(auth(pair.c.token))
      .attach('files', Buffer.from('evidence'), { filename: 'evidence.txt', contentType: 'text/plain' });
    expect(up.status).toBe(201);
    expect(up.body.attachments[0].purpose).toBe('DISPUTE_EVIDENCE');

    const adminView = await request(app).get(`/api/admin/disputes/${disputeId}`).set(auth(admin.token));
    expect(adminView.status).toBe(200);
    expect(Array.isArray(adminView.body.dispute.attachments)).toBe(true);
    expect(adminView.body.dispute.attachments.length).toBeGreaterThan(0);

    const outsiderView = await request(app).get(`/api/admin/disputes/${disputeId}`).set(auth(outsider.token));
    expect(outsiderView.status).toBe(403);
  });
});
