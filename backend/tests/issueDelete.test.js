import { prisma, cleanUpUsers } from './helpers/db.js';
import { api, pairEmails, registerPair, createContractWithMilestones } from './helpers/p2.js';

// Tapşırığı yalnız onu yaradan tərəf silə bilər (client və frilanser bir-birinin tapşırığını silməz).

const PREFIX = 'issuedelete';
const ALL_EMAILS = Object.values(pairEmails(PREFIX, 1));

describe('Only the creator can delete a task', () => {
  let pair;
  let contract;

  const addIssue = async (token, title) => {
    const res = await api.post(token, `/api/contracts/${contract.id}/issues`, { title });
    expect(res.status).toBe(201);
    return res.body.issue;
  };

  beforeAll(async () => {
    await cleanUpUsers(ALL_EMAILS);
    pair = await registerPair(PREFIX, 1);
    contract = await createContractWithMilestones({
      clientToken: pair.c.token,
      freelancerToken: pair.f.token,
      milestones: [{ title: 'Only', amount: 40 }],
      title: 'Issue delete job',
    });
  });

  afterAll(async () => {
    await cleanUpUsers(ALL_EMAILS);
  });

  it('lets the creator delete their own task', async () => {
    const issue = await addIssue(pair.f.token, 'Freelancer task');

    const res = await api.delete(pair.f.token, `/api/issues/${issue.id}`);
    expect(res.status).toBe(200);
    expect(await prisma.issue.findUnique({ where: { id: issue.id } })).toBeNull();
  });

  it('refuses when the other party tries to delete it', async () => {
    const issue = await addIssue(pair.c.token, 'Client task');

    const res = await api.delete(pair.f.token, `/api/issues/${issue.id}`);
    expect(res.status).toBe(403);
    expect(await prisma.issue.findUnique({ where: { id: issue.id } })).not.toBeNull();

    // Yaradan tərəf sonradan silə bilər
    expect((await api.delete(pair.c.token, `/api/issues/${issue.id}`)).status).toBe(200);
  });

  it('returns 404 for a task that does not exist', async () => {
    const res = await api.delete(pair.c.token, '/api/issues/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});
