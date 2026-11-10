import { expect, test } from '@playwright/test';
import {
    approveMilestone,
    fundNextMilestone,
    lastPathSegment,
    newSession,
    postJobViaUi,
    registerViaUi,
    sendProposalViaUi,
    submitMilestone,
    topUpViaUi,
    uniqueEmail,
    uniqueTitle,
} from './helpers.js';

// Əsas axın: client elan yazır -> frilanser təklif göndərir -> client müqavilə təklifi göndərir (2 mərhələ)
// -> frilanser qəbul edir -> client pul əlavə edir, mərhələləri ardıcıl maliyyələşdirir -> frilanser təhvil verir
// -> client təsdiqləyir (10% komissiya) -> son mərhələdən sonra müqavilə avtomatik COMPLETED olur -> rəylər.
//
// Bu, backend testlərindəki qaydaların (ardıcıl maliyyələşdirmə, "hamısı ödənilmədən bitmir", avtomatik complete)
// UI səviyyəsində sınağıdır. Bütün pullar simulyasiyadır.

test('client and freelancer complete a two-milestone contract end to end', async ({ browser, baseURL }) => {
    // Çoxlu addım və iki sessiya var: standart 60 san. kifayət etməyə bilər
    test.setTimeout(180_000);

    const client = { fullName: 'E2E Client', email: uniqueEmail('client') };
    const freelancer = { fullName: 'E2E Freelancer', email: uniqueEmail('freelancer') };
    const jobTitle = uniqueTitle('REST API job');

    const clientSession = await newSession(browser, baseURL);
    const freelancerSession = await newSession(browser, baseURL);
    const clientPage = clientSession.page;
    const freelancerPage = freelancerSession.page;

    try {
        let jobId;
        let contractId;

        await test.step('both users register', async () => {
            await registerViaUi(clientPage, { ...client, role: 'CLIENT' });
            await registerViaUi(freelancerPage, { ...freelancer, role: 'FREELANCER' });

            // Phase B: demo etiketi giriş edən hər istifadəçidə görünür
            await expect(clientPage.getByText('Demo · test money')).toBeVisible();
        });

        await test.step('client publishes a job', async () => {
            jobId = await postJobViaUi(clientPage, {
                title: jobTitle,
                description: 'Build a small REST API with authentication, tests and documentation.',
                budget: 600,
            });
            await expect(clientPage.getByText('Manage this job')).toBeVisible();
        });

        await test.step('freelancer finds the job by search and sends a proposal', async () => {
            await freelancerPage.goto('/jobs');
            await freelancerPage.getByPlaceholder('Search by title, description or skill...').fill(jobTitle);
            const card = freelancerPage.getByRole('link', { name: jobTitle }).first();
            await expect(card).toBeVisible();
            await card.click();
            await expect(freelancerPage).toHaveURL(new RegExp(`/jobs/${jobId}$`));

            await sendProposalViaUi(freelancerPage, jobId, {
                bid: 500,
                coverLetter: 'I have built several similar APIs and can deliver this in two clear stages.',
            });
        });

        await test.step('client sends a contract offer split into two milestones', async () => {
            await clientPage.goto(`/client/jobs/${jobId}/proposals`);
            await expect(clientPage.getByText(freelancer.fullName).first()).toBeVisible();
            await clientPage.getByRole('button', { name: 'Send contract offer' }).click();

            // Plan: 500 = 250 + 250 (pəncərə avtomatik iki bərabər mərhələ təklif edir)
            await clientPage.getByRole('button', { name: 'Split into milestones' }).click();
            await expect(clientPage.getByText(/matches the bid/)).toBeVisible();
            await clientPage.getByRole('dialog').getByRole('button', { name: 'Send offer' }).click();
            await expect(clientPage.getByRole('dialog')).toBeHidden();
        });

        await test.step('freelancer accepts the offer', async () => {
            await freelancerPage.goto('/contracts');
            await freelancerPage.getByRole('button', { name: /^Offers/ }).click();
            await freelancerPage.getByRole('link', { name: 'Review offer' }).click();
            await expect(freelancerPage.getByText('Contract offer pending')).toBeVisible();
            contractId = lastPathSegment(freelancerPage.url());

            await freelancerPage.getByRole('button', { name: 'Accept offer' }).click();
            await freelancerPage.getByRole('dialog').getByRole('button', { name: 'Accept offer' }).click();
            await expect(freelancerPage.getByText('Contract offer pending')).toBeHidden();
        });

        const escrowUrl = () => `/contracts/${contractId}?tab=escrow`;

        await test.step('client tops up the demo wallet', async () => {
            await clientPage.goto(escrowUrl());
            await expect(clientPage.getByText('Demo: all money here is simulated')).toBeVisible();
            await topUpViaUi(clientPage, 600);
            await expect(clientPage.getByText(/Wallet balance:/)).toContainText('$600.00');
        });

        // ---- 1-ci mərhələ ----
        await test.step('milestone 1: fund, submit, approve', async () => {
            await clientPage.goto(escrowUrl());
            // Ardıcıllıq qaydası: 2-ci mərhələ üçün "Fund" düyməsi yoxdur, əvvəlcə 1-ci ödənilməlidir
            await expect(clientPage.getByText('Pay the earlier milestones first.')).toBeVisible();
            await fundNextMilestone(clientPage);

            await freelancerPage.goto(escrowUrl());
            await submitMilestone(freelancerPage);

            await clientPage.goto(escrowUrl());
            await approveMilestone(clientPage);
            await expect(clientPage.getByText(/Paid \$250\.00 to the freelancer\./)).toHaveCount(1);
        });

        await test.step('contract cannot be completed while a milestone is unpaid', async () => {
            await clientPage.reload();
            await expect(clientPage.getByRole('button', { name: 'Complete contract' })).toBeDisabled();
            await expect(clientPage.getByText(/1 of 2 paid so far/)).toBeVisible();
        });

        // ---- 2-ci (son) mərhələ ----
        await test.step('milestone 2: fund, submit, approve', async () => {
            await fundNextMilestone(clientPage);

            await freelancerPage.goto(escrowUrl());
            await submitMilestone(freelancerPage);

            await clientPage.goto(escrowUrl());
            await approveMilestone(clientPage);
            await expect(clientPage.getByText(/Paid \$250\.00 to the freelancer\./)).toHaveCount(2);
        });

        await test.step('freelancer received the payout minus the 10% platform fee', async () => {
            await freelancerPage.goto(escrowUrl());
            await expect(
                freelancerPage.getByText('You received $225.00 (platform fee $25.00).')
            ).toHaveCount(2);
        });

        await test.step('the contract completed automatically after the last milestone', async () => {
            await clientPage.goto(`/contracts/${contractId}`);
            await expect(clientPage.getByRole('heading', { name: 'Reviews' })).toBeVisible();
            // Artıq "Complete contract" düyməsi yoxdur: müqavilə özü bağlanıb
            await expect(clientPage.getByRole('button', { name: 'Complete contract' })).toHaveCount(0);
            await expect(clientPage.getByText('No reviews yet for this contract.')).toBeVisible();
        });

        await test.step('client reviews the freelancer', async () => {
            await clientPage.getByRole('button', { name: `Review ${freelancer.fullName}` }).click();
            await clientPage.getByRole('radio', { name: '5 stars' }).click();
            await clientPage.getByLabel('Comment (optional)').fill('Great collaboration, delivered on time.');
            await clientPage.getByRole('dialog').getByRole('button', { name: 'Submit review' }).click();
            await expect(clientPage.getByRole('dialog')).toBeHidden();
            await expect(clientPage.getByText('Great collaboration, delivered on time.')).toBeVisible();
        });

        await test.step('freelancer sees the review and can review back', async () => {
            await freelancerPage.goto(`/contracts/${contractId}`);
            await expect(freelancerPage.getByText(/reviewed you/)).toBeVisible();
            await expect(freelancerPage.getByRole('button', { name: `Review ${client.fullName}` })).toBeVisible();
        });
    } finally {
        await clientSession.context.close();
        await freelancerSession.context.close();
    }
});
