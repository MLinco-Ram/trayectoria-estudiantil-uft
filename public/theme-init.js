// Aplica el tema guardado antes de pintar la página (evita el parpadeo claro/oscuro).
// Vive en un archivo propio para que la política CSP no necesite permitir scripts en línea.
(function () {
  try {
    var theme = localStorage.getItem('uft_theme');
    var isDark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
