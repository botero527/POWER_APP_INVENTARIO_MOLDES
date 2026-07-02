/* ── STATE ─────────────────────────────────────────────────── */
let editTarget = null;   // null = agregar, number = editar
let pendingAction = null; // 'edit' | 'add'

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
async function loadTable() {
  const params = new URLSearchParams();
  const tipo     = document.getElementById('f-tipo').value;
  const codMolde = document.getElementById('f-cod-molde').value.trim();
  const version  = document.getElementById('f-version').value.trim();
  const pieza    = document.getElementById('f-pieza').value.trim();

  if (tipo)     params.set('tipo', tipo);
  if (codMolde) params.set('cod_molde', codMolde);
  if (version)  params.set('version', version);
  if (pieza)    params.set('pieza', pieza);

  const body = document.getElementById('tabla-body');
  body.innerHTML = `<tr class="row-loading"><td colspan="11"><span class="spinner"></span></td></tr>`;

  try {
    const res = await api(`/api/consultar/items?${params}`);
    renderTable(res.data);
    document.getElementById('total-label').textContent =
      `${res.total.toLocaleString()} registro${res.total !== 1 ? 's' : ''}`;
  } catch (e) {
    body.innerHTML = `<tr class="row-loading"><td colspan="11">Error al cargar datos</td></tr>`;
    toast(e.message, 'error');
  }
}

function renderTable(rows) {
  const body = document.getElementById('tabla-body');
  if (!rows.length) {
    body.innerHTML = `<tr class="row-loading"><td colspan="11">Sin resultados</td></tr>`;
    return;
  }
  body.innerHTML = rows.map(r => `
    <tr>
      <td>
        <button class="btn-edit" title="Editar" onclick="handleEdit(${r.IdRegistro})">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </td>
      <td><span class="badge badge-${r.Tipo}">${r.Tipo}</span></td>
      <td>${r.CodMolde ?? ''}</td>
      <td>${r.Version ?? ''}</td>
      <td>${r.Pieza ?? ''}</td>
      <td>${r.Repeticion ?? ''}</td>
      <td>${r.Puesto ?? ''}</td>
      <td>${r.Ubicacion ?? ''}</td>
      <td>${r.Vehiculo ?? ''}</td>
      <td>${r.Lote ?? ''}</td>
      <td>${r.Usos ?? '0'}</td>
    </tr>
  `).join('');
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
}

/* ── EDIT HANDLER ──────────────────────────────────────────── */
function handleEdit(id) {
  editTarget = id;
  pendingAction = 'edit';
  openPasswordModal();
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
