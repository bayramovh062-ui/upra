# Upra: prezentasiya planı

> Qeyd: `upra`, `autonom united` və `stitch_upra_freelance_marketplace_platform` qovluqlarında `.pptx` və ya başqa prezentasiya faylı tapılmadı (yalnız `Upra_Commercial.mp4` reklam videosu və Stitch dizayn maketləri var). Bu plan mövcud prezentasiyanı yeniləmək və ya sıfırdan qurmaq üçün əsasdır: slayd başlıqları, məzmun və hər slaydın görüntü mənbəyi göstərilib. Hazır faylı göstərsəniz, ona uyğunlaşdırmaq olar.

Təxmini müddət: 10 dəqiqə nitq, 3-5 dəqiqə sual-cavab. Slayd sayı: 13.

---

## Slaydlar

### 1. Başlıq
**Upra: Hire. Collaborate. Deliver.**
- Frilanser bazarı: escrow ödənişi, iş məkanı, çat, admin mübahisə həlli
- Müəllif, tarix, repozitoriya və canlı sayt linki
- Görüntü: loqo və `docs/screenshots/01-find-work.png`

### 2. Problem
- Frilanser işi görür, pul almaya bilər. İşəgötürən pulu verir, işi almaya bilər.
- Tərəflər bir-birini tanımır, etibar yoxdur
- Mövcud platformalarda ödəniş, iş izləmə və ünsiyyət ayrı alətlərdədir
- Görüntü: sadə iki tərəfli diaqram (etibar boşluğu)

### 3. Həll
- Pul işdən əvvəl **escrow**-a qoyulur, mərhələ təsdiqlənəndə buraxılır
- Hər müqavilənin öz **Kanban iş məkanı** var, kartlar mərhələlərə bağlıdır
- **Real vaxt** çat və bildirişlər
- Mübahisədə pul dondurulur, **admin** qərar verir
- Qeyd: bütün pul simulyasiyadır (demo)

### 4. İstifadəçi axını
Elan -> təklif -> müqavilə təklifi (mərhələlərə bölünmüş) -> qəbul -> maliyyələşdirmə -> təhvil -> təsdiq və ödəniş -> rəy
- Görüntü: README-dəki axın və `03-contract-offer.png`, `05-escrow-tab.png`

### 5. Canlı demo
- Video (`docs/DEMO_SCRIPT.md` ssenarisi) və ya canlı göstəriş
- Əsas hekayə: təklif -> escrow -> təsdiq -> mübahisə -> admin həlli

### 6. Mərhələnin həyat dövrü
- `PENDING -> FUNDED -> IN_REVIEW -> PAID`, dəyişiklik tələbi (limitli), mübahisə, ləğv
- Müqavilə son mərhələdən sonra **avtomatik** tamamlanır
- Görüntü: README-dəki `stateDiagram` (Mermaid-dən şəkil kimi ixrac edin)

### 7. Pul təhlükəsizliyi
- Məbləğlər **tam sent** (float yoxdur), ledger yalnız əlavə olunur
- Hər əməliyyat bir tranzaksiyada: **müqavilə sətri kilidi** + şərti status yeniləməsi + pul kisələrinin sabit kilid sırası
- Nəticə: ikiqat təsdiq, ikiqat maliyyələşdirmə və deadlock mümkün deyil
- Nümunə: $500 mərhələ -> frilanserə $450, komissiya $50 (ayrıca ledger sətri)

### 8. Avtomatika və mübahisə
- 7 gün cavabsız qalan mərhələ avtomatik təsdiqlənir (xarici cron, gizli açarla qorunan endpoint)
- Mübahisə: release / refund / split, komissiya yalnız buraxılan hissədən
- Açıq mübahisə olarkən müqavilə ləğv edilmir (escrow iki dəfə buraxılmasın)

### 9. Arxitektura və texnologiyalar
- React + Vite + RTK Query + Tailwind, Express 5 + Prisma + PostgreSQL, Socket.IO
- Vercel (frontend), Render (API və cron), Neon (baza), Cloudinary (fayl), Brevo (e-poçt)
- Görüntü: README-dəki arxitektura diaqramı

### 10. Verilənlər modeli
- Əsas varlıqlar: User, JobPost, Proposal, Contract, Milestone, Wallet, Transaction, Dispute, Review
- Görüntü: README-dəki ER diaqramı

### 11. Keyfiyyət
- Backend: 32 test faylı (maliyyə, yarış vəziyyətləri, mübahisə, autentifikasiya, fayllar, rate limit)
- Playwright E2E: əsas axın, giriş və rol qoruması, **mobil** (Pixel 5) görünüş
- GitHub Actions: hər pull request-də üç iş (backend, frontend, E2E)
- Təhlükəli alətlərə qoruma: test və E2E yalnız `_test` və `_e2e` bazalarında işləyir

### 12. Təhlükəsizlik və etibar
- JWT + sessiya ləğvi (parol sıfırlanandan sonra köhnə sessiyalar bağlanır), bir dəfəlik e-poçt tokenləri yalnız hash kimi saxlanılır
- Rate limit, Zod validasiyası, Helmet, rol və tərəf yoxlamaları
- Fayllar autentifikasiya olunmuş endpoint-dən verilir, canlıda lokal saxlama bağlıdır
- Admin yalnız skriptlə təyin olunur

### 13. Nəticə və növbəti addımlar
- Hazır: canlı sabitlik, istifadəçi etibarı (e-poçt, parol, rəy, admin), testlər və CI, seed və sənədləşmə
- Növbəti (istəyə bağlı): AI-tövsiyəli mübahisə həlli (qərarı admin verir), gecikmiş mərhələ bildirişi, Sentry
- Məhdudiyyətlər: real ödəniş yoxdur, login limiti tək instansiya üçündür
- Suallar

---

## Sual-cavab üçün hazır cavablar

| Sual | Qısa cavab |
| --- | --- |
| Pul həqiqidirmi? | Xeyr. Real ödəniş provayderi yoxdur, hər ekranda "Demo · test money" etiketi var. Məntiq real sistemlər kimi qurulub: escrow, ledger, komissiya. |
| Niyə sentlə tam ədəd? | Float-da yuvarlaqlaşma səhvləri yaranır. Tam ədədlə ledger dəqiq cəmlənir və yoxlanıla bilir. |
| Eyni anda iki sorğu gəlsə? | Hər əməliyyat müqavilə sətrini kilidləyir və statusu şərti yeniləmə ilə dəyişir. İkinci sorğu 409 alır, ikiqat ödəniş olmur. Paralellik testləri real test bazasına qarşı işləyir (`financial.test.js`), iki təklifin eyni anda qəbulu isə `contractRace.test.js`-də yoxlanılır. |
| Niyə xarici cron? | Pulsuz Render instansiyası yatır, daxili taymer etibarlı deyil. Cron sorğusu həm instansiyanı oyadır, həm təsdiqi işə salır. Qayda isə `approveMilestone`-dadır, cron yalnız "nə vaxt yoxlamalı"nı həll edir. |
| Komissiya necə hesablanır? | 10%, tam sentə aşağı yuvarlaqlanır; qalıq frilanserdə qalır. Geri qaytarmada komissiya yoxdur, bölünmüş mübahisədə yalnız buraxılan hissədən tutulur. |
| Miqyaslanma? | API stateless-dir. İki yer tək instansiyaya bağlıdır: login limiti (yaddaşda) və Socket.IO. Çoxlu instansiya üçün Redis və Socket.IO adapter lazımdır. |
| Hesab silinəndə nə olur? | Soft delete: ledger, müqavilə və söhbət tarixçəsi oxunaqlı qalır. |
| Niyə admin skriptlə təyin olunur? | Public endpoint olsa, hər kəs admin ola bilər. Skript yalnız bazaya çıxışı olan şəxsə imkan verir. |
