/* ── STATE ─────────────────────────────────────────────────── */
let editTarget    = null;   // null = agregar, number = editar
let pendingAction = null;   // 'edit' | 'add'
let deleteTarget  = null;   // { id, label } del registro a eliminar
let currentOffset = 0;      // paginación: offset actual
let currentTotal  = 0;      // total de registros en DB

/* ── INIT ──────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await loadOpciones();
  await loadTable();
  bindFilters();
  bindButtons();
});

/* ── OPCIONES (tipos / ubicaciones) ────────────────────────── */
async function loadOpciones() {
  const data = await api('/api/consultar/opciones');

  const fTipo = document.getElementById('f-tipo');
  data.tipos.forEach(t => {
    fTipo.insertAdjacentHTML('beforeend', `<option value="${t}">${t}</option>`);
  });

  const formTipo = document.getElementById('form-tipo');
  data.tipos.forEach(t => {
    formTipo.insertAdjacentHTML('beforeend', `<option value="${t}">${t}</option>`);
  });

  const formUbic = document.getElementById('form-ubicacion');
  data.ubicaciones.forEach(u => {
    formUbic.insertAdjacentHTML('beforeend', `<option value="${u}">${u}</option>`);
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
  body.innerHTML = `<tr class="row-loading"><td colspan="11"><span class="spinner"></span></td></tr>`;
  updateLoadMoreBtn(false, true);

  try {
    const res = await fetchPage(0);
    currentOffset = res.data.length;
    currentTotal  = res.total;
    renderTable(res.data, false);
    updateFooter(res);
  } catch (e) {
    body.innerHTML = `<tr class="row-loading"><td colspan="11">Error al cargar datos</td></tr>`;
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
  if (!visible && !loading) {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = '';
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spinner"></span> Cargando...'
    : 'Cargar más registros';
}

function rowHtml(r) {
  return `
    <tr>
      <td>
        <div style="display:flex;gap:2px">
          <button class="btn-edit" title="Editar" onclick="handleEdit(${r.IdRegistro})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="btn-edit" title="Eliminar" style="color:var(--danger)"
            onclick="handleDelete(${r.IdRegistro},'${escapeHtml(r.Tipo)} ${escapeHtml(r.CodMolde)} V${escapeHtml(r.Version)} P${escapeHtml(r.Pieza)}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2"/>
              <path d="M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2"/>
              <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </td>
      <td><span class="badge badge-${escapeHtml(r.Tipo)}">${escapeHtml(r.Tipo)}</span></td>
      <td>${escapeHtml(r.CodMolde ?? '')}</td>
      <td>${escapeHtml(r.Version ?? '')}</td>
      <td>${escapeHtml(r.Pieza ?? '')}</td>
      <td>${escapeHtml(r.Repeticion ?? '')}</td>
      <td>${escapeHtml(r.Puesto ?? '')}</td>
      <td>${escapeHtml(r.Ubicacion ?? '')}</td>
      <td>${escapeHtml(r.Vehiculo ?? '')}</td>
      <td>${escapeHtml(r.Lote ?? '')}</td>
      <td>${escapeHtml(r.Usos ?? '0')}</td>
    </tr>
  `;
}

function renderTable(rows, append) {
  const body = document.getElementById('tabla-body');
  if (!append && !rows.length) {
    body.innerHTML = `<tr class="row-loading"><td colspan="11">Sin resultados</td></tr>`;
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

/* ── BOTONES GENERALES ─────────────────────────────────────── */
function bindButtons() {
  document.getElementById('btn-agregar').addEventListener('click', () => {
    pendingAction = 'add';
    openPasswordModal();
  });

  // Password modal
  document.getElementById('btn-close-password').addEventListener('click', closePasswordModal);
  document.getElementById('btn-cancel-password').addEventListener('click', closePasswordModal);
  document.getElementById('btn-confirm-password').addEventListener('click', confirmPassword);
  document.getElementById('input-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmPassword();
  });

  // Form modal
  document.getElementById('btn-close-form').addEventListener('click', closeFormModal);
  document.getElementById('btn-cancel-form').addEventListener('click', closeFormModal);
  document.getElementById('btn-save-form').addEventListener('click', saveForm);

  // Delete modal
  document.getElementById('btn-close-delete').addEventListener('click', closeDeleteModal);
  document.getElementById('btn-cancel-delete').addEventListener('click', closeDeleteModal);
  document.getElementById('btn-confirm-delete').addEventListener('click', confirmDelete);
}

/* ── EDIT HANDLER ──────────────────────────────────────────── */
function handleEdit(id) {
  editTarget = id;
  pendingAction = 'edit';
  openPasswordModal();
}

/* ── DELETE HANDLERS ───────────────────────────────────────── */
function handleDelete(id, label) {
  deleteTarget = { id, label };
  document.getElementById('delete-info').innerHTML =
    `<strong>Registro a eliminar:</strong><br>${escapeHtml(label)}`;
  document.getElementById('delete-motivo').value = '';
  document.getElementById('delete-password').value = '';
  document.getElementById('delete-error').classList.add('hidden');
  document.getElementById('modal-delete').classList.remove('hidden');
  setTimeout(() => document.getElementById('delete-motivo').focus(), 50);
}

function closeDeleteModal() {
  document.getElementById('modal-delete').classList.add('hidden');
  deleteTarget = null;
}

async function confirmDelete() {
  if (!deleteTarget) return;

  const motivo   = document.getElementById('delete-motivo').value.trim();
  const password = document.getElementById('delete-password').value;
  const errEl    = document.getElementById('delete-error');

  if (!motivo || !password) {
    errEl.textContent = 'Completa el motivo y la clave de administrador.';
    errEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('btn-confirm-delete');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Eliminando...';

  try {
    await api(`/api/consultar/items/${deleteTarget.id}`, {
      method: 'DELETE',
      body: JSON.stringify({ motivo, password }),
    });
    closeDeleteModal();
    toast('Registro eliminado', 'success');
    loadTable();
  } catch (e) {
    errEl.textContent = e.message || 'Error. Verifica la clave y completa el motivo.';
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2"/>
      <path d="M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2"/>
      <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg> Eliminar`;
  }
}

/* ── PASSWORD MODAL ────────────────────────────────────────── */
function openPasswordModal() {
  document.getElementById('input-password').value = '';
  document.getElementById('password-error').classList.add('hidden');
  document.getElementById('modal-password').classList.remove('hidden');
  setTimeout(() => document.getElementById('input-password').focus(), 50);
}

function closePasswordModal() {
  document.getElementById('modal-password').classList.add('hidden');
  editTarget = null;
  pendingAction = null;
}

async function confirmPassword() {
  const password = document.getElementById('input-password').value;
  if (!password) return;

  const btn = document.getElementById('btn-confirm-password');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    await api('/api/consultar/verify-password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    closePasswordModal();
    if (pendingAction === 'edit' && editTarget) {
      await openFormModal(editTarget);
    } else {
      openFormModal(null);
    }
  } catch {
    document.getElementById('password-error').classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar';
  }
}

/* ── FORM MODAL ────────────────────────────────────────────── */
async function openFormModal(id) {
  const title = document.getElementById('modal-form-title');
  const fields = ['cod-molde','vehiculo','lote','pieza','version','repeticion','ubicacion','usos','puesto','tipo'];

  if (id) {
    title.textContent = 'Editar Registro';
    try {
      const item = await api(`/api/consultar/items/${id}`);
      document.getElementById('form-id').value = id;
      document.getElementById('form-cod-molde').value  = item.CodMolde  ?? '';
      document.getElementById('form-vehiculo').value   = item.Vehiculo  ?? '';
      document.getElementById('form-lote').value       = item.Lote      ?? '';
      document.getElementById('form-pieza').value      = item.Pieza     ?? '';
      document.getElementById('form-version').value    = item.Version   ?? '';
      document.getElementById('form-repeticion').value = item.Repeticion ?? '';
      document.getElementById('form-ubicacion').value  = item.Ubicacion ?? '';
      document.getElementById('form-usos').value       = item.Usos      ?? '0';
      document.getElementById('form-puesto').value     = item.Puesto    ?? '';
      document.getElementById('form-tipo').value       = item.Tipo      ?? 'M';
    } catch (e) {
      toast(e.message, 'error');
      return;
    }
  } else {
    title.textContent = 'Agregar Nuevo';
    document.getElementById('form-id').value = '';
    fields.forEach(f => {
      const el = document.getElementById(`form-${f}`);
      if (el.tagName === 'SELECT') {
        el.selectedIndex = 0;
      } else {
        el.value = f === 'usos' ? '0' : '';
      }
    });
  }

  document.getElementById('modal-form').classList.remove('hidden');
}

function closeFormModal() {
  document.getElementById('modal-form').classList.add('hidden');
  editTarget = null;
}

async function saveForm() {
  const codMolde = document.getElementById('form-cod-molde').value.trim();
  if (!codMolde) {
    toast('CodMolde es requerido', 'error');
    return;
  }

  const data = {
    tipo:        document.getElementById('form-tipo').value,
    cod_molde:   codMolde,
    vehiculo:    document.getElementById('form-vehiculo').value.trim(),
    lote:        document.getElementById('form-lote').value.trim(),
    pieza:       document.getElementById('form-pieza').value.trim(),
    version:     document.getElementById('form-version').value.trim(),
    repeticion:  document.getElementById('form-repeticion').value.trim(),
    ubicacion:   document.getElementById('form-ubicacion').value,
    usos:        document.getElementById('form-usos').value || '0',
    puesto:      document.getElementById('form-puesto').value.trim(),
  };

  const id = document.getElementById('form-id').value;
  const btn = document.getElementById('btn-save-form');
  btn.disabled = true;

  try {
    if (id) {
      await api(`/api/consultar/items/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      toast('Registro actualizado', 'success');
    } else {
      await api('/api/consultar/items', { method: 'POST', body: JSON.stringify(data) });
      toast('Registro creado', 'success');
    }
    closeFormModal();
    loadTable();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}
