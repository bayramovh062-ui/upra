// Notifications. The backend stores English templates; the frontend rebuilds them from
// the notification type and the dynamic values extracted from the original text.
export default {
    en: {
        unread: 'Unread',
        milestoneLabel: 'milestone {{number}} "{{title}}" of "{{job}}"',
        ui: {
            bellAria: 'Notifications',
            bellAriaUnread: 'Notifications, {{count}} unread',
            title: 'Notifications',
            markAll: 'Mark all as read',
            loadError: 'Could not load notifications.',
            retry: 'Try again',
            caughtUp: 'You are all caught up',
            caughtUpText: 'New proposals, offers and payments will show up here.',
            viewAll: 'View all notifications',
            pageDescription: 'Proposals, contract offers, milestones and payments, newest first.',
            tabAll: 'All',
            tabUnread: 'Unread',
            emptyUnreadTitle: 'No unread notifications',
            emptyUnreadText: 'You have read everything.',
            emptyTitle: 'No notifications yet',
            emptyText: 'When something happens on your jobs, proposals or contracts, it will appear here.',
            showingRecent: 'Showing your {{count}} most recent notifications.',
        },
        title: {
            proposalReceived: 'New proposal received',
            contractOffered: 'New contract offer',
            contractAccepted: 'Contract offer accepted',
            contractDeclined: 'Contract offer declined',
            contractCompleted: 'Contract completed',
            contractCancelled: 'Contract cancelled',
            cancellationAccepted: 'Cancellation accepted',
            cancellationRequested: 'Cancellation requested',
            cancellationDeclined: 'Cancellation declined',
            cancellationWithdrawn: 'Cancellation request withdrawn',
            milestoneFunded: 'Milestone funded',
            milestoneSubmitted: 'Milestone submitted for review',
            changesRequested: 'Changes requested',
            milestonePaid: 'Milestone approved and paid',
            milestoneAutoApproved: 'Milestone approved automatically',
            issueAssigned: 'Task assigned to you',
            commentAdded: 'New comment on a task',
            disputeOpened: 'Dispute opened',
            disputeNeedsReview: 'Dispute needs review',
            disputeResolved: 'Dispute resolved',
            reviewReceived: 'You received a new review',
            reportReviewed: 'Your report was reviewed',
            reportClosed: 'Your report was closed',
            accountSuspended: 'Your account has been suspended',
            accountReinstated: 'Your account has been reinstated',
            default: 'Notification',
        },
        body: {
            proposalReceived: '{{name}} sent a proposal for "{{job}}".',
            contractOffered: '{{name}} offered you a contract for "{{job}}". Review and accept it to start.',
            contractAccepted:
                '{{name}} accepted your offer for "{{job}}". Fund the first milestone to start the work.',
            contractDeclined: '{{name}} declined your offer for "{{job}}". The job is open again.',
            contractCompletedActor: '{{name}} marked "{{job}}" as completed. All milestones are paid.',
            contractCompleted: '"{{job}}" was marked as completed. All milestones are paid.',
            contractCompletedAuto:
                'All milestones for "{{job}}" are paid. The contract was completed automatically.',
            contractCancelled:
                '{{name}} cancelled "{{job}}" before the work started. Any escrowed money was refunded.',
            cancellationAccepted:
                '{{name}} agreed to cancel "{{job}}". Escrowed money was refunded to the client.',
            cancellationRequested: '{{name}} asked to cancel "{{job}}".{{reason}} Your answer is needed.',
            cancellationRequestedReason: ' Reason: {{reason}}',
            cancellationDeclined: '{{name}} declined to cancel "{{job}}". The contract continues.',
            cancellationWithdrawn:
                '{{name}} withdrew the cancellation request for "{{job}}". The contract continues.',
            milestoneFunded: '{{amount}} is now in escrow for {{milestone}}. You can start working.',
            milestoneSubmitted:
                'The freelancer submitted {{milestone}}. Approve it, or request changes. It is approved automatically after {{days}} days.',
            changesRequested:
                'The client asked for changes on {{milestone}}. The money stays in escrow; submit again when ready.{{reason}}',
            changesRequestedReason: ' Reason: {{reason}}',
            milestonePaid:
                '{{net}} was added to your wallet for {{milestone}} ({{gross}} minus {{fee}} platform fee).',
            milestoneAutoApprovedClient:
                '{{milestone}} was in review for {{days}} days and was approved automatically. {{gross}} was released from escrow.',
            issueAssigned: '{{name}} assigned you "{{title}}".',
            commentAdded: '{{name}} commented on "{{title}}": {{excerpt}}',
            disputeOpened:
                'A dispute was opened on {{milestone}}. Escrowed money is frozen until an admin resolves it.',
            disputeNeedsReview: '{{milestone}} is disputed: {{reason}}',
            disputeResolved:
                'An admin resolved the dispute on milestone {{number}} "{{title}}": {{release}} released to the freelancer and {{refund}} refunded to the client.',
            reviewReceived: '{{name}} left you a {{rating}}-star review for "{{job}}".',
            reportReviewed:
                'An administrator reviewed your report. It may be updated again if more action is needed.',
            reportClosed:
                'An administrator closed your report. Thank you for helping keep the marketplace safe.',
            accountSuspended:
                'An administrator suspended your account. Contact support if you believe this is a mistake.',
            accountSuspendedReason:
                'An administrator suspended your account: {{reason}} Contact support if you believe this is a mistake.',
            accountReinstated:
                'Your account is active again. You can sign in and continue using the marketplace.',
        },
    },
    az: {
        unread: 'Oxunmamış',
        milestoneLabel: '«{{job}}» müqaviləsinin {{number}}-ci mərhələsi «{{title}}»',
        ui: {
            bellAria: 'Bildirişlər',
            bellAriaUnread: 'Bildirişlər, {{count}} oxunmamış',
            title: 'Bildirişlər',
            markAll: 'Hamısını oxunmuş kimi işarələ',
            loadError: 'Bildirişləri yükləmək mümkün olmadı.',
            retry: 'Yenidən cəhd et',
            caughtUp: 'Hər şeyi oxumusunuz',
            caughtUpText: 'Yeni təkliflər, müqavilə təklifləri və ödənişlər burada görünəcək.',
            viewAll: 'Bütün bildirişlərə bax',
            pageDescription: 'Təkliflər, müqavilə təklifləri, mərhələlər və ödənişlər, ən yenisi əvvəldə.',
            tabAll: 'Hamısı',
            tabUnread: 'Oxunmamış',
            emptyUnreadTitle: 'Oxunmamış bildiriş yoxdur',
            emptyUnreadText: 'Hər şeyi oxumusunuz.',
            emptyTitle: 'Hələ bildiriş yoxdur',
            emptyText: 'Elanlarınızda, təkliflərinizdə və ya müqavilələrinizdə bir şey baş verdikdə burada görünəcək.',
            showingRecent: 'Ən son {{count}} bildirişiniz göstərilir.',
        },
        title: {
            proposalReceived: 'Yeni təklif gəldi',
            contractOffered: 'Yeni müqavilə təklifi',
            contractAccepted: 'Müqavilə təklifi qəbul edildi',
            contractDeclined: 'Müqavilə təklifindən imtina edildi',
            contractCompleted: 'Müqavilə tamamlandı',
            contractCancelled: 'Müqavilə ləğv edildi',
            cancellationAccepted: 'Ləğv tələbi qəbul edildi',
            cancellationRequested: 'Ləğv tələbi göndərildi',
            cancellationDeclined: 'Ləğv tələbindən imtina edildi',
            cancellationWithdrawn: 'Ləğv tələbi geri götürüldü',
            milestoneFunded: 'Mərhələ maliyyələşdirildi',
            milestoneSubmitted: 'Mərhələ yoxlamaya göndərildi',
            changesRequested: 'Düzəliş tələb edildi',
            milestonePaid: 'Mərhələ təsdiqləndi və ödənildi',
            milestoneAutoApproved: 'Mərhələ avtomatik təsdiqləndi',
            issueAssigned: 'Sizə tapşırıq təyin edildi',
            commentAdded: 'Tapşırığa yeni şərh',
            disputeOpened: 'Mübahisə açıldı',
            disputeNeedsReview: 'Mübahisə yoxlanılmalıdır',
            disputeResolved: 'Mübahisə həll edildi',
            reviewReceived: 'Yeni rəy aldınız',
            reportReviewed: 'Şikayətiniz nəzərdən keçirildi',
            reportClosed: 'Şikayətiniz bağlandı',
            accountSuspended: 'Hesabınız dayandırıldı',
            accountReinstated: 'Hesabınız bərpa edildi',
            default: 'Bildiriş',
        },
        body: {
            proposalReceived: '{{name}} «{{job}}» elanı üçün təklif göndərdi.',
            contractOffered:
                '{{name}} sizə «{{job}}» üzrə müqavilə təklif etdi. İşə başlamaq üçün onu nəzərdən keçirin və qəbul edin.',
            contractAccepted:
                '{{name}} «{{job}}» üçün təklifinizi qəbul etdi. İşə başlamaq üçün ilk mərhələni maliyyələşdirin.',
            contractDeclined:
                '{{name}} «{{job}}» üçün təklifinizdən imtina etdi. Elan yenidən açıqdır.',
            contractCompletedActor:
                '{{name}} «{{job}}» müqaviləsini tamamlanmış kimi işarələdi. Bütün mərhələlər ödənilib.',
            contractCompleted: '«{{job}}» tamamlanmış kimi işarələndi. Bütün mərhələlər ödənilib.',
            contractCompletedAuto:
                '«{{job}}» üzrə bütün mərhələlər ödənilib. Müqavilə avtomatik tamamlandı.',
            contractCancelled:
                '{{name}} iş başlamazdan əvvəl «{{job}}» müqaviləsini ləğv etdi. Eskroudakı pul qaytarıldı.',
            cancellationAccepted:
                '{{name}} «{{job}}» müqaviləsinin ləğvinə razılaşdı. Eskroudakı pul müştəriyə qaytarıldı.',
            cancellationRequested:
                '{{name}} «{{job}}» müqaviləsini ləğv etmək istədi.{{reason}} Cavabınız lazımdır.',
            cancellationRequestedReason: ' Səbəb: {{reason}}',
            cancellationDeclined:
                '{{name}} «{{job}}» müqaviləsini ləğv etməkdən imtina etdi. Müqavilə davam edir.',
            cancellationWithdrawn:
                '{{name}} «{{job}}» üçün ləğv tələbini geri götürdü. Müqavilə davam edir.',
            milestoneFunded:
                '{{amount}} {{milestone}} üçün eskrouya keçdi. İşə başlaya bilərsiniz.',
            milestoneSubmitted:
                'Frilanser {{milestone}} mərhələsini təhvil verdi. Onu təsdiqləyin və ya düzəliş tələb edin. {{days}} gündən sonra avtomatik təsdiqlənəcək.',
            changesRequested:
                'Müştəri {{milestone}} mərhələsi üzrə düzəliş tələb etdi. Pul eskrouda qalır; hazır olduqda yenidən təhvil verin.{{reason}}',
            changesRequestedReason: ' Səbəb: {{reason}}',
            milestonePaid:
                '{{milestone}} üçün pul kisənizə {{net}} əlavə edildi ({{gross}} çıxılmaqla {{fee}} platforma haqqı).',
            milestoneAutoApprovedClient:
                '{{milestone}} {{days}} gün yoxlamada qaldı və avtomatik təsdiqləndi. Eskroudan {{gross}} ödənildi.',
            issueAssigned: '{{name}} sizə «{{title}}» tapşırığını təyin etdi.',
            commentAdded: '{{name}} «{{title}}» tapşırığına şərh yazdı: {{excerpt}}',
            disputeOpened:
                '{{milestone}} üzrə mübahisə açıldı. Admin onu həll edənə qədər eskroudakı pul dondurulub.',
            disputeNeedsReview: '{{milestone}} mübahisəlidir: {{reason}}',
            disputeResolved:
                'Admin {{number}}-ci mərhələ «{{title}}» üzrə mübahisəni həll etdi: frilanserə {{release}}, müştəriyə {{refund}} qaytarıldı.',
            reviewReceived: '{{name}} «{{job}}» üçün sizə {{rating}} ulduzlu rəy yazdı.',
            reportReviewed:
                'Admin şikayətinizi nəzərdən keçirdi. Əlavə tədbir lazım olarsa, yenidən yenilənə bilər.',
            reportClosed:
                'Admin şikayətinizi bağladı. Bazarı təhlükəsiz saxlamağa kömək etdiyiniz üçün təşəkkür edirik.',
            accountSuspended:
                'Admin hesabınızı dayandırdı. Bunun səhv olduğunu düşünürsünüzsə, dəstəklə əlaqə saxlayın.',
            accountSuspendedReason:
                'Admin hesabınızı dayandırdı: {{reason}} Bunun səhv olduğunu düşünürsünüzsə, dəstəklə əlaqə saxlayın.',
            accountReinstated:
                'Hesabınız yenidən aktivdir. Daxil olub bazardan istifadə etməyə davam edə bilərsiniz.',
        },
    },
    tr: {
        unread: 'Okunmamış',
        milestoneLabel: '"{{job}}" sözleşmesinin {{number}}. aşaması "{{title}}"',
        ui: {
            bellAria: 'Bildirimler',
            bellAriaUnread: 'Bildirimler, {{count}} okunmamış',
            title: 'Bildirimler',
            markAll: 'Tümünü okundu olarak işaretle',
            loadError: 'Bildirimler yüklenemedi.',
            retry: 'Tekrar dene',
            caughtUp: 'Her şeyi okudunuz',
            caughtUpText: 'Yeni teklifler, sözleşme teklifleri ve ödemeler burada görünecek.',
            viewAll: 'Tüm bildirimleri gör',
            pageDescription: 'Teklifler, sözleşme teklifleri, aşamalar ve ödemeler, en yenisi önce.',
            tabAll: 'Tümü',
            tabUnread: 'Okunmamış',
            emptyUnreadTitle: 'Okunmamış bildirim yok',
            emptyUnreadText: 'Her şeyi okudunuz.',
            emptyTitle: 'Henüz bildirim yok',
            emptyText: 'İlanlarınızda, tekliflerinizde veya sözleşmelerinizde bir şey olduğunda burada görünecek.',
            showingRecent: 'En son {{count}} bildiriminiz gösteriliyor.',
        },
        title: {
            proposalReceived: 'Yeni teklif alındı',
            contractOffered: 'Yeni sözleşme teklifi',
            contractAccepted: 'Sözleşme teklifi kabul edildi',
            contractDeclined: 'Sözleşme teklifi reddedildi',
            contractCompleted: 'Sözleşme tamamlandı',
            contractCancelled: 'Sözleşme iptal edildi',
            cancellationAccepted: 'İptal talebi kabul edildi',
            cancellationRequested: 'İptal talep edildi',
            cancellationDeclined: 'İptal talebi reddedildi',
            cancellationWithdrawn: 'İptal talebi geri çekildi',
            milestoneFunded: 'Aşama fonlandı',
            milestoneSubmitted: 'Aşama incelemeye gönderildi',
            changesRequested: 'Değişiklik istendi',
            milestonePaid: 'Aşama onaylandı ve ödendi',
            milestoneAutoApproved: 'Aşama otomatik onaylandı',
            issueAssigned: 'Size görev atandı',
            commentAdded: 'Bir göreve yeni yorum',
            disputeOpened: 'İhtilaf açıldı',
            disputeNeedsReview: 'İhtilaf incelenmeli',
            disputeResolved: 'İhtilaf çözüldü',
            reviewReceived: 'Yeni bir değerlendirme aldınız',
            reportReviewed: 'Şikayetiniz incelendi',
            reportClosed: 'Şikayetiniz kapatıldı',
            accountSuspended: 'Hesabınız askıya alındı',
            accountReinstated: 'Hesabınız yeniden etkinleştirildi',
            default: 'Bildirim',
        },
        body: {
            proposalReceived: '{{name}}, "{{job}}" ilanı için bir teklif gönderdi.',
            contractOffered:
                '{{name}} size "{{job}}" için bir sözleşme teklif etti. İnceleyip kabul ederek başlayın.',
            contractAccepted:
                '{{name}}, "{{job}}" için teklifinizi kabul etti. Çalışmaya başlamak için ilk aşamayı fonlayın.',
            contractDeclined:
                '{{name}}, "{{job}}" için teklifinizi reddetti. İlan yeniden açık.',
            contractCompletedActor:
                '{{name}}, "{{job}}" sözleşmesini tamamlandı olarak işaretledi. Tüm aşamalar ödendi.',
            contractCompleted:
                '"{{job}}" tamamlandı olarak işaretlendi. Tüm aşamalar ödendi.',
            contractCompletedAuto:
                '"{{job}}" için tüm aşamalar ödendi. Sözleşme otomatik olarak tamamlandı.',
            contractCancelled:
                '{{name}}, çalışma başlamadan önce "{{job}}" sözleşmesini iptal etti. Emanetteki para iade edildi.',
            cancellationAccepted:
                '{{name}}, "{{job}}" sözleşmesinin iptalini kabul etti. Emanetteki para müşteriye iade edildi.',
            cancellationRequested:
                '{{name}}, "{{job}}" sözleşmesini iptal etmek istedi.{{reason}} Yanıtınız gerekli.',
            cancellationRequestedReason: ' Neden: {{reason}}',
            cancellationDeclined:
                '{{name}}, "{{job}}" sözleşmesini iptal etmeyi reddetti. Sözleşme devam ediyor.',
            cancellationWithdrawn:
                '{{name}}, "{{job}}" için iptal talebini geri çekti. Sözleşme devam ediyor.',
            milestoneFunded:
                '{{milestone}} için {{amount}} artık emanette. Çalışmaya başlayabilirsiniz.',
            milestoneSubmitted:
                'Serbest çalışan {{milestone}} aşamasını teslim etti. Onaylayın veya değişiklik isteyin. {{days}} gün sonra otomatik onaylanır.',
            changesRequested:
                'Müşteri {{milestone}} aşaması için değişiklik istedi. Para emanette kalır; hazır olduğunuzda yeniden teslim edin.{{reason}}',
            changesRequestedReason: ' Neden: {{reason}}',
            milestonePaid:
                '{{milestone}} için cüzdanınıza {{net}} eklendi ({{gross}} eksi {{fee}} platform ücreti).',
            milestoneAutoApprovedClient:
                '{{milestone}} {{days}} gündür incelemedeydi ve otomatik onaylandı. Emanetten {{gross}} serbest bırakıldı.',
            issueAssigned: '{{name}} size "{{title}}" görevini atadı.',
            commentAdded: '{{name}}, "{{title}}" görevine yorum yaptı: {{excerpt}}',
            disputeOpened:
                '{{milestone}} için ihtilaf açıldı. Bir yönetici çözene kadar emanetteki para donduruldu.',
            disputeNeedsReview: '{{milestone}} ihtilaflı: {{reason}}',
            disputeResolved:
                'Bir yönetici {{number}}. aşama "{{title}}" ihtilafını çözdü: serbest çalışana {{release}}, müşteriye {{refund}} iade edildi.',
            reviewReceived: '{{name}}, "{{job}}" için size {{rating}} yıldızlı bir değerlendirme bıraktı.',
            reportReviewed:
                'Bir yönetici şikayetinizi inceledi. Daha fazla işlem gerekirse tekrar güncellenebilir.',
            reportClosed:
                'Bir yönetici şikayetinizi kapattı. Pazar yerini güvende tutmaya yardımcı olduğunuz için teşekkürler.',
            accountSuspended:
                'Bir yönetici hesabınızı askıya aldı. Bunun bir hata olduğunu düşünüyorsanız destekle iletişime geçin.',
            accountSuspendedReason:
                'Bir yönetici hesabınızı askıya aldı: {{reason}} Bunun bir hata olduğunu düşünüyorsanız destekle iletişime geçin.',
            accountReinstated:
                'Hesabınız yeniden etkin. Giriş yapıp pazar yerini kullanmaya devam edebilirsiniz.',
        },
    },
};
