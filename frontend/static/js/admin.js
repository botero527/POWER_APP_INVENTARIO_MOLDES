/* ── STATE ─────────────────────────────────────────────────── */
let editTarget    = null;
let pendingAction = null;
let deleteTarget  = null;
let currentOffset = 0;
let currentTotal  = 0;
let editImgId     = null;
let editUserId    = null;
let allUsers      = [];

/* ── INIT ──────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  bindAdminTabs();
  await loadOpciones();
  await loadTable();
  bindFilters();
  bindButtons();
  bindImgModal();
  bindUserModal();
});

/* ── ADMIN TABS ─────────────────────────────────────────────── */
function bindAdminTabs() {
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`admintab-${btn.dataset.admintab}`).classList.add('active');
      if (btn.dataset.admintab === 'imagenes') loadImgGrid();
      if (btn.dataset.admintab === 'usuarios') loadUsers();
    });
  });
}

/* ── IMAGE URL RESOLVER ─────────────────────────────────────── */
function resolveImgSrc(idStorage) {
  if (!idStorage) return null;
  if (idStorage.startsWith('JTJ') || idStorage.startsWith('JTI')) return null;
  if (idStorage.startsWith('https://') || idStorage.startsWith('http://')) return idStorage;
  if (idStorage.startsWith('/')) return idStorage;
  return `/static/${idStorage}`;
}

/* ── IMAGE GRID ─────────────────────────────────────────────── */
async function loadImgGrid() {
  const search = document.getElementById('img-search').value.trim();
  const grid = document.getElementById('img-grid');
  grid.innerHTML = `<div class="grid-loading"><span class="spinner"></span> Cargando...</div>`;
  try {
    const rows = await api(`/api/mantenimiento/imagenes?search=${encodeURIComponent(search)}`);
    renderImgGrid(rows);
  } catch (e) {
    grid.innerHTML = `<div class="grid-loading">Error: ${e.message}</div>`;
  }
}

function renderImgGrid(rows) {
  const grid = document.getElementById('img-grid');
  if (!rows.length) { grid.innerHTML = `<div class="grid-loading">Sin imágenes</div>`; return; }
  grid.innerHTML = rows.map(r => {
    const p = r._parsed || {};
    const imgSrc = resolveImgSrc(r.IdStorage);
    const thumbHtml = imgSrc
      ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(r.Nombre_Imagen)}" />`
      : `<span class="no-img">Sin imagen</span>`;
    const tipoCls = p.tipo ? `tipo-chip-${p.tipo}` : '';
    return `
      <div class="img-card">
        <div class="img-card-thumb">${thumbHtml}</div>
        <div class="img-card-body">
          <div class="tipo-chip ${tipoCls}">${escapeHtml(p.tipo) || '?'}</div>
          <div class="img-card-nombre">${escapeHtml(r.Nombre_Imagen)}</div>
          <div class="img-card-meta">
            <div><b>Puntos tolerancia:</b> ${escapeHtml(r.Cantidad_puntos ?? '--')}</div>
            <div><b>Esp. pista:</b> ${escapeHtml(r.Puntos_Esp_Pista ?? '--')}</div>
            <div><b>Creado:</b> ${escapeHtml(r.Create_Date ?? '--')}</div>
            <div><b>Modificado:</b> ${escapeHtml(r.Modif_Date ?? '--')}</div>
          </div>
        </div>
        <div class="img-card-actions">
          <button class="img-card-btn edit" onclick="openImgEdit(${r.id})">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/></svg>
            Editar
          </button>
          <button class="img-card-btn download" onclick="downloadImg('${imgSrc}','${r.Nombre_Imagen}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2"/><polyline points="7 10 12 15 17 10" stroke="currentColor" stroke-width="2"/><line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2"/></svg>
            Descargar
          </button>
          <button class="img-card-btn del" onclick="deleteImg(${r.id},'${r.Nombre_Imagen}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2"/><path d="M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2"/><path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            Eliminar
          </button>
        </div>
      </div>`;
  }).join('');
}

function downloadImg(src, nombre) {
  if (!src) { toast('Esta imagen no tiene archivo guardado', 'error'); return; }
  const a = document.createElement('a');
  a.href = src; a.download = nombre; a.click();
}

async function deleteImg(id, nombre) {
  if (!confirm(`¿Eliminar la imagen "${nombre}"?`)) return;
  try {
    await api(`/api/mantenimiento/imagenes/${id}`, { method: 'DELETE' });
    toast('Imagen eliminada', 'success');
    loadImgGrid();
  } catch (e) { toast(e.message, 'error'); }
}

function bindImgModal() {
  let deb;
  document.getElementById('img-search').addEventListener('input', () => {
    clearTimeout(deb); deb = setTimeout(loadImgGrid, 350);
  });
  document.getElementById('btn-img-add').addEventListener('click', openImgAdd);
  document.getElementById('btn-close-img').addEventListener('click', closeImgModal);
  document.getElementById('btn-cancel-img').addEventListener('click', closeImgModal);
  document.getElementById('btn-save-img').addEventListener('click', saveImg);

  const dropZone = document.getElementById('img-drop-zone');
  const fileInput = document.getElementById('img-file-input');
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) setPreviewFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) setPreviewFile(fileInput.files[0]);
  });
  ['img-tipo','img-cod','img-version','img-pieza'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateNombrePreview);
    document.getElementById(id).addEventListener('change', updateNombrePreview);
  });
}

function setPreviewFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById('img-preview-new');
    prev.src = e.target.result;
    prev.classList.remove('hidden');
    document.getElementById('img-drop-zone').classList.add('hidden');
  };
  reader.readAsDataURL(file);
  document.getElementById('img-file-input')._file = file;
}

function updateNombrePreview() {
  const tipo    = document.getElementById('img-tipo').value;
  const cod     = document.getElementById('img-cod').value.trim()     || 'XXXX';
  const version = document.getElementById('img-version').value.trim() || 'XXX';
  const pieza   = document.getElementById('img-pieza').value.trim()   || 'XXX';
  document.getElementById('nombre-generado').textContent = tipo ? `${tipo}|${cod}|${version}|${pieza}` : '--';
}

function openImgAdd() {
  editImgId = null;
  document.getElementById('modal-img-title').textContent = 'Agregar Imagen';
  resetImgForm();
  document.getElementById('modal-img').classList.remove('hidden');
}

async function openImgEdit(id) {
  editImgId = id;
  document.getElementById('modal-img-title').textContent = 'Editar Imagen';
  resetImgForm();
  try {
    const row = await api(`/api/mantenimiento/imagenes/${id}`);
    const p = row._parsed || {};
    document.getElementById('img-tipo').value    = p.tipo    || '';
    document.getElementById('img-cod').value     = p.cod === 'XXXX' ? '' : (p.cod || '');
    document.getElementById('img-version').value = p.version === 'XXX' ? '' : (p.version || '');
    document.getElementById('img-pieza').value   = p.pieza   === 'XXX' ? '' : (p.pieza || '');
    document.getElementById('img-cantidad').value = row.Cantidad_puntos || '';
    document.getElementById('img-puntos').value   = row.Puntos_Esp_Pista || '';
    updateNombrePreview();
    const oldBox = document.getElementById('img-preview-old');
    const oldSrc = resolveImgSrc(row.IdStorage);
    oldBox.innerHTML = oldSrc
      ? `<img src="${escapeHtml(oldSrc)}" style="max-height:160px;object-fit:contain;" />`
      : `<span class="no-img">Sin imagen almacenada</span>`;
  } catch (e) { toast(e.message, 'error'); return; }
  document.getElementById('modal-img').classList.remove('hidden');
}

function resetImgForm() {
  ['img-tipo','img-cod','img-version','img-pieza','img-cantidad','img-puntos'].forEach(id => {
    const el = document.getElementById(id);
    if (el.tagName === 'SELECT') el.selectedIndex = 0; else el.value = '';
  });
  document.getElementById('img-preview-old').innerHTML = `<span class="no-img">Sin imagen</span>`;
  document.getElementById('img-preview-new').classList.add('hidden');
  document.getElementById('img-drop-zone').classList.remove('hidden');
  document.getElementById('img-file-input').value = '';
  document.getElementById('img-file-input')._file = null;
  document.getElementById('nombre-generado').textContent = '--';
}

function closeImgModal() {
  document.getElementById('modal-img').classList.add('hidden');
  editImgId = null;
}

async function saveImg() {
  const tipo     = document.getElementById('img-tipo').value;
  const cantidad = document.getElementById('img-cantidad').value;
  const puntos   = document.getElementById('img-puntos').value.trim();
  if (!tipo)     { toast('Selecciona un Tipo', 'error'); return; }
  if (!cantidad) { toast('Ingresa la Cantidad de Puntos', 'error'); return; }
  if (!puntos)   { toast('Ingresa los Puntos Esp. Pista', 'error'); return; }
  const fd = new FormData();
  fd.append('tipo', tipo);
  fd.append('cod', document.getElementById('img-cod').value.trim());
  fd.append('version', document.getElementById('img-version').value.trim());
  fd.append('pieza', document.getElementById('img-pieza').value.trim());
  fd.append('cantidad_puntos', cantidad);
  fd.append('puntos_esp_pista', puntos);
  const fileInp = document.getElementById('img-file-input');
  if (fileInp.files[0]) fd.append('imagen', fileInp.files[0]);
  const btn = document.getElementById('btn-save-img');
  btn.disabled = true;
  try {
    const url    = editImgId ? `/api/mantenimiento/imagenes/${editImgId}` : '/api/mantenimiento/imagenes';
    const method = editImgId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, body: fd });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error'); }
    toast(editImgId ? 'Imagen actualizada' : 'Imagen creada', 'success');
    closeImgModal();
    loadImgGrid();
  } catch (e) { toast(e.message, 'error'); } finally { btn.disabled = false; }
}

/* ── USUARIOS ───────────────────────────────────────────────── */
async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = `<tr class="row-loading"><td colspan="5"><span class="spinner"></span></td></tr>`;
  try {
    allUsers = await api('/api/mantenimiento/users');
    renderUsers();
    renderUserStats();
  } catch (e) {
    tbody.innerHTML = `<tr class="row-loading"><td colspan="5">Error: ${e.message}</td></tr>`;
  }
}

function renderUserStats() {
  const total    = allUsers.length;
  const admins   = allUsers.filter(u => u.Rol === 'Admin').length;
  const horneros = allUsers.filter(u => u.Rol === 'Hornero').length;
  const matric   = allUsers.filter(u => u.Rol === 'Matricero').length;
  document.getElementById('user-stats').innerHTML = `
    <div class="stat-card"><div class="stat-icon stat-icon-total">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="2"/></svg>
    </div><div><div class="stat-num">${total}</div><div class="stat-label">Total</div></div></div>
    <div class="stat-card"><div class="stat-icon stat-icon-admin">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
    </div><div><div class="stat-num">${admins}</div><div class="stat-label">Admins</div></div></div>
    <div class="stat-card"><div class="stat-icon stat-icon-horn">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </div><div><div class="stat-num">${horneros}</div><div class="stat-label">Horneros</div></div></div>
    <div class="stat-card"><div class="stat-icon stat-icon-mat">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div><div><div class="stat-num">${matric}</div><div class="stat-label">Matriceros</div></div></div>`;
}

function renderUsers() {
  const search     = document.getElementById('user-search').value.toLowerCase();
  const activeRole = document.querySelector('#role-pills .pill.active')?.dataset.role || '';
  const filtered = allUsers.filter(u => {
    return u.UserName.toLowerCase().includes(search) && (!activeRole || u.Rol === activeRole);
  });
  document.getElementById('users-count-label').textContent =
    `${filtered.length} de ${allUsers.length} usuario${allUsers.length !== 1 ? 's' : ''}`;
  const tbody = document.getElementById('users-tbody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr class="row-loading"><td colspan="5">Sin resultados</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(u => `
    <tr>
      <td><div style="display:flex;align-items:center;gap:10px">
        <div class="user-avatar" style="background:${roleColor(u.Rol)}22;color:${roleColor(u.Rol)}">${escapeHtml(u.UserName.charAt(0).toUpperCase())}</div>
        <span style="font-weight:500">${escapeHtml(u.UserName)}</span>
      </div></td>
      <td><span class="rol-tag rol-${escapeHtml(u.Rol)}">${escapeHtml(u.Rol)}</span></td>
      <td>${escapeHtml(u.Create_Date || '--')}</td>
      <td>${escapeHtml(u.Modif_Date || '--')}</td>
      <td><div style="display:flex;gap:4px;justify-content:flex-end">
        <button class="btn-edit" title="Editar" onclick="openUserEdit(${u.UserId})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/></svg>
        </button>
        <button class="btn-edit" title="Eliminar" style="color:var(--danger)" onclick="deleteUser(${u.UserId},'${u.UserName}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2"/><path d="M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2"/><path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div></td>
    </tr>`).join('');
}

function roleColor(rol) {
  return { Admin: '#c17f24', Hornero: '#2e9e5b', Matricero: '#7c5cbf' }[rol] || '#3a8fa3';
}

function bindUserModal() {
  document.getElementById('btn-user-add').addEventListener('click', openUserAdd);
  document.getElementById('btn-close-user').addEventListener('click', closeUserModal);
  document.getElementById('btn-cancel-user').addEventListener('click', closeUserModal);
  document.getElementById('btn-save-user').addEventListener('click', saveUser);
  document.getElementById('btn-toggle-user-pw').addEventListener('click', () => {
    const inp = document.getElementById('user-password');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });
  let deb;
  document.getElementById('user-search').addEventListener('input', () => {
    clearTimeout(deb); deb = setTimeout(renderUsers, 200);
  });
  document.querySelectorAll('#role-pills .pill').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('#role-pills .pill').forEach(x => x.classList.remove('active'));
      p.classList.add('active');
      renderUsers();
    });
  });
}

function openUserAdd() {
  editUserId = null;
  document.getElementById('modal-user-title').textContent = 'Nuevo Usuario';
  document.getElementById('user-edit-id').value = '';
  document.getElementById('user-nombre').value = '';
  document.getElementById('user-rol').value = '';
  document.getElementById('user-password').value = '';
  document.getElementById('user-confirm').value = '';
  document.getElementById('user-pw-label').innerHTML = 'Contraseña <span class="required">*</span>';
  document.getElementById('user-pw-hint').style.display = 'block';
  document.getElementById('user-confirm-group').style.display = 'block';
  document.getElementById('user-error').classList.add('hidden');
  document.getElementById('modal-user').classList.remove('hidden');
}

function openUserEdit(id) {
  const u = allUsers.find(x => x.UserId === id);
  if (!u) return;
  editUserId = id;
  document.getElementById('modal-user-title').textContent = 'Editar Usuario';
  document.getElementById('user-edit-id').value = id;
  document.getElementById('user-nombre').value = u.UserName;
  document.getElementById('user-rol').value = u.Rol;
  document.getElementById('user-password').value = '';
  document.getElementById('user-confirm').value = '';
  document.getElementById('user-pw-label').innerHTML = 'Nueva Contraseña <small class="text-muted">(dejar vacío para no cambiar)</small>';
  document.getElementById('user-pw-hint').style.display = 'none';
  document.getElementById('user-confirm-group').style.display = 'block';
  document.getElementById('user-error').classList.add('hidden');
  document.getElementById('modal-user').classList.remove('hidden');
}

function closeUserModal() {
  document.getElementById('modal-user').classList.add('hidden');
  editUserId = null;
}

async function saveUser() {
  const nombre   = document.getElementById('user-nombre').value.trim();
  const rol      = document.getElementById('user-rol').value;
  const password = document.getElementById('user-password').value;
  const confirm  = document.getElementById('user-confirm').value;
  const errEl    = document.getElementById('user-error');
  errEl.classList.add('hidden');
  if (!nombre) { errEl.textContent = 'El nombre es requerido.'; errEl.classList.remove('hidden'); return; }
  if (!rol)    { errEl.textContent = 'Selecciona un rol.';      errEl.classList.remove('hidden'); return; }
  if (!editUserId && !password) { errEl.textContent = 'La contraseña es requerida.'; errEl.classList.remove('hidden'); return; }
  if (password && password !== confirm) { errEl.textContent = 'Las contraseñas no coinciden.'; errEl.classList.remove('hidden'); return; }
  const btn = document.getElementById('btn-save-user');
  btn.disabled = true;
  try {
    const body = { nombre, rol, password };
    if (editUserId) {
      await api(`/api/mantenimiento/users/${editUserId}`, { method: 'PUT', body: JSON.stringify(body) });
      toast('Usuario actualizado', 'success');
    } else {
      await api('/api/mantenimiento/users', { method: 'POST', body: JSON.stringify(body) });
      toast('Usuario creado', 'success');
    }
    closeUserModal();
    loadUsers();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
  } finally { btn.disabled = false; }
}

async function deleteUser(id, nombre) {
  if (!confirm(`¿Eliminar al usuario "${nombre}"? Esta acción no se puede deshacer.`)) return;
  try {
    await api(`/api/mantenimiento/users/${id}`, { method: 'DELETE' });
    toast('Usuario eliminado', 'success');
    loadUsers();
  } catch (e) { toast(e.message, 'error'); }
}

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
    const action = pendingAction;
    const target = editTarget;
    closePasswordModal();
    if (action === 'edit' && target) {
      await openFormModal(target);
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
