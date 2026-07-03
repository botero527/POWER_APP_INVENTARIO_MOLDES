/* ── STATE ─────────────────────────────────────────────────── */
let currentOffset = 0;
let currentTotal  = 0;

/* ── INIT ──────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await loadOpciones();
  await loadTable();
  bindFilters();
});

/* ── OPCIONES (tipos) ───────────────────────────────────────── */
async function loadOpciones() {
  const data = await api('/api/consultar/opciones');
  const fTipo = document.getElementById('f-tipo');
  data.tipos.forEach(t => {
    fTipo.insertAdjacentHTML('beforeend', `<option value="${t}">${t}</option>`);
  });
}

/* ── TABLA ─────────────────────────────────────────────────── */
function getActiveFilters() {
  return {
    tipo:      document.getElementById('f-tipo').value,
    cod_molde: document.getElementById('f-cod-molde').value.trim(),
    version:   document.getElementById('f-version').value.trim(),
    pieza:     document.getElementById('f-pieza').value.trim(),
  };
}

function hasActiveFilters(f) {
  return !!(f.tipo || f.cod_molde || f.version || f.pieza);
}

async function loadTable() {
  currentOffset = 0;
  const body = document.getElementById('tabla-body');
  body.innerHTML = `<tr class="row-loading"><td colspan="9"><span class="spinner"></span></td></tr>`;
  updateLoadMoreBtn(false, true);

  try {
    const res = await fetchPage(0);
    currentOffset = res.data.length;
    currentTotal  = res.total;
    renderTable(res.data, false);
    updateFooter(res);
  } catch (e) {
    body.innerHTML = `<tr class="row-loading"><td colspan="9">Error al cargar datos</td></tr>`;
    toast(e.message, 'error');
  }
}

async function loadMore() {
  updateLoadMoreBtn(true, false);
  try {
    const res = await fetchPage(currentOffset);
    currentOffset += res.data.length;
    renderTable(res.data, true);
    updateFooter(res);
  } catch (e) {
    toast(e.message, 'error');
    updateLoadMoreBtn(false, false);
  }
}

async function fetchPage(offset) {
  const f = getActiveFilters();
  const params = new URLSearchParams({ offset });
  if (f.tipo)      params.set('tipo', f.tipo);
  if (f.cod_molde) params.set('cod_molde', f.cod_molde);
  if (f.version)   params.set('version', f.version);
  if (f.pieza)     params.set('pieza', f.pieza);
  return api(`/api/consultar/items?${params}`);
}

function updateFooter(res) {
  const showing = Math.min(currentOffset, res.total);
  const label = hasActiveFilters(getActiveFilters())
    ? `${res.total.toLocaleString()} registro${res.total !== 1 ? 's' : ''}`
    : `Mostrando ${showing.toLocaleString()} de ${res.total.toLocaleString()}`;
  document.getElementById('total-label').textContent = label;
  updateLoadMoreBtn(false, res.has_more);
}

function updateLoadMoreBtn(loading, visible) {
  const btn = document.getElementById('btn-load-more');
  if (!btn) return;
  if (!visible && !loading) { btn.style.display = 'none'; return; }
  btn.style.display = '';
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spinner"></span> Cargando...'
    : 'Cargar más registros';
}

function rowHtml(r) {
  return `
    <tr>
      <td><span class="badge badge-${escapeHtml(r.Tipo)}">${escapeHtml(r.Tipo)}</span></td>
      <td>${escapeHtml(r.CodMolde ?? '')}</td>
      <td>${escapeHtml(r.Version ?? '')}</td>
      <td>${escapeHtml(r.Pieza ?? '')}</td>
      <td>${escapeHtml(r.Repeticion ?? '')}</td>
      <td>${escapeHtml(r.Puesto ?? '')}</td>
      <td>${escapeHtml(r.Ubicacion ?? '')}</td>
      <td>${escapeHtml(r.Vehiculo ?? '')}</td>
      <td>${escapeHtml(r.Lote ?? '')}</td>
    </tr>
  `;
}

function renderTable(rows, append) {
  const body = document.getElementById('tabla-body');
  if (!append && !rows.length) {
    body.innerHTML = `<tr class="row-loading"><td colspan="9">Sin resultados</td></tr>`;
    return;
  }
  const html = rows.map(rowHtml).join('');
  if (append) {
    body.insertAdjacentHTML('beforeend', html);
  } else {
    body.innerHTML = html;
  }
}

/* ── FILTROS ───────────────────────────────────────────────── */
function bindFilters() {
  let debounce;
  ['f-tipo', 'f-cod-molde', 'f-version', 'f-pieza'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(loadTable, 350);
    });
  });

  document.getElementById('btn-limpiar').addEventListener('click', () => {
    document.getElementById('f-tipo').value = '';
    document.getElementById('f-cod-molde').value = '';
    document.getElementById('f-version').value = '';
    document.getElementById('f-pieza').value = '';
    loadTable();
  });
}
