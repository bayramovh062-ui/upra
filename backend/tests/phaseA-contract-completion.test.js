import { prisma, cleanUpUsers } from './helpers/db.js';
import {
  api,
  pairEmails,
  registerAdmin,
  registerPair,
  createContractWithMilestones,
} from './helpers/p2.js';
import { topUp, fundMilestone, submitMilestone } from '../src/services/financialService.js';

// Phase A (A4): a contract completes automatically as soon as its last milestone becomes terminal
// (PAID/CANCELLED), at least one milestone is PAID, no dispute is open and the contract is ACTIVE.
// The same rule must apply to dispute-resolution payments.

const PREFIX = 'phaseacmp';
const MAX_PAIRS = 4;
const ADMIN_EMAIL = `${PREFIX}_admin@upra.com`;
const ALL_EMAILS = [
  ADMIN_EMAIL,
  ...Array.from({ length: MAX_PAIRS }, (_, i) => Object.values(pairEmails(PREFIX, i + 1))).flat(),
];

describe('Phase A automatic contract completion', () => {
  let counter = 0;
  let admin;

  const newPair = async () => {
    counter += 1;
    if (counter > MAX_PAIRS) throw new Error('Increase MAX_PAIRS in phaseA-contract-completion.test.js');
    return registerPair(PREFIX, counter);
  };

  const approve = (token, milestoneId) => api.post(token, `/api/milestones/${milestoneId}/approve`);
  const complete = (token, contractId) => api.patch(token, `/api/contracts/${contractId}/complete`);
  const contractRow = (id) => prisma.contract.findUnique({ where: { id } });
  const jobRow = (id) => prisma.jobPost.findUnique({ where: { id } });

  beforeAll(async () => {
    await cleanUpUsers(ALL_EMAILS);
    admin = await registerAdmin(ADMIN_EMAIL);
  });

  afterAll(async () => {
    await cleanUpUsers(ALL_EMAILS);
  });

  it('completes the contract and the job when the final milestone is approved', async () => {
    const pair = await newPair();
    const contract = await createContractWithMilestones({
      clientToken: pair.c.token,
      freelancerToken: pair.f.token,
      milestones: [{ title: 'Final delivery', amount: 40 }],
      title: 'Auto completion job',
    });
    const milestone = contract.milestones[0];

    await topUp(pair.c.user.id, milestone.amountCents);
    await fundMilestone(milestone.id, pair.c.user.id);
    await submitMilestone(milestone.id, pair.f.user.id);

    const approved = await approve(pair.c.token, milestone.id);
    expect(approved.status).toBe(200);

    const stored = await contractRow(contract.id);
    expect(stored.status).toBe('COMPLETED');
    expect((await jobRow(stored.jobPostId)).status).toBe('COMPLETED');
    expect((await prisma.milestone.findUnique({ where: { id: milestone.id } })).status).toBe('PAID');

    const clientNotes = await prisma.notification.findMany({
      where: { userId: pair.c.user.id, type: 'CONTRACT_COMPLETED' },
    });
    const freelancerNotes = await prisma.notification.findMany({
      where: { userId: pair.f.user.id, type: 'CONTRACT_COMPLETED' },
    });
    expect(clientNotes).toHaveLength(1);
    expect(freelancerNotes).toHaveLength(1);
    expect(freelancerNotes[0].body).toMatch(/automatically/i);
    expect(freelancerNotes[0].data).toMatchObject({ contractId: contract.id, automatic: true });

    // A repeated manual completion is safe and does not complete twice.
    const repeated = await complete(pair.c.token, contract.id);
    expect(repeated.status).toBe(200);
    expect(repeated.body.contract.status).toBe('COMPLETED');
    expect(
      await prisma.notification.count({ where: { userId: pair.f.user.id, type: 'CONTRACT_COMPLETED' } })
    ).toBe(1);
  });

  it('does not complete while another milestone is still PENDING', async () => {
    const pair = await newPair();
    const contract = await createContractWithMilestones({
      clientToken: pair.c.token,
      freelancerToken: pair.f.token,
      milestones: [
        { title: 'First', amount: 20 },
        { title: 'Second', amount: 20 },
      ],
      title: 'Premature completion guard',
    });
    const [first, second] = contract.milestones;

    await topUp(pair.c.user.id, first.amountCents);
    await fundMilestone(first.id, pair.c.user.id);
    await submitMilestone(first.id, pair.f.user.id);
    expect((await approve(pair.c.token, first.id)).status).toBe(200);

    const stored = await contractRow(contract.id);
    expect(stored.status).toBe('ACTIVE');
    expect((await jobRow(stored.jobPostId)).status).not.toBe('COMPLETED');
    expect((await prisma.milestone.findUnique({ where: { id: second.id } })).status).toBe('PENDING');
    expect((await complete(pair.c.token, contract.id)).status).toBe(400);
  });

  it('completes after a RELEASE dispute resolution closes the final milestone', async () => {
    const pair = await newPair();
    const contract = await createContractWithMilestones({
      clientToken: pair.c.token,
      freelancerToken: pair.f.token,
      milestones: [
        { title: 'Done first', amount: 20 },
        { title: 'Disputed last', amount: 30 },
      ],
      title: 'Dispute completion job',
    });
    const [first, last] = contract.milestones;

    await topUp(pair.c.user.id, first.amountCents);
    await fundMilestone(first.id, pair.c.user.id);
    await submitMilestone(first.id, pair.f.user.id);
    expect((await approve(pair.c.token, first.id)).status).toBe(200);

    await topUp(pair.c.user.id, last.amountCents);
    await fundMilestone(last.id, pair.c.user.id);
    await submitMilestone(last.id, pair.f.user.id);
    const opened = await api.post(pair.c.token, `/api/milestones/${last.id}/dispute`, {
      reason: 'The final delivery does not match the agreement',
    });
    expect(opened.status).toBe(201);

    // An unresolved dispute keeps the contract open.
    expect((await contractRow(contract.id)).status).toBe('ACTIVE');
    expect((await complete(pair.c.token, contract.id)).status).toBe(400);

    const resolved = await api.patch(admin.token, `/api/admin/disputes/${opened.body.dispute.id}/resolve`, {
      resolution: 'RELEASE',
      adminNote: 'Delivery verified',
    });
    expect(resolved.status).toBe(200);
    expect(resolved.body.completedContract).toMatchObject({ id: contract.id, status: 'COMPLETED' });

    const stored = await contractRow(contract.id);
    expect(stored.status).toBe('COMPLETED');
    expect((await jobRow(stored.jobPostId)).status).toBe('COMPLETED');
    expect((await prisma.milestone.findUnique({ where: { id: last.id } })).status).toBe('PAID');
    expect(
      await prisma.notification.count({
        where: { userId: pair.f.user.id, type: 'CONTRACT_COMPLETED' },
      })
    ).toBe(1);
  });

  it('completes after a final REFUND when an earlier milestone was already PAID', async () => {
    const pair = await newPair();
    const contract = await createContractWithMilestones({
      clientToken: pair.c.token,
      freelancerToken: pair.f.token,
      milestones: [
        { title: 'Paid first', amount: 20 },
        { title: 'Refunded last', amount: 30 },
      ],
      title: 'Refund completion job',
    });
    const [first, last] = contract.milestones;

    await topUp(pair.c.user.id, first.amountCents);
    await fundMilestone(first.id, pair.c.user.id);
    await submitMilestone(first.id, pair.f.user.id);
    expect((await approve(pair.c.token, first.id)).status).toBe(200);

    await topUp(pair.c.user.id, last.amountCents);
    await fundMilestone(last.id, pair.c.user.id);
    await submitMilestone(last.id, pair.f.user.id);
    const opened = await api.post(pair.c.token, `/api/milestones/${last.id}/dispute`, {
      reason: 'The final delivery cannot be accepted',
    });
    expect(opened.status).toBe(201);

    const resolved = await api.patch(admin.token, `/api/admin/disputes/${opened.body.dispute.id}/resolve`, {
      resolution: 'REFUND',
    });
    expect(resolved.status).toBe(200);

    const stored = await contractRow(contract.id);
    expect(stored.status).toBe('COMPLETED');
    expect((await prisma.milestone.findUnique({ where: { id: last.id } })).status).toBe('CANCELLED');
    expect((await jobRow(stored.jobPostId)).status).toBe('COMPLETED');
  });
});
