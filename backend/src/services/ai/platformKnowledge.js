import { AUTO_APPROVE_DAYS, COMMISSION_PERCENT, MAX_TOPUP_CENTS } from '../financialService.js';

// Platforma qaydaları (AI təlimatına qoyulur). Rəqəmlər KODDAN götürülür: sənədlə kod uyğun gəlməsə kod qalib gəlir.
// Yeni qayda əlavə edəndə yalnız burada yazın; koddakı sabitlər dəyişəndə mətn avtomatik yenilənir.

const DEFAULT_MAX_REVISIONS = 2; // schema.prisma: Milestone.maxRevisions defoltu
const MAX_TOPUP_DOLLARS = MAX_TOPUP_CENTS / 100;

export const PLATFORM_KNOWLEDGE = `
UPRA PLATFORM RULES (source of truth; do not invent other rules)

What Upra is
- A freelance marketplace with a built-in project board. Clients post jobs, freelancers send proposals, a client sends a contract offer, the freelancer accepts it and the contract becomes ACTIVE. A Kanban board (To do, In progress, Done) is created for the contract.
- It is a demo project. ALL money (balances, escrow, payments, withdrawals) is simulated test money; no real payment is made.
- Roles: CLIENT (hires), FREELANCER (works), ADMIN (moderation and dispute resolution).

Contracts and milestones
- Every contract has one or more milestones. A milestone is both a payment stage and a work stage.
- Milestone status flow: PENDING (not funded) -> FUNDED (client moved the money into escrow) -> IN_REVIEW (freelancer submitted the work) -> PAID (client approved, or auto-approved, or an admin released it).
- A client can fund a milestone only when all earlier milestones are PAID, and only if the wallet has enough available balance.
- On the project board, work is locked (cards stay in To do) until at least one milestone is funded.
- A client in review can approve (pays the freelancer) or request changes (milestone goes back to FUNDED, money stays in escrow). Each milestone allows a limited number of revision requests (default ${DEFAULT_MAX_REVISIONS}). After the limit, the client can only approve or open a dispute.
- Auto-approval: if a submitted milestone stays IN_REVIEW for ${AUTO_APPROVE_DAYS} full days, it is approved automatically. A DISPUTED milestone is never auto-approved.
- When every milestone is PAID (cancelled ones do not count, at least one must be paid), the contract is completed. After completion both sides can leave one review for the other party.

Money
- Wallet has two balances: available (can fund milestones or be withdrawn) and locked (held in escrow for funded milestones; cannot be withdrawn).
- Clients add demo funds (up to $${MAX_TOPUP_DOLLARS} per request). Anyone can withdraw available demo money.
- Platform commission is ${COMMISSION_PERCENT}% of the amount released to the freelancer, deducted from the freelancer's payout. Refunds to the client have no commission.
- Amounts in tools are in cents (2550 = $25.50). Always show dollars to the user.

Cancellation
- Before work has started, either side can cancel an active contract directly.
- After work has started, a cancellation must be requested with a reason and the other side must agree; they can decline, and the requester can withdraw the request.
- On cancellation, money held in escrow is refunded to the client. Already PAID milestones stay paid.
- A contract with an open dispute cannot be cancelled until the dispute is resolved.

Disputes
- Either party can open a dispute on a FUNDED or IN_REVIEW milestone, with a reason and details; both can add evidence files.
- While a dispute is open the escrowed money is frozen: submit, approve, request changes and auto-approval are paused.
- Only an admin resolves a dispute: RELEASE (everything to the freelancer, commission applies), REFUND (everything back to the client, no commission) or SPLIT (a chosen release and refund that add up to the escrowed amount; commission applies to the released part only).

Accounts
- In production, a user must verify their email before posting jobs or sending proposals.
- Users can make their profile private; then others see only name and role.
`.trim();
