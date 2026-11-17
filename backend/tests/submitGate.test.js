import { prisma, cleanUpUsers } from './helpers/db.js';
import { api, pairEmails, registerPair, createContractWithMilestones } from './helpers/p2.js';
import { topUp, fundMilestone } from '../src/services/financialService.js';

// Frilanser işi review-a göndərməzdən əvvəl lövhədəki bütün tapşırıqlar Done olmalıdır
// (tapşırığı kim yaradıbsa fərqi yoxdur). Başqa mərhələyə bağlı tapşırıq təhvili saxlamır.

const PREFIX = 'submitgate';
const MAX_PAIRS = 2;
const ALL_EMAILS = Array.from({ length: MAX_PAIRS }, (_, i) => Object.values(pairEmails(PREFIX, i + 1))).flat();

describe('Submit for review needs every task in Done', () => {
  let counter = 0;

  const newPair = async () => {
    counter += 1;
    if (counter > MAX_PAIRS) throw new Error('Increase MAX_PAIRS in submitGate.test.js');
    return registerPair(PREFIX, counter);
  };

  const addIssue = async (token, contractId, title) => {
    const res = await api.post(token, `/api/contracts/${contractId}/issues`, { title });
    expect(res.status).toBe(201);
    return res.body.issue;
  };

  const move = (token, issueId, status) => api.patch(token, `/api/issues/${issueId}/move`, { status, position: 1000 });
  const submit = (token, milestoneId) => api.post(token, `/api/milestones/${milestoneId}/submit`);
  const milestoneRow = (id) => prisma.milestone.findUnique({ where: { id } });

  beforeAll(async () => {
    await cleanUpUsers(ALL_EMAILS);
  });

  afterAll(async () => {
    await cleanUpUsers(ALL_EMAILS);
  });

  it('blocks the submission until the client-created task is Done', async () => {
    const pair = await newPair();
    const contract = await createContractWithMilestones({
      clientToken: pair.c.token,
      freelancerToken: pair.f.token,
      milestones: [{ title: 'Only', amount: 50 }],
      title: 'Submit gate job',
    });
    const m = contract.milestones[0];
    await topUp(pair.c.user.id, m.amountCents);
    await fundMilestone(m.id, pair.c.user.id);

    const issue = await addIssue(pair.c.token, contract.id, 'Unfinished task');

    const blocked = await submit(pair.f.token, m.id);
    expect(blocked.status).toBe(400);
    expect(blocked.body.message).toMatch(/Done/);
    expect((await milestoneRow(m.id)).status).toBe('FUNDED');

    // IN_PROGRESS də kifayət deyil
    expect((await move(pair.f.token, issue.id, 'IN_PROGRESS')).status).toBe(200);
    expect((await submit(pair.f.token, m.id)).status).toBe(400);

    expect((await move(pair.f.token, issue.id, 'DONE')).status).toBe(200);
    const ok = await submit(pair.f.token, m.id);
    expect(ok.status).toBe(200);
    expect((await milestoneRow(m.id)).status).toBe('IN_REVIEW');
  });

  it('ignores an unfinished task that belongs to a different milestone', async () => {
    const pair = await newPair();
    const contract = await createContractWithMilestones({
      clientToken: pair.c.token,
      freelancerToken: pair.f.token,
      milestones: [
        { title: 'First', amount: 20 },
        { title: 'Second', amount: 30 },
      ],
      title: 'Submit gate two milestones',
    });
    const [first, second] = contract.milestones;
    await topUp(pair.c.user.id, first.amountCents);
    await fundMilestone(first.id, pair.c.user.id);

    const forSecond = await addIssue(pair.c.token, contract.id, 'Task of the second milestone');
    await prisma.issue.update({ where: { id: forSecond.id }, data: { milestoneId: second.id } });

    const ok = await submit(pair.f.token, first.id);
    expect(ok.status).toBe(200);
    expect((await milestoneRow(first.id)).status).toBe('IN_REVIEW');
  });
});
