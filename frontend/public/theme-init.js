// İlk boyamadan əvvəl tema sinfini qoy: yanlış temanın bir anlıq görünməsinin qarşısını alır.
// Qeyd: CSP (script-src 'self') inline <script>-i blokladığı üçün bu kod ayrıca fayl kimi
// saxlanılır (bax: index.html).
(function () {
  try {
    var stored = localStorage.getItem('upra-theme');
    var dark =
      stored === 'dark' ||
      (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch {
    /* localStorage əlçatmazdırsa React mount zamanı temanı sinxronlaşdıracaq */
  }
})();
