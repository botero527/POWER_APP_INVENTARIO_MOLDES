function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

async function api(url, opts = {}) {
  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), 15000);

  const isFormData = opts.body instanceof FormData;
  const headers = isFormData
    ? (opts.headers || {})
    : { 'Content-Type': 'application/json', ...(opts.headers || {}) };

  try {
    const res = await fetch(url, { ...opts, headers, signal: ctrl.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // 503 = servidor sin conexión a BD
      if (res.status === 503) throw new Error('Sin conexión a la base de datos. Verifica tu red e intenta de nuevo.');
      throw new Error(err.error || `Error ${res.status}`);
    }
    return res.json();
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('Sin respuesta del servidor (15s). Verifica tu conexión de red.');
    // TypeError: Failed to fetch = sin red o servidor caído
    if (e instanceof TypeError && e.message.includes('fetch')) throw new Error('Sin conexión. Verifica tu red e intenta de nuevo.');
    throw e;
  }
}
