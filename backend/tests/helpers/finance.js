import prisma from '../../src/config/db.js';

// Ledger bütövlüyü: hər pul kisəsi və hər balanceType üçün (CREDIT cəmi - DEBIT cəmi) balansa bərabər olmalıdır.
// Ledger yazıları dəyişməzdir, ona görə uyğunsuzluq həmişə kodda (və ya birbaşa balans dəyişdirilməsində) səhv deməkdir.
export const ledgerBalances = async (walletId) => {
    const rows = await prisma.transaction.findMany({ where: { walletId } });
    const totals = { AVAILABLE: 0, LOCKED: 0 };

    for (const row of rows) {
        totals[row.balanceType] += row.direction === 'CREDIT' ? row.amountCents : -row.amountCents;
    }
    return totals;
};

// userId ilə çağırılır. Uyğunsuzluq varsa expect xəta atır. Hesablanmış ledger balansını qaytarır.
export const reconcileWallet = async (userId) => {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    expect(wallet).not.toBeNull();

    const totals = await ledgerBalances(wallet.id);
    expect({ walletId: wallet.id, availableCents: wallet.availableCents, lockedCents: wallet.lockedCents }).toEqual({
        walletId: wallet.id,
        availableCents: totals.AVAILABLE,
        lockedCents: totals.LOCKED,
    });
    return totals;
};

export const getWalletRow = (userId) => prisma.wallet.findUnique({ where: { userId } });
