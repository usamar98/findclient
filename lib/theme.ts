export const themeStorageKey = 'clientfind-theme'

// Run before the first paint, including on statically generated pages.
export const themeBootstrap = `(() => {
  const key = ${JSON.stringify(themeStorageKey)};
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  function apply() {
    let saved;
    try { saved = localStorage.getItem(key); } catch {}
    root.dataset.theme = saved === 'dark' || saved === 'light'
      ? saved : system.matches ? 'dark' : 'light';
  }
  apply();
  system.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) apply();
  });
  window.addEventListener('pageshow', event => { if (event.persisted) apply(); });
})();`
