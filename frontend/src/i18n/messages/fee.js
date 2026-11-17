// Frilanserə göstərilən komissiyadan sonrakı məbləğlər və "review-a göndərmə" qapısı.
export default {
    en: {
        youReceive: 'You receive',
        youReceiveAmount: 'You receive {{net}}',
        cardCaption: 'You receive · {{gross}} − {{percent}}% fee',
        breakdown: '{{gross}} − {{fee}} platform fee ({{percent}}%)',
        bidNote: 'You receive {{net}} after the {{percent}}% platform fee ({{fee}}).',
        offer: {
            title: 'Payment plan',
            total: 'You receive in total',
            due: 'Due {{date}}',
        },
        gate: {
            hint: 'Some tasks on the board are not in Done yet. Move all of them to Done before submitting for review.',
        },
    },
    az: {
        youReceive: 'Əlinizə keçən',
        youReceiveAmount: 'Əlinizə keçən: {{net}}',
        cardCaption: 'Əlinizə keçən · {{gross}} − {{percent}}% komissiya',
        breakdown: '{{gross}} − {{fee}} platforma komissiyası ({{percent}}%)',
        bidNote: 'Platforma komissiyasından ({{percent}}%, {{fee}}) sonra {{net}} alacaqsınız.',
        offer: {
            title: 'Ödəniş planı',
            total: 'Cəmi alacağınız',
            due: 'Son tarix: {{date}}',
        },
        gate: {
            hint: 'Lövhədə hələ Done olmayan tapşırıqlar var. Review-a göndərməzdən əvvəl hamısını Done sütununa keçirin.',
        },
    },
    tr: {
        youReceive: 'Eline geçen',
        youReceiveAmount: 'Eline geçen: {{net}}',
        cardCaption: 'Eline geçen · {{gross}} − %{{percent}} komisyon',
        breakdown: '{{gross}} − {{fee}} platform komisyonu (%{{percent}})',
        bidNote: 'Platform komisyonundan (%{{percent}}, {{fee}}) sonra {{net}} alacaksınız.',
        offer: {
            title: 'Ödeme planı',
            total: 'Toplam alacağınız',
            due: 'Son tarih: {{date}}',
        },
        gate: {
            hint: 'Panoda henüz Done olmayan görevler var. İncelemeye göndermeden önce hepsini Done sütununa taşıyın.',
        },
    },
};
