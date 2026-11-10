import { expect, test } from '@playwright/test';
import { PASSWORD, loginViaUi, registerViaUi, uniqueEmail } from './helpers.js';

// Giriş, çıxış, rol qoruması və "Demo / test pulu" etiketləri.

test.describe('authentication and guards', () => {
    test('a guest is sent to the login page from protected pages', async ({ page }) => {
        await page.goto('/contracts');
        await expect(page).toHaveURL(/\/login$/);

        await page.goto('/client/jobs/new');
        await expect(page).toHaveURL(/\/login$/);
    });

    test('the register page shows the demo notice and checks the password confirmation', async ({ page }) => {
        await page.goto('/register');
        await expect(page.getByText(/Upra is a demo project/)).toBeVisible();

        await page.getByLabel('Full name').fill('Mismatch User');
        await page.getByLabel('Email').fill(uniqueEmail('mismatch'));
        await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
        await page.getByLabel('Confirm password').fill('Different123!');
        await page.getByRole('button', { name: 'Create account' }).click();

        await expect(page.getByText('Passwords do not match')).toBeVisible();
        await expect(page).toHaveURL(/\/register$/);
    });

    test('logout clears the session, a wrong password is refused, the right one signs in', async ({ page }) => {
        const user = { fullName: 'E2E Login User', email: uniqueEmail('login'), role: 'CLIENT' };
        await registerViaUi(page, user);

        // Çıxış: yuxarıdakı istifadəçi menyusu -> "Log out"
        await page.getByRole('button', { name: new RegExp(user.fullName) }).click();
        await page.getByRole('button', { name: 'Log out' }).click();
        await expect(page).toHaveURL(/\/login$/);
        expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();

        // Çıxışdan sonra qorunan səhifə açılmır
        await page.goto('/contracts');
        await expect(page).toHaveURL(/\/login$/);

        // Səhv parol: səhifədə qalır, token yazılmır
        await loginViaUi(page, { email: user.email, password: 'WrongPassword1!' });
        await expect(page).toHaveURL(/\/login$/);
        expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();

        // Düzgün parol: dashboard
        await loginViaUi(page, { email: user.email });
        await page.waitForURL('**/client/dashboard');
        expect(await page.evaluate(() => localStorage.getItem('token'))).toBeTruthy();
    });

    test('a client cannot open freelancer pages and a logged-in user skips the login page', async ({ page }) => {
        await registerViaUi(page, { fullName: 'E2E Role Guard', email: uniqueEmail('guard'), role: 'CLIENT' });

        // Rolu uyğun gəlməyən istifadəçi öz dashboard-una qayıdır
        await page.goto('/freelancer/proposals');
        await expect(page).toHaveURL(/\/client\/dashboard$/);

        // Giriş etmiş istifadəçi /login-ə düşmür
        await page.goto('/login');
        await expect(page).toHaveURL(/\/client\/dashboard$/);
    });

    test('the demo label is always visible after sign in', async ({ page }) => {
        await registerViaUi(page, { fullName: 'E2E Demo Label', email: uniqueEmail('demo'), role: 'FREELANCER' });
        await expect(page.getByText('Demo · test money')).toBeVisible();
    });
});
