// POST /api/contracts sorğusunun gövdəsini qurur.
//
// `milestones` — MilestonePlanModal-da seçilən plan:
//   [{ title, amount (USD, number), dueDate? ("YYYY-MM-DD") }]
// Verilməzsə mövcud "bir ödəniş" axını qalır: backend təklifin tam məbləği üçün
// tək "Full delivery" mərhələsi yaradır.
//
// Burada məbləğ çevrilməsi və ya cəm yoxlaması YOXDUR: modal artıq planın cəminin
// təklifə bərabər olmasını yoxlayır, son qərar isə backend-dədir (sentə çevirmə,
// ardıcıllıq, tarix və cəm yoxlaması).
export const buildCreateContractBody = ({ proposalId, milestones } = {}) => {
    const body = { proposalId };

    if (Array.isArray(milestones)) {
        body.milestones = milestones.map((m) => ({
            title: m.title,
            amount: m.amount,
            // Boş tarix göndərilmir: z.coerce.date() null-u 1970-01-01 kimi qəbul edərdi
            ...(m.dueDate ? { dueDate: m.dueDate } : {}),
        }));
    }

    return body;
};
