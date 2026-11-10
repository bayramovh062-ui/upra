import { expect } from '@playwright/test';

// E2E köməkçiləri. Hər test öz istifadəçilərini yaradır (unikal e-poçt), ona görə bazanı əvvəlcədən təmizləmək lazım deyil.
// Selektorlar rol/etiket üzərindədir (CSS sinifləri yox), ki, dizayn dəyişəndə testlər sınmasın.

export const PASSWORD = 'Password123!';

// example.com rezerv olunmuş domendir: təsadüfən real ünvana mail getməz
const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let seq = 0;

export const uniqueEmail = (label) => {
    seq += 1;
    return `e2e-${label}-${runId}-${seq}@example.com`;
};

export const uniqueTitle = (label) => {
    seq += 1;
    return `E2E ${label} ${runId} ${seq}`;
};

// Ayrı brauzer sessiyası (ayrı localStorage): eyni testdə client və frilanser paralel işləyir
export const newSession = async (browser, baseURL, contextOptions = {}) => {
    const context = await browser.newContext({ baseURL, ...contextOptions });
    const page = await context.newPage();
    return { context, page };
};

// Eyni anda yalnız bir təsdiq pəncərəsi açıq olur: düymə pəncərənin içindən seçilir,
// çünki başlıqdakı qısayol düymələrinin adı (məs. "Approve & pay") eyni ola bilər
export const confirmInDialog = async (page, name) => {
    await page.getByRole('dialog').getByRole('button', { name }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
};

export const lastPathSegment = (url) => new URL(url).pathname.split('/').filter(Boolean).pop();

// Səhifə eninin ekrandan böyük olmaması (mobil üçün üfüqi sürüşmə problemi)
export const expectNoHorizontalScroll = async (page) => {
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, 'page must not scroll horizontally').toBeLessThanOrEqual(1);
};

// ---------- hesab ----------

export const registerViaUi = async (page, { fullName, email, role = 'CLIENT' }) => {
    await page.goto('/register');
    // Radio inputu görünməzdir (sr-only), ona görə kartın özünə klik edilir
    if (role === 'FREELANCER') {
        await page.locator('label:has(input[value="FREELANCER"])').click();
    }
    await page.getByLabel('Full name').fill(fullName);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirm password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.waitForURL(role === 'FREELANCER' ? '**/freelancer/dashboard' : '**/client/dashboard');
};

export const loginViaUi = async (page, { email, password = PASSWORD }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
};

// ---------- elan və təklif ----------

// 3 addımlı wizard-dan keçib elanı dərc edir və elanın id-sini qaytarır
export const postJobViaUi = async (page, { title, description, budget }) => {
    await page.goto('/client/jobs/new');

    // Addım 1: əsaslar
    await page.getByLabel('Job title').fill(title);
    const category = page.getByLabel('Category');
    // Kateqoriyalar API-dən gəlir: "placeholder" + ən azı bir real seçim
    await expect.poll(() => category.locator('option').count()).toBeGreaterThan(1);
    await category.selectOption({ index: 1 });
    await page.locator('label:has(input[value="MID"])').click();
    await page.getByRole('button', { name: 'Next' }).click();

    // Addım 2: təsvir və bacarıq
    await page.getByLabel('Description').fill(description);
    const skillInput = page.getByLabel('Search skills');
    await skillInput.fill('Playwright');
    await skillInput.press('Enter');
    await expect(page.getByRole('button', { name: 'Remove Playwright' })).toBeVisible();
    // Bacarıq siyahısının açılan menyusu "Next" düyməsinin üstünə düşür: Escape onu bağlayır (SkillPicker bunu dəstəkləyir)
    await skillInput.press('Escape');
    await page.getByRole('button', { name: 'Next' }).click();

    // Addım 3: büdcə
    await page.getByLabel('Total budget (USD)').fill(String(budget));
    await page.getByRole('button', { name: 'Publish job' }).click();

    // /jobs/:id (yaradılandan sonra elan səhifəsinə keçir). "/client/jobs/new" ilə qarışmasın deyə dəqiq yoxlanır
    await page.waitForURL((url) => /^\/jobs\/[^/]+$/.test(url.pathname));
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    return lastPathSegment(page.url());
};

export const sendProposalViaUi = async (page, jobId, { bid, coverLetter }) => {
    await page.goto(`/jobs/${jobId}`);
    await page.getByLabel(/Your bid/).fill(String(bid));
    // Cover letter sahəsinin görünən etiketi <label> deyil, ona görə placeholder ilə seçilir
    await page.getByPlaceholder(/Explain why you are a good fit/).fill(coverLetter);
    await page.getByRole('button', { name: 'Send proposal' }).click();
    await expect(page.getByText('Proposal submitted')).toBeVisible();
};

// ---------- escrow ----------

export const topUpViaUi = async (page, dollars) => {
    await page.getByRole('button', { name: 'Add demo funds' }).click();
    await page.getByLabel('Amount (USD)').fill(String(dollars));
    await page.getByRole('dialog').getByRole('button', { name: 'Add funds' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
};

export const fundNextMilestone = async (page) => {
    await page.getByRole('button', { name: 'Fund milestone' }).first().click();
    await confirmInDialog(page, 'Fund milestone');
    await expect(page.getByText('Funded. Waiting for the freelancer to submit.')).toBeVisible();
};

export const submitMilestone = async (page) => {
    await page.getByRole('button', { name: 'Submit milestone' }).click();
    await confirmInDialog(page, 'Submit for review');
    await expect(page.getByText('Waiting for the client to review.')).toBeVisible();
};

export const approveMilestone = async (page) => {
    // Başlıqda da, kartda da eyni düymə var: hər ikisi eyni əməliyyatı edir
    await page.getByRole('button', { name: 'Approve & pay' }).first().click();
    await confirmInDialog(page, 'Approve & pay');
};
