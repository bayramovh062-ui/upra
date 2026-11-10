# Upra: demo video ssenarisi

Hədəf müddət: **təxminən 7-7,5 dəqiqə**. Hər bölmədə ekranda nə edilir, nə deyilir və hansı rəqəmlərin çıxması gözlənilir.
Bütün hesablar `npm run seed` ilə yaranır (şifrə hamısı üçün: `Demo12345!`).

> Dırnaq içindəki düymə adları (`Send contract offer`, `Approve & pay` və s.) E2E testlərdə yoxlanılmış real mətnlərdir. Admin səhifəsindəki düymə adları yoxlanılmayıb, ona görə təsvirlə yazılıb.

---

## 1. Yazıdan əvvəl hazırlıq

**Mühit**

```bash
cd backend
npm run seed        # təmiz demo məlumat (hər çəkilişdən əvvəl təkrar işlətmək olar)
npm run dev         # http://localhost:5000
# ikinci terminal
cd frontend
npm run dev         # http://localhost:5173
```

- Seed hər dəfə hesabları **yenidən yaradır** (yeni ID-lər). Əvvəlki sessiyalar etibarsız olur, tətbiq özü çıxış edir, sadəcə yenidən daxil olun.
- Backend `.env`-də `DEMO_TOPUP_ENABLED` `false` olmamalıdır (yoxsa `Add demo funds` işləməz).

**Üç ayrı sessiya.** Sessiya brauzer yaddaşında (`localStorage`) saxlanılır, ona görə eyni brauzerdə iki hesab olmur. İki inkoqnito pəncərəsi də eyni yaddaşı paylaşır. Ən sadə yol: üç ayrı brauzer və ya üç Chrome profili.

| Sessiya | Hesab(lar) | Rolu |
| --- | --- | --- |
| **Client** profili | `leyla.client@demo.upra.local`, sonra `orxan.client@demo.upra.local` | İşəgötürən tərəf |
| **Freelancer** profili | `aysel.freelancer@demo.upra.local`, sonra `rauf.freelancer@demo.upra.local` | İcraçı tərəf |
| **Admin** profili | `admin@demo.upra.local` | Mübahisə həlli |

**Ekran:** 1920x1080, brauzer zoom 100-110%, əlfəcin paneli gizli, sistem bildirişləri söndürülmüş. Çəkilişdən əvvəl hər üç profildə hesaba bir dəfə daxil olub səhifəni yeniləyin (ilk yükləmə gecikməsi videoya düşməsin).

**Seed-dən sonra başlanğıc vəziyyət (yoxlama üçün)**

| Hesab | Vəziyyət |
| --- | --- |
| Leyla | `Build a booking dashboard...` işinə Aysel-in $2200 təklifi gözləyir; Nigar ilə müqavilədə mərhələ 2 ($500) **mübahisədədir**; pul kisəsində $350 |
| Orxan | Rauf ilə müqavilədə mərhələ 2 ($800) **təsdiq gözləyir**, mərhələ 3 ($500) hələ maliyyələşməyib; Tural-a göndərilmiş təklif cavab gözləyir; oxunmamış mesaj; pul kisəsində $1000 |
| Aysel | Tamamlanmış müqavilə, 5 ulduz rəy, çıxarıla bilən balans **$1350** |
| Rauf | Balans $630 |
| Nigar | Balans $630 |
| Admin | 1 açıq mübahisə, 1 açıq şikayət |

---

## 2. Zaman cədvəli

| Vaxt | Bölmə | Müddət |
| --- | --- | --- |
| 0:00 | Giriş | 0:30 |
| 0:30 | Tap, təklif et, işə götür | 1:30 |
| 2:00 | Escrow: pul kilidlənir | 1:00 |
| 3:00 | Əməkdaşlıq: iş məkanı, çat, real vaxt | 1:15 |
| 4:15 | Ödəniş: təsdiq və komissiya | 0:45 |
| 5:00 | Mübahisə və admin | 1:00 |
| 6:00 | Rəy, reytinq, çıxarış | 0:30 |
| 6:30 | Mobil və texniki hissə | 0:45 |
| 7:15 | Bağlanış | 0:15 |

Vaxt aşılsa kəsmə qaydası 4-cü bölmədədir.

---

## 3. Bölmələr

### 3.1 Giriş (0:00 - 0:30)

**Ekran:** ana səhifə `/`, sonra `Demo · test money` etiketi olan istənilən daxili səhifə.

**Deyilən mətn:**
> "Upra frilanserlə işəgötürən arasında etibar problemini həll edən bazardır. İşəgötürən pulu əvvəlcədən escrow-a qoyur, frilanser pulun orada olduğunu bilərək işləyir, iş təsdiqlənəndə ödəniş avtomatik buraxılır. Mübahisə olarsa, pul dondurulur və admin qərar verir. Layihədəki bütün pul simulyasiyadır, bunu hər ekranda yazdığımız etiket göstərir."

### 3.2 Tap, təklif et, işə götür (0:30 - 2:00)

**Frilanser profili, Aysel.**
1. `/jobs` (Find Work): axtarış xanasına bir söz yazın, kateqoriya və bacarıq filtrlərini göstərin, "match" xalına diqqət çəkin.
2. Profil səhifəsində orta reytinq (5 ulduz, 1 rəy) görünür.

**Client profili, Leyla.**
3. `My jobs` -> `Build a booking dashboard with React and Node.js` -> təkliflər səhifəsi. Aysel-in təklifini göstərin.
4. `Send contract offer` -> `Split into milestones`. Pəncərə $2200-ü iki bərabər mərhələyə bölür və "matches the bid" yazısı çıxır. -> `Send offer`.

**Frilanser profili, Aysel.**
5. `/contracts` -> `Offers` -> `Review offer` -> `Contract offer pending` yazısı -> `Accept offer` (pəncərədə təkrar `Accept offer`).

**Deyilən mətn:**
> "Client təklifi mərhələlərə bölərək göndərir. Pəncərə mərhələlərin cəminin təklif edilən məbləğə bərabər olmasını yoxlayır. Frilanser şərtləri qəbul edənə qədər müqavilə aktiv olmur."

### 3.3 Escrow: pul kilidlənir (2:00 - 3:00)

**Client profili, Leyla** (yeni müqavilənin `?tab=escrow` tabı).
1. Banner: `Demo: all money here is simulated`.
2. İkinci mərhələdə `Fund` düyməsi yoxdur: "Pay the earlier milestones first." Mərhələlər **ardıcıl** maliyyələşir.
3. Pul kisəsində $350 var, 1-ci mərhələ $1100-dür. `Add demo funds` -> məbləğ `1000` -> `Add funds`.
4. `Fund milestone` -> pəncərədə təsdiq. Status: "Funded. Waiting for the freelancer to submit."

**Gözlənilən rəqəmlər:** top-up-dan sonra $1350, maliyyələşdirmədən sonra mövcud $250, kilidli (escrow) $1100.

**Deyilən mətn:**
> "Pul client-in kisəsindən çıxıb escrow-da kilidlənir. Frilanser işə başlayanda pulun orada olduğunu görür. Hər pul əməliyyatı dəyişməz jurnala (ledger) yazılır."

### 3.4 Əməkdaşlıq: iş məkanı, çat, real vaxt (3:00 - 4:15)

Bu bölmə **hazır dolu** Orxan-Rauf müqaviləsində çəkilir (lövhəsi hazırdır).

**Client profili:** Leyla-dan çıxıb Orxan ilə daxil olun (`Log out` istifadəçi menyusundadır).
1. `/contracts` -> AWS müqaviləsi. İş məkanı: Kanban lövhəsi, kartlar mərhələlərə bağlıdır. Bir kartı sürükləyib başqa sütuna atın, kartı açıb şərh yazın.
2. `/messages`: Rauf-dan oxunmamış mesaj. Cavab yazın.

**Frilanser profili:** Rauf ilə daxil olun və pəncərəni yan-yana qoyun.
3. Çat mesajı Rauf-un ekranında **dərhal** görünür (Socket.IO). Bildiriş zəngi də yenilənir.

**Deyilən mətn:**
> "Hər müqavilənin öz Kanban lövhəsi var. Kartlar mərhələlərə bağlıdır, yəni mərhələ həm ödəniş vahidi, həm də sprintdir. Mesajlar və bildirişlər WebSocket ilə anında çatır. Client və frilanser arasında bir daimi söhbət var, yeni müqavilələrdə də eyni söhbət davam edir."

### 3.5 Ödəniş: təsdiq və komissiya (4:15 - 5:00)

**Client profili, Orxan.** Escrow tabı -> mərhələ 2 "təsdiq gözləyir".
1. Rauf-un pəncərəsini yan-yana saxlayın.
2. Orxan: `Approve & pay` -> pəncərədə yenə `Approve & pay`.
3. Rauf-un ekranında **real vaxtda** bildiriş (toast) çıxır, pul kisəsi artır.

**Gözlənilən rəqəmlər:** mərhələ $800, platforma komissiyası 10% = $80, Rauf-a $720. Rauf-un balansı $630-dan **$1350**-yə qalxır. Frilanserin escrow kartında "You received $720.00 (platform fee $80.00)." yazısı görünür.

**Deyilən mətn:**
> "Təsdiqlə ödəniş eyni addımdır. Escrow-dan çıxan məbləğ frilanserə düşür, 10% platforma komissiyası ayrıca ledger sətri kimi yazılır. Client cavab vermirsə, 7 gün sonra təsdiq avtomatik olur, bunu xarici cron işə salır."

*(İstəyə bağlı, 10 san.)* Orxan indi mərhələ 3-ü ($500) maliyyələşdirə bilər: `Fund milestone`. Kisədə $1000-dən $500 qalır.

### 3.6 Mübahisə və admin (5:00 - 6:00)

**Client profili:** Orxan-dan çıxıb Leyla ilə daxil olun. Nigar ilə müqavilənin escrow tabı: mərhələ 2 `DISPUTED`, pul **dondurulub**.

**Admin profili:**
1. `/admin/disputes` -> açıq mübahisə. Səbəbi, tərəflərin qeydlərini göstərin.
2. Qərar: **SPLIT**, frilanserə `$300`, client-ə `$200` (cəmi mərhələnin $500-nə bərabər olmalıdır) -> təsdiqləyin.

**Nəticə (hər iki tərəfdə yoxlayın):**
- Nigar-a $300 - 10% = **$270** düşür (balansı $630-dan $900-ə).
- Leyla-ya $200 geri qayıdır, escrow-da $0.
- Komissiya yalnız buraxılan $300-dən tutulur.
- Hər iki mərhələ bağlı olduğu üçün müqavilə **avtomatik `COMPLETED`** olur.

**Deyilən mətn:**
> "Mübahisə açılanda pul dondurulur, heç bir tərəf onu tək hərəkət etdirə bilmir. Admin buraxmaq, geri qaytarmaq və ya bölmək qərarı verir. Son mərhələ bağlananda müqavilə özü tamamlanır."

### 3.7 Rəy, reytinq, çıxarış (6:00 - 6:30)

**Client profili, Leyla:** tamamlanmış müqavilənin səhifəsi -> `Reviews` bölməsi -> `Review <frilanser adı>` -> `5 stars` -> şərh -> `Submit review`.
**Frilanser profili:** Nigar-ın (və ya Aysel-in) ictimai profilində orta reytinq görünür.
**Aysel:** dashboard-dakı pul kisəsi kartı -> çıxarış (demo). Balans $1350-dən azalır.

**Deyilən mətn:**
> "Rəy yalnız tamamlanmış müqavilədə, hər tərəfdən bir dəfə yazılır və sonradan dəyişdirilmir. Reytinq saxlanmır, hər dəfə rəylərdən hesablanır."

### 3.8 Mobil və texniki hissə (6:30 - 7:15)

1. DevTools -> cihaz rejimi (Pixel 5, 393x851). Ana səhifə, `Open menu` (hamburger), bir iş siyahısı. Üfüqi sürüşmə yoxdur.
2. Qısa kəsimlər (ekran yazısı ilə):
   - GitHub Actions səhifəsi: üç yaşıl iş (backend testləri, frontend, Playwright E2E).
   - README-dəki ER diaqramı.
   - Terminal: `npm test` nəticəsi.

**Deyilən mətn:**
> "Backend-də 32 test faylı pul məntiqini, yarış vəziyyətlərini, mübahisəni, autentifikasiyanı yoxlayır. Playwright testi bütün axını masaüstündə, mobil görünüşü isə telefon ölçüsündə yoxlayır, hamısı hər pull request-də GitHub Actions-da işləyir. Eyni müqavilə üzrə bütün pul əməliyyatları bir sətir kilidi altında növbə ilə gedir, ona görə ikiqat ödəniş mümkün deyil."

### 3.9 Bağlanış (7:15 - 7:30)

> "Upra: Hire. Collaborate. Deliver. Kod, ER diaqramı və qurulum təlimatı repozitoriyadadır."

Son kadr: loqo, repozitoriya ünvanı, canlı sayt linki.

---

## 4. Vaxt aşılsa nə kəsilir

Sıra ilə kəsin: (1) 3.5-dəki istəyə bağlı mərhələ 3 maliyyələşdirməsi, (2) 3.7-dəki çıxarış, (3) 3.8-dəki terminal kadrı, (4) 3.2-dəki axtarış və filtrlər. **Kəsilməməlidir:** təklif -> escrow -> təsdiq -> mübahisə -> admin. Bu, layihənin əsas hekayəsidir.

## 5. Əlavə kadrlar (istəyə bağlı)

- **Qeydiyyat və e-poçt təsdiqi:** yeni hesab yaradın. Lokal rejimdə e-poçt konfiqurasiya olunmayıbsa təsdiq linki backend loguna yazılır. Canlı saytda (Brevo) real məktub gəlir. Təsdiqlənməmiş hesabda `EmailVerificationBanner` görünür.
- **Parol bərpası:** `/forgot-password` -> məktubdakı link -> yeni parol. Köhnə sessiyalar bağlanır.
- **Admin istifadəçi səhifəsi:** `/admin/users`, hesabı dayandırma və bərpa.
- **Tural-a göndərilmiş təklif:** Tural ilə daxil olub `Accept offer`; sonra Orxan birinci mərhələni maliyyələşdirir.

## 6. Çəkilişdən sonra

- Eyni məlumatla təkrar çəkmək üçün: `npm run seed`.
- Videonu `Upra_Demo.mp4` kimi saxlayın, README-nin yuxarısına link əlavə edin.
- Ekran görüntüləri üçün `docs/screenshots/README.md` siyahısına baxın: eyni vəziyyətlərdən 8 kadr çəkmək kifayətdir.
