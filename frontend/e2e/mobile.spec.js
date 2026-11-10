import { devices, expect, test } from '@playwright/test';
import {
    expectNoHorizontalScroll,
    newSession,
    postJobViaUi,
    registerViaUi,
    sendProposalViaUi,
    uniqueEmail,
    uniqueTitle,
} from './helpers.js';

// Mobil viewport (playwright.config.js-də "mobile" layihəsi: Pixel 5, 393x851).
// Yoxlanan: üfüqi sürüşmənin olmaması, sidebar-ın hamburger menyu ilə açılıb bağlanması,
// 3 addımlı elan wizard-ı və frilanserin təklif göndərməsi.

test.describe('mobile viewport', () => {
    test('public auth pages fit the screen', async ({ page }) => {
        for (const path of ['/login', '/register', '/forgot-password']) {
            await page.goto(path);
            await expect(page.getByRole('heading').first()).toBeVisible();
            await expectNoHorizontalScroll(page);
        }
    });

    test('client navigates with the hamburger menu', async ({ page }) => {
        await registerViaUi(page, { fullName: 'E2E Mobile Client', email: uniqueEmail('mclient'), role: 'CLIENT' });
        await expectNoHorizontalScroll(page);

        const myJobsLink = page.locator('aside').getByRole('link', { name: 'My jobs' });

        // Mobildə sidebar ekrandan kənardadır
        await expect(myJobsLink).not.toBeInViewport();

        await page.getByRole('button', { name: 'Open menu' }).click();
        await expect(myJobsLink).toBeInViewport();

        await myJobsLink.click();
        await expect(page).toHaveURL(/\/client\/jobs$/);
        // Keçiddən sonra sidebar bağlanır
        await expect(myJobsLink).not.toBeInViewport();
        await expectNoHorizontalScroll(page);
    });

    test('client posts a job and a freelancer sends a proposal from a phone', async ({ browser, baseURL }) => {
        test.setTimeout(120_000);

        const jobTitle = uniqueTitle('Mobile job');
        const clientSession = await newSession(browser, baseURL, devices['Pixel 5']);
        const freelancerSession = await newSession(browser, baseURL, devices['Pixel 5']);
        const clientPage = clientSession.page;
        const freelancerPage = freelancerSession.page;

        try {
            await registerViaUi(clientPage, {
                fullName: 'E2E Phone Client',
                email: uniqueEmail('pclient'),
                role: 'CLIENT',
            });
            await registerViaUi(freelancerPage, {
                fullName: 'E2E Phone Freelancer',
                email: uniqueEmail('pfreelancer'),
                role: 'FREELANCER',
            });

            // Wizard bütün addımlarında ekrana sığır (hər addımda üfüqi sürüşmə yoxdur)
            await clientPage.goto('/client/jobs/new');
            await expectNoHorizontalScroll(clientPage);

            const jobId = await postJobViaUi(clientPage, {
                title: jobTitle,
                description: 'Mobile flow: build a small landing page with a contact form.',
                budget: 300,
            });
            await expectNoHorizontalScroll(clientPage);

            // Frilanser: siyahıdan elanı tapır, detal səhifəsində təklif göndərir
            await freelancerPage.goto('/jobs');
            await freelancerPage.getByPlaceholder('Search by title, description or skill...').fill(jobTitle);
            await expect(freelancerPage.getByRole('link', { name: jobTitle }).first()).toBeVisible();
            await expectNoHorizontalScroll(freelancerPage);

            await sendProposalViaUi(freelancerPage, jobId, {
                bid: 250,
                coverLetter: 'I can build this landing page quickly and keep it fully responsive.',
            });
            await expectNoHorizontalScroll(freelancerPage);

            // Client mobildə təklifi görür
            await clientPage.goto(`/client/jobs/${jobId}/proposals`);
            await expect(clientPage.getByText('E2E Phone Freelancer').first()).toBeVisible();
            await expect(clientPage.getByRole('button', { name: 'Send contract offer' })).toBeVisible();
            await expectNoHorizontalScroll(clientPage);
        } finally {
            await clientSession.context.close();
            await freelancerSession.context.close();
        }
    });
});
