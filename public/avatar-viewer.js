(() => {
  let loader = null;
  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  function ensureLoaded() {
    if (!loader) loader = import('/vendor/model-viewer.js').catch((error) => { loader = null; throw error; });
    return loader;
  }
  function element(source, label, className = '') {
    if (!source) return '';
    ensureLoaded().catch(() => {});
    return `<model-viewer class="${escapeHtml(className)}" src="${escapeHtml(source)}" alt="${escapeHtml(label || 'Agent 3D avatar')}" camera-controls autoplay interaction-prompt="none" loading="eager"></model-viewer>`;
  }
  window.HexiGridAvatarViewer = Object.freeze({ ensureLoaded, element });
})();
