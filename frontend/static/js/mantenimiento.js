/* ── STATE ─────────────────────────────────────────────── */
let editImgId  = null;
let editUserId = null;
let allUsers   = [];

/* ── INIT ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await checkSession();
  bindLogin();
});

/* ── SESSION CHECK ─────────────────────────────────────── */
async function checkSession() {
  // Use plain fetch to avoid browser logging a red 401 in console
  const res = await fetch('/api/mantenimiento/me');
  if (res.ok) {
    const me = await res.json();
    if (me.logged) showApp(me);
  }
}

/* ── LOGIN ─────────────────────────────────────────────── */
async function bindLogin() {
  // Load user list
  const users = await api('/api/mantenimiento/usuarios');
  const sel = document.getElementById('login-user');
  users.forEach(u => {
    sel.insertAdjacentHTML('beforeend', `<option value="${u.UserName}">${u.UserName}</option>`);
  });

  document.getElementById('btn-toggle-pw').addEventListener('click', () => {
    const inp = document.getElementById('login-password');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('btn-login').addEventListener('click', doLogin);
}

async function doLogin() {
  const username = document.getElementById('login-user').value;
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');

  if (!username || !password) {
    errEl.textContent = 'Selecciona un usuario e ingresa la contraseña.';
    errEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('btn-login');
  btn.disabled = true; btn.textContent = 'Verificando...';

  try {
    const res = await api('/api/mantenimiento/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    showApp(res);
  } catch {
    errEl.textContent = 'Usuario o contraseña incorrectos.';
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Ingresar';
  }
}

function showApp(me) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('mant-username-label').textContent = me.username || me.UserName;
  document.getElementById('mant-role-badge').textContent = me.rol || me.Rol || '';

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await api('/api/mantenimiento/logout', { method: 'POST' });
    location.reload();
  });

  // Bind everything now that the DOM is visible
  bindTabs();
  bindImgModal();
  bindUserModal();
  bindRobot();
  bindBuscarHer();

  // Load first tab
  loadImgGrid();
}

/* ── TABS ──────────────────────────────────────────────── */
function bindTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
      if (btn.dataset.tab === 'edit-jpg')   loadImgGrid();
      if (btn.dataset.tab === 'edit-users') loadUsers();
    });
  });
}

/* ── IMAGE GRID ────────────────────────────────────────── */
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
  if (!rows.length) {
    grid.innerHTML = `<div class="grid-loading">Sin imágenes</div>`;
    return;
  }

  grid.innerHTML = rows.map(r => {
    const p = r._parsed || {};
    const imgSrc = r.IdStorage && !r.IdStorage.startsWith('JTJ')
      ? `/static/${r.IdStorage}`
      : null;

    const thumbHtml = imgSrc
      ? `<img src="${imgSrc}" alt="${r.Nombre_Imagen}" />`
      : `<span class="no-img">Sin imagen</span>`;

    const tipoCls = p.tipo ? `tipo-chip-${p.tipo}` : '';

    return `
      <div class="img-card">
        <div class="img-card-thumb">${thumbHtml}</div>
        <div class="img-card-body">
          <div class="tipo-chip ${tipoCls}">${p.tipo || '?'}</div>
          <div class="img-card-nombre">${r.Nombre_Imagen}</div>
          <div class="img-card-meta">
            <div><b>Puntos tolerancia:</b> ${r.Cantidad_puntos ?? '--'}</div>
            <div><b>Esp. pista:</b> ${r.Puntos_Esp_Pista ?? '--'}</div>
            <div><b>Creado:</b> ${r.Create_Date ?? '--'}</div>
            <div><b>Modificado:</b> ${r.Modif_Date ?? '--'}</div>
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
      </div>
    `;
  }).join('');
}

/* ── DOWNLOAD ──────────────────────────────────────────── */
function downloadImg(src, nombre) {
  if (!src) { toast('Esta imagen no tiene archivo guardado', 'error'); return; }
  const a = document.createElement('a');
  a.href = src; a.download = nombre; a.click();
}

/* ── DELETE ────────────────────────────────────────────── */
async function deleteImg(id, nombre) {
  if (!confirm(`¿Eliminar la imagen "${nombre}"?`)) return;
  try {
    await api(`/api/mantenimiento/imagenes/${id}`, { method: 'DELETE' });
    toast('Imagen eliminada', 'success');
    loadImgGrid();
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ── IMG MODAL ─────────────────────────────────────────── */
function bindImgModal() {
  // Search debounce
  let deb;
  document.getElementById('img-search').addEventListener('input', () => {
    clearTimeout(deb); deb = setTimeout(loadImgGrid, 350);
  });

  document.getElementById('btn-img-add').addEventListener('click', () => openImgAdd());
  document.getElementById('btn-close-img').addEventListener('click', closeImgModal);
  document.getElementById('btn-cancel-img').addEventListener('click', closeImgModal);
  document.getElementById('btn-save-img').addEventListener('click', saveImg);

  // File drag/drop
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

  // Live nombre preview
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
  document.getElementById('nombre-generado').textContent =
    tipo ? `${tipo}|${cod}|${version}|${pieza}` : '--';
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

    // Show old image
    const oldBox = document.getElementById('img-preview-old');
    if (row.IdStorage && !row.IdStorage.startsWith('JTJ')) {
      oldBox.innerHTML = `<img src="/static/${row.IdStorage}" style="max-height:160px;object-fit:contain;" />`;
    } else {
      oldBox.innerHTML = `<span class="no-img">Sin imagen almacenada</span>`;
    }
  } catch (e) {
    toast(e.message, 'error');
    return;
  }

  document.getElementById('modal-img').classList.remove('hidden');
}

function resetImgForm() {
  ['img-tipo','img-cod','img-version','img-pieza','img-cantidad','img-puntos'].forEach(id => {
    const el = document.getElementById(id);
    if (el.tagName === 'SELECT') el.selectedIndex = 0;
    else el.value = '';
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
  fd.append('tipo',            tipo);
  fd.append('cod',             document.getElementById('img-cod').value.trim());
  fd.append('version',         document.getElementById('img-version').value.trim());
  fd.append('pieza',           document.getElementById('img-pieza').value.trim());
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
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

/* ══════════════════════════════════════════════════════════
   USUARIOS
══════════════════════════════════════════════════════════ */

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
    <div class="stat-card">
      <div class="stat-icon stat-icon-total">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="2"/></svg>
      </div>
      <div><div class="stat-num">${total}</div><div class="stat-label">Total</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon stat-icon-admin">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
      </div>
      <div><div class="stat-num">${admins}</div><div class="stat-label">Admins</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon stat-icon-horn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </div>
      <div><div class="stat-num">${horneros}</div><div class="stat-label">Horneros</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon stat-icon-mat">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div><div class="stat-num">${matric}</div><div class="stat-label">Matriceros</div></div>
    </div>
  `;
}

function renderUsers() {
  const search     = document.getElementById('user-search').value.toLowerCase();
  const activeRole = document.querySelector('#role-pills .pill.active')?.dataset.role || '';

  const filtered = allUsers.filter(u => {
    const matchName = u.UserName.toLowerCase().includes(search);
    const matchRole = !activeRole || u.Rol === activeRole;
    return matchName && matchRole;
  });

  document.getElementById('users-count-label').textContent =
    `${filtered.length} de ${allUsers.length} usuario${allUsers.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('users-tbody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr class="row-loading"><td colspan="5">Sin resultados</td></tr>`;
    return;
  }

  const myId = null; // session ID not used in render

  tbody.innerHTML = filtered.map(u => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="user-avatar" style="background:${roleColor(u.Rol)}22;color:${roleColor(u.Rol)}">
            ${u.UserName.charAt(0).toUpperCase()}
          </div>
          <span style="font-weight:500">${u.UserName}</span>
        </div>
      </td>
      <td><span class="rol-tag rol-${u.Rol}">${u.Rol}</span></td>
      <td>${u.Create_Date || '--'}</td>
      <td>${u.Modif_Date || '--'}</td>
      <td>
        <div style="display:flex;gap:4px;justify-content:flex-end">
          <button class="btn-edit" title="Editar" onclick="openUserEdit(${u.UserId})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/></svg>
          </button>
          <button class="btn-edit" title="Eliminar" style="color:var(--danger)" onclick="deleteUser(${u.UserId},'${u.UserName}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2"/><path d="M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2"/><path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function roleColor(rol) {
  return { Admin: '#c17f24', Hornero: '#2e9e5b', Matricero: '#7c5cbf' }[rol] || '#3a8fa3';
}

/* ── USER MODAL ────────────────────────────────────────── */
function bindUserModal() {
  document.getElementById('btn-user-add').addEventListener('click', openUserAdd);
  document.getElementById('btn-close-user').addEventListener('click', closeUserModal);
  document.getElementById('btn-cancel-user').addEventListener('click', closeUserModal);
  document.getElementById('btn-save-user').addEventListener('click', saveUser);
  document.getElementById('btn-toggle-user-pw').addEventListener('click', () => {
    const inp = document.getElementById('user-password');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  // Search + filter
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
  } finally {
    btn.disabled = false;
  }
}

async function deleteUser(id, nombre) {
  if (!confirm(`¿Eliminar al usuario "${nombre}"? Esta acción no se puede deshacer.`)) return;
  try {
    await api(`/api/mantenimiento/users/${id}`, { method: 'DELETE' });
    toast('Usuario eliminado', 'success');
    loadUsers();
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ══════════════════════════════════════════════════════════
   BUSCAR HERRAMENTAL (modal del +)
══════════════════════════════════════════════════════════ */

let herSeleccionado = null;  // el registro de inventario elegido
let manttoActivoId  = null;  // id del ManttoHead recién creado
let imgConfig       = null;  // datos de Imagenes para el herramental

function openBuscarHer() {
  herSeleccionado = null;
  document.getElementById('modal-buscar-her').classList.remove('hidden');
  ['buscar-tipo','buscar-cod','buscar-version','buscar-pieza'].forEach(id => {
    const el = document.getElementById(id);
    if (el.tagName === 'SELECT') el.value = '';
    else el.value = '';
  });
  document.getElementById('buscar-tbody').innerHTML =
    `<tr class="row-loading"><td colspan="8">Escriba para buscar...</td></tr>`;
  document.getElementById('buscar-cod').focus();
}

function closeBuscarHer() {
  document.getElementById('modal-buscar-her').classList.add('hidden');
}

function bindBuscarHer() {
  document.getElementById('btn-close-buscar').addEventListener('click', closeBuscarHer);

  let deb;
  ['buscar-tipo','buscar-cod','buscar-version','buscar-pieza'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      clearTimeout(deb); deb = setTimeout(buscarHeramentales, 350);
    });
    document.getElementById(id).addEventListener('change', () => {
      clearTimeout(deb); deb = setTimeout(buscarHeramentales, 100);
    });
  });

  document.getElementById('btn-close-confirmar').addEventListener('click', closeConfirmar);
  document.getElementById('btn-cancel-confirmar').addEventListener('click', closeConfirmar);
  document.getElementById('btn-aceptar-mantto').addEventListener('click', crearMantto);
  document.getElementById('btn-close-form-mantto').addEventListener('click', closeFormMantto);
  document.getElementById('btn-step-next').addEventListener('click', nextStep);
  document.getElementById('btn-step-prev').addEventListener('click', prevStep);

  // Sub-tabs paso 1
  document.querySelectorAll('.step1-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.step1-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.step1-subtab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`subtab-${tab.dataset.subtab}`).classList.add('active');
    });
  });
}

async function buscarHeramentales() {
  const tipo    = document.getElementById('buscar-tipo').value;
  const cod     = document.getElementById('buscar-cod').value.trim();
  const version = document.getElementById('buscar-version').value.trim();
  const pieza   = document.getElementById('buscar-pieza').value.trim();

  if (!tipo && !cod && !version && !pieza) {
    document.getElementById('buscar-tbody').innerHTML =
      `<tr class="row-loading"><td colspan="8">Escriba para buscar...</td></tr>`;
    return;
  }

  const tbody = document.getElementById('buscar-tbody');
  tbody.innerHTML = `<tr class="row-loading"><td colspan="8"><span class="spinner"></span></td></tr>`;

  const params = new URLSearchParams({ tipo, cod, version, pieza });
  try {
    const rows = await api(`/api/mantenimiento/inventario-search?${params}`);
    if (!rows.length) {
      tbody.innerHTML = `<tr class="row-loading"><td colspan="8">Sin resultados</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><span class="rol-tag" style="background:#e8f4f7;color:var(--primary-dk)">${r.Tipo}</span></td>
        <td style="font-weight:700">${r.CodMolde}</td>
        <td>${r.Version}</td>
        <td>${r.Pieza}</td>
        <td>${r.Vehiculo || '--'}</td>
        <td style="text-align:center">${r.Repeticion}</td>
        <td>${r.Adicionales || r.Lote || '--'}</td>
        <td>
          <button class="btn-edit" style="color:var(--primary)" title="Seleccionar"
            onclick="seleccionarHer(${r.IdRegistro})">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </td>
      </tr>
    `).join('');
    window._buscarRows = rows;
  } catch (e) {
    tbody.innerHTML = `<tr class="row-loading"><td colspan="8">Error: ${e.message}</td></tr>`;
  }
}

async function seleccionarHer(idRegistro) {
  const row = (window._buscarRows || []).find(r => r.IdRegistro === idRegistro);
  if (!row) return;
  herSeleccionado = row;

  // Calcular siguiente repetición
  const params = new URLSearchParams({
    tipo: row.Tipo, cod: row.CodMolde, version: row.Version, pieza: row.Pieza
  });
  let nextRep = '...';
  try {
    const manttos = await api(`/api/mantenimiento/manttos?${params}`);
    const maxRep  = manttos.reduce((m, x) => Math.max(m, x.Repeticion || 0), 0);
    nextRep = maxRep + 1;
  } catch { nextRep = 1; }

  herSeleccionado._nextRep = nextRep;

  // Mostrar confirmación
  closeBuscarHer();
  document.getElementById('confirm-her-data').innerHTML = `
    <div class="confirm-row"><span class="confirm-label">Tipo</span><span class="confirm-value">${row.Tipo === 'M' ? 'Molde' : 'Galibo'}</span></div>
    <div class="confirm-row"><span class="confirm-label">Código</span><span class="confirm-value">${row.CodMolde}</span></div>
    <div class="confirm-row"><span class="confirm-label">Versión</span><span class="confirm-value">${row.Version}</span></div>
    <div class="confirm-row"><span class="confirm-label">Pieza</span><span class="confirm-value">${row.Pieza}</span></div>
    <div class="confirm-row"><span class="confirm-label">Descripción</span><span class="confirm-value">${row.Adicionales || row.Lote || '--'}</span></div>
    <div class="confirm-rep">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Se creará la Repetición #${nextRep}
    </div>
  `;
  document.getElementById('modal-confirmar-mantto').classList.remove('hidden');
}

function closeConfirmar() {
  document.getElementById('modal-confirmar-mantto').classList.add('hidden');
  herSeleccionado = null;
}

async function crearMantto() {
  if (!herSeleccionado) return;
  const btn = document.getElementById('btn-aceptar-mantto');
  btn.disabled = true; btn.textContent = 'Creando...';

  // Guardamos referencia antes de cerrar el modal (closeConfirmar nullea herSeleccionado)
  const her = herSeleccionado;

  try {
    const res = await api('/api/mantenimiento/manttos', {
      method: 'POST',
      body: JSON.stringify({
        tipo:        her.Tipo,
        cod:         String(her.CodMolde),
        version:     her.Version,
        pieza:       her.Pieza,
        adicionales: her.Adicionales || her.Lote || '',
      }),
    });
    manttoActivoId = res.id;
    document.getElementById('modal-confirmar-mantto').classList.add('hidden');
    herSeleccionado = her;
    herSeleccionado._nextRep = res.repeticion; // viene del backend, nunca NaN
    await abrirFormMantto();
  } catch (e) {
    toast(e.message, 'error');
    btn.disabled = false;
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Aceptar — Crear Mantenimiento`;
  }
}

/* ══════════════════════════════════════════════════════════
   FORMULARIO 4 PASOS
══════════════════════════════════════════════════════════ */

let currentStep = 1;
const TOTAL_STEPS = 4;

async function abrirFormMantto() {
  currentStep = 1;
  renderStepBar();
  showStepContent(1);
  document.getElementById('form-mantto-title').textContent =
    `${herSeleccionado.Tipo}${herSeleccionado.CodMolde} — Rep. ${herSeleccionado._nextRep}`;
  document.getElementById('modal-form-mantto').classList.remove('hidden');
  await loadStep1();
}

function closeFormMantto() {
  document.getElementById('modal-form-mantto').classList.add('hidden');
  manttoActivoId = null; imgConfig = null; herSeleccionado = null;
  loadManttos();
}

function renderStepBar() {
  document.querySelectorAll('.step').forEach(s => {
    const n = parseInt(s.dataset.step);
    s.classList.remove('active', 'done');
    if (n === currentStep) s.classList.add('active');
    if (n < currentStep)  s.classList.add('done');
  });
  document.querySelectorAll('.step-line').forEach((l, i) => {
    l.classList.toggle('done', i + 1 < currentStep);
  });
  document.getElementById('btn-step-prev').classList.toggle('hidden', currentStep === 1);
  const nextBtn = document.getElementById('btn-step-next');
  nextBtn.innerHTML = currentStep === TOTAL_STEPS
    ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Finalizar`
    : `Siguiente <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><polyline points="9,18 15,12 9,6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
}

function showStepContent(n) {
  document.querySelectorAll('.step-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`step-content-${n}`).classList.add('active');
}

async function nextStep() {
  if (currentStep === 1) {
    currentStep = 2;
    renderStepBar(); showStepContent(2);
    loadStep2();
  } else if (currentStep === 2) {
    const ok = await saveStep2();
    if (!ok) return;
    currentStep = 3;
    renderStepBar(); showStepContent(3);
    await loadStep3();
  } else if (currentStep === 3) {
    currentStep = 4;
    renderStepBar(); showStepContent(4);
    loadStep4();
  } else if (currentStep === 4) {
    await finalizarMantto();
  }
}

function prevStep() {
  if (currentStep > 1) {
    currentStep--;
    renderStepBar();
    showStepContent(currentStep);
    if (currentStep === 2) loadStep2();
  }
}

/* ── PASO 1: INGRESO HER ─────────────────────────────────── */

async function loadStep1() {
  const her = herSeleccionado;
  if (!her) return;

  // Buscar config de imagen (cantidad_puntos y puntos_esp_pista)
  try {
    const params = new URLSearchParams({
      tipo: her.Tipo, cod: her.CodMolde, version: her.Version, pieza: her.Pieza
    });
    const imgRow = await api(`/api/mantenimiento/imagenes/buscar?${params}`);
    imgConfig = imgRow;
  } catch { imgConfig = null; }

  renderStep1Image();
  renderAjusteInputs();
  renderEspesorInputs();
  await loadExistingDetails();
}

function renderStep1Image() {
  const box  = document.getElementById('step1-img-box');
  const info = document.getElementById('step1-img-info');
  if (imgConfig && imgConfig.IdStorage && !imgConfig.IdStorage.startsWith('JTJ')) {
    box.innerHTML = `<img src="/static/${imgConfig.IdStorage}" alt="Herramental" style="max-height:320px;object-fit:contain" />`;
    info.textContent = imgConfig.Nombre_Imagen || '';
  } else {
    box.innerHTML = `<span class="no-img">Sin imagen registrada para este herramental</span>`;
    info.textContent = '';
  }
}

function renderAjusteInputs() {
  const container = document.getElementById('ajuste-inputs');
  const total = imgConfig?.Cantidad_puntos || 0;

  if (!total) {
    container.innerHTML = `<div style="padding:20px;font-size:13px;color:var(--text-muted);line-height:1.7">
      <p><b>Sin puntos configurados</b></p>
      <p>Este herramental no tiene imagen registrada en el sistema.</p>
      <p>Ve a la pestaña <b>Gestión de Imágenes</b> y agrega la imagen para
      <b>${herSeleccionado?.Tipo}${herSeleccionado?.CodMolde}</b> con los puntos de ajuste.</p>
    </div>`;
    return;
  }

  let html = '';
  for (let i = 1; i <= total; i++) {
    html += `
      <div class="measure-row" id="row-ajuste-${i}">
        <div class="measure-point" id="dot-ajuste-${i}">${i}</div>
        <input class="measure-input" type="number" step="0.01"
          id="inp-ajuste-${i}" placeholder="0.00"
          oninput="onMeasureInput('MedidaTolerancia_Mantenimiento', ${i}, this)" />
        <svg class="measure-save-icon" id="icon-ajuste-${i}" width="16" height="16"
          viewBox="0 0 24 24" fill="none">
          <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`;
  }
  container.innerHTML = html;
}

function renderEspesorInputs() {
  const container = document.getElementById('espesor-inputs');
  const puntosRaw = imgConfig?.Puntos_Esp_Pista || '';
  const puntos = puntosRaw.split(',').map(p => p.trim()).filter(p => p && !isNaN(p)).map(Number);

  if (!puntos.length) {
    container.innerHTML = `<p style="padding:16px;font-size:13px;color:var(--text-muted)">
      No hay puntos de espesor de pista configurados para este herramental.</p>`;
    return;
  }

  let html = '';
  puntos.forEach(p => {
    html += `
      <div class="measure-row" id="row-espesor-${p}">
        <div class="measure-point" id="dot-espesor-${p}">${p}</div>
        <input class="measure-input" type="number" step="0.01"
          id="inp-espesor-${p}" placeholder="0.00"
          oninput="onMeasureInput('EspesorPista_Mantenimiento', ${p}, this)" />
        <svg class="measure-save-icon" id="icon-espesor-${p}" width="16" height="16"
          viewBox="0 0 24 24" fill="none">
          <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`;
  });
  container.innerHTML = html;
}

async function loadExistingDetails() {
  if (!manttoActivoId) return;
  try {
    const mantto = await api(`/api/mantenimiento/manttos/${manttoActivoId}`);
    const byClase = mantto.details_by_clase || {};

    const ajuste  = byClase['MedidaTolerancia_Mantenimiento'] || [];
    const espesor = byClase['EspesorPista_Mantenimiento'] || [];

    ajuste.forEach(d  => markSaved('ajuste',  d.IdMed, d.Value));
    espesor.forEach(d => markSaved('espesor', d.IdMed, d.Value));
  } catch { /* sin datos existentes */ }
}

function markSaved(prefix, idMed, value) {
  const inp  = document.getElementById(`inp-${prefix}-${idMed}`);
  const dot  = document.getElementById(`dot-${prefix}-${idMed}`);
  const icon = document.getElementById(`icon-${prefix}-${idMed}`);
  if (!inp) return;
  if (value !== null && value !== undefined) inp.value = value;
  inp.classList.add('saved');
  if (dot)  dot.classList.add('saved');
  if (icon) icon.classList.add('active');
}

const _debounceMap = {};
function onMeasureInput(clase, idMed, inputEl) {
  const prefix = clase === 'MedidaTolerancia_Mantenimiento' ? 'ajuste' : 'espesor';
  const key = `${clase}-${idMed}`;
  clearTimeout(_debounceMap[key]);
  _debounceMap[key] = setTimeout(() => saveMeasure(clase, idMed, inputEl, prefix), 600);
  // Quitar estado guardado mientras edita
  inputEl.classList.remove('saved');
  const dot  = document.getElementById(`dot-${prefix}-${idMed}`);
  const icon = document.getElementById(`icon-${prefix}-${idMed}`);
  if (dot)  dot.classList.remove('saved');
  if (icon) icon.classList.remove('active');
}

async function saveMeasure(clase, idMed, inputEl, prefix) {
  if (!manttoActivoId) return;
  const value = parseFloat(inputEl.value);
  if (isNaN(value)) return;

  const label = document.getElementById('step-auto-save-label');
  if (label) label.textContent = 'Guardando...';

  try {
    await api(`/api/mantenimiento/manttos/${manttoActivoId}/detail`, {
      method: 'PUT',
      body: JSON.stringify({ id_med: idMed, clase, value }),
    });
    markSaved(prefix, idMed, value);
    if (label) label.textContent = `✓ Guardado automáticamente`;
    setTimeout(() => { if (label) label.textContent = ''; }, 2000);
  } catch (e) {
    if (label) label.textContent = 'Error al guardar';
  }
}

/* ══════════════════════════════════════════════════════════
   MÓDULO MANTENIMIENTOS (ROBOT)
══════════════════════════════════════════════════════════ */

let allManttos = [];

function bindRobot() {
  document.getElementById('btn-robot').addEventListener('click', openManttoScreen);
  document.getElementById('btn-back-mantto').addEventListener('click', closeManttoScreen);
  document.getElementById('btn-back-detail').addEventListener('click', showManttoList);
  document.getElementById('btn-mantto-add').addEventListener('click', openBuscarHer);

  // Búsqueda con debounce
  let deb;
  document.getElementById('mantto-search').addEventListener('input', () => {
    clearTimeout(deb); deb = setTimeout(loadManttos, 350);
  });

  // Pills de estatus
  document.querySelectorAll('#mantto-estatus-pills .pill').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('#mantto-estatus-pills .pill').forEach(x => x.classList.remove('active'));
      p.classList.add('active');
      loadManttos();
    });
  });
}

function openManttoScreen() {
  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('mantto-screen').classList.remove('hidden');
  document.getElementById('btn-robot').classList.add('active');
  showManttoList();
  loadManttos();
}

function closeManttoScreen() {
  document.getElementById('mantto-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('btn-robot').classList.remove('active');
}

function showManttoList() {
  document.getElementById('mantto-list-view').classList.remove('hidden');
  document.getElementById('mantto-detail-view').classList.add('hidden');
}

function showManttoDetail() {
  document.getElementById('mantto-list-view').classList.add('hidden');
  document.getElementById('mantto-detail-view').classList.remove('hidden');
}

async function loadManttos() {
  const tbody  = document.getElementById('mantto-tbody');
  const search = document.getElementById('mantto-search').value.trim();
  const estatus = document.querySelector('#mantto-estatus-pills .pill.active')?.dataset.estatus || '';

  tbody.innerHTML = `<tr class="row-loading"><td colspan="10"><span class="spinner"></span></td></tr>`;

  try {
    const params = new URLSearchParams();
    if (search)  params.set('search', search);
    if (estatus) params.set('estatus', estatus);
    allManttos = await api(`/api/mantenimiento/manttos?${params}`);
    renderManttos();
  } catch (e) {
    tbody.innerHTML = `<tr class="row-loading"><td colspan="10">Error: ${e.message}</td></tr>`;
  }
}

function renderManttos() {
  const tbody = document.getElementById('mantto-tbody');
  document.getElementById('mantto-count-label').textContent =
    `${allManttos.length} registro${allManttos.length !== 1 ? 's' : ''}`;

  if (!allManttos.length) {
    tbody.innerHTML = `<tr class="row-loading"><td colspan="10">Sin registros</td></tr>`;
    return;
  }

  tbody.innerHTML = allManttos.map(m => `
    <tr>
      <td style="white-space:nowrap">${m.FechaCreateMant || '--'}</td>
      <td>${m.CreadoPor || '--'}</td>
      <td><span class="rol-tag" style="background:#e8f4f7;color:var(--primary-dk)">${m.Tipo}</span></td>
      <td style="font-weight:600">${m.CodHer}</td>
      <td>${m.Version}</td>
      <td>${m.Pieza}</td>
      <td style="text-align:center">${m.Repeticion}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.Adicionales || '--'}</td>
      <td><span class="estatus-badge estatus-${m.Estatus}">${m.Estatus}</span></td>
      <td>
        <button class="btn-edit" title="Ver detalle" onclick="openManttoDetail(${m.IdManten})">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>
        </button>
      </td>
    </tr>
  `).join('');
}

async function openManttoDetail(id) {
  showManttoDetail();
  const content = document.getElementById('mantto-detail-content');
  content.innerHTML = `<div class="grid-loading"><span class="spinner"></span> Cargando detalle...</div>`;

  try {
    const m = await api(`/api/mantenimiento/manttos/${id}`);
    renderManttoDetail(m);
  } catch (e) {
    content.innerHTML = `<div class="grid-loading">Error: ${e.message}</div>`;
  }
}

function renderManttoDetail(m) {
  const img = m._img;
  const imgSrc = img && img.IdStorage && !img.IdStorage.startsWith('JTJ')
    ? `/static/${img.IdStorage}` : null;

  const claseLabel = {
    'MedidaTolerancia_Mantenimiento': 'Mediciones de Tolerancia',
    'EspesorPista_Mantenimiento':     'Espesor de Pista',
  };

  // Construir tablas de mediciones
  let medsSections = '';
  const byClase = m.details_by_clase || {};
  for (const [clase, items] of Object.entries(byClase)) {
    const label = claseLabel[clase] || clase.replace(/_/g, ' ');
    const sortedItems = [...items].sort((a, b) => a.IdMed - b.IdMed);
    const headers = sortedItems.map(d => `<th>${d.IdMed}</th>`).join('');
    const values  = sortedItems.map(d => `<td>${d.Value ?? '--'}</td>`).join('');

    medsSections += `
      <div class="meds-section">
        <div class="meds-section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          ${label}
        </div>
        <div class="meds-table-wrap">
          <table class="meds-table">
            <thead><tr><th>Punto</th>${headers}</tr></thead>
            <tbody><tr><td>Valor</td>${values}</tr></tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (!medsSections) {
    medsSections = `<div class="meds-section"><p style="color:var(--text-muted);font-size:13px">Sin mediciones registradas aún.</p></div>`;
  }

  document.getElementById('mantto-detail-content').innerHTML = `
    <!-- Status header -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
      <h2 style="font-size:22px;font-weight:800;color:var(--text);flex:1">
        ${m.Adicionales || 'Mantenimiento'} — ${m.Tipo}${m.CodHer}
      </h2>
      <span class="estatus-badge estatus-${m.Estatus}" style="font-size:13px;padding:5px 14px">${m.Estatus}</span>
    </div>

    <div class="detail-grid">
      <!-- Herramental -->
      <div class="detail-card">
        <div class="detail-card-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" stroke-width="2"/></svg>
          Detalle del Herramental
        </div>
        <div class="detail-row"><span class="detail-label">Tipo</span><span class="detail-value">${m.Tipo}</span></div>
        <div class="detail-row"><span class="detail-label">Código</span><span class="detail-value" style="font-weight:700">${m.CodHer}</span></div>
        <div class="detail-row"><span class="detail-label">Versión</span><span class="detail-value">${m.Version}</span></div>
        <div class="detail-row"><span class="detail-label">Pieza</span><span class="detail-value">${m.Pieza}</span></div>
        <div class="detail-row"><span class="detail-label">Repetición</span><span class="detail-value">${m.Repeticion}</span></div>
        ${img ? `<div class="detail-row"><span class="detail-label">Puntos tolerancia</span><span class="detail-value">${img.Cantidad_puntos ?? '--'}</span></div>` : ''}
        ${img ? `<div class="detail-row"><span class="detail-label">Puntos esp. pista</span><span class="detail-value">${img.Puntos_Esp_Pista ?? '--'}</span></div>` : ''}
      </div>

      <!-- Imagen -->
      <div class="detail-card">
        <div class="detail-card-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><polyline points="21,15 16,10 5,21" stroke="currentColor" stroke-width="2"/></svg>
          Imagen del Herramental
        </div>
        <div class="detail-img-box">
          ${imgSrc
            ? `<img src="${imgSrc}" alt="${m.Tipo}${m.CodHer}" />`
            : `<span class="no-img">Sin imagen registrada</span>`}
        </div>
        ${img ? `<p style="font-size:11px;color:var(--text-muted);text-align:center">${img.Nombre_Imagen}</p>` : ''}
      </div>

      <!-- Detalle mantenimiento -->
      <div class="detail-card">
        <div class="detail-card-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"/></svg>
          Detalle del Mantenimiento
        </div>
        <div class="detail-row"><span class="detail-label">Fecha creación</span><span class="detail-value">${m.FechaCreateMant || '--'}</span></div>
        <div class="detail-row"><span class="detail-label">Fecha liberación</span><span class="detail-value">${m.FechaReleaseMant || '--'}</span></div>
        <div class="detail-row"><span class="detail-label">Tipo mantenimiento</span><span class="detail-value">${m.TipoMant || '--'}</span></div>
        <div class="detail-row"><span class="detail-label">Estado de postes</span><span class="detail-value">${m.EstadoPostes || '--'}</span></div>
      </div>

      <!-- Entrega -->
      <div class="detail-card">
        <div class="detail-card-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/><path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" stroke-width="2"/><path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="2"/></svg>
          Detalle de Entrega
        </div>
        <div class="detail-row"><span class="detail-label">Creado por</span><span class="detail-value">${m.CreadoPor || '--'}</span></div>
        <div class="detail-row"><span class="detail-label">Entrega</span><span class="detail-value">${m.Entrega || '--'}</span></div>
        <div class="detail-row"><span class="detail-label">Recibe</span><span class="detail-value">${m.Recibe || '--'}</span></div>
        <div class="detail-row" style="flex-direction:column;gap:4px">
          <span class="detail-label">Observaciones</span>
          <span class="detail-value" style="margin-top:4px;line-height:1.6">${m.Observaciones || 'No registra'}</span>
        </div>
      </div>
    </div>

    ${medsSections}
  `;
}
