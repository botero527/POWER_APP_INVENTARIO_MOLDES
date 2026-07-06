/* ── STATE ─────────────────────────────────────────────── */
let currentUser = null;
let currentRol  = null;

// Retorna img solo si es específica para el molde (no wildcard XXXX en el código)
function isSpecificImg(img) {
  if (!img) return false;
  const parts = (img.Nombre_Imagen || '').split('|');
  return parts.length >= 2 && parts[1] !== 'XXXX' && parts[1] !== '';
}

function resolveImgSrc(idStorage) {
  if (!idStorage) return null;
  if (idStorage.startsWith('JTJ') || idStorage.startsWith('JTI')) return null;
  if (idStorage.startsWith('https://') || idStorage.startsWith('http://')) return idStorage;
  if (idStorage.startsWith('/')) return idStorage;
  return `/static/${idStorage}`;
}

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
  currentUser = me.username || me.UserName;
  currentRol  = me.rol     || me.Rol || '';
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('mantto-screen').classList.remove('hidden');
  document.getElementById('mant-username-label').textContent = currentUser;
  document.getElementById('mant-role-badge').textContent = currentRol;

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await api('/api/mantenimiento/logout', { method: 'POST' });
    location.reload();
  });

  bindRobot();
  bindBuscarHer();
  bindRecibeModal();
  loadManttos();
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
  ['buscar-tipo','buscar-cod','buscar-version','buscar-pieza','buscar-repeticion'].forEach(id => {
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
  window._buscarRows = [];
}

function bindBuscarHer() {
  document.getElementById('btn-close-buscar').addEventListener('click', closeBuscarHer);

  let deb;
  ['buscar-tipo','buscar-cod','buscar-version','buscar-pieza','buscar-repeticion'].forEach(id => {
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
  const tipo       = document.getElementById('buscar-tipo').value;
  const cod        = document.getElementById('buscar-cod').value.trim();
  const version    = document.getElementById('buscar-version').value.trim();
  const pieza      = document.getElementById('buscar-pieza').value.trim();
  const repeticion = document.getElementById('buscar-repeticion').value.trim();

  if (!tipo && !cod && !version && !pieza && !repeticion) {
    document.getElementById('buscar-tbody').innerHTML =
      `<tr class="row-loading"><td colspan="8">Escriba para buscar...</td></tr>`;
    return;
  }

  const tbody = document.getElementById('buscar-tbody');
  tbody.innerHTML = `<tr class="row-loading"><td colspan="7"><span class="spinner"></span></td></tr>`;

  const params = new URLSearchParams({ tipo, cod, version, pieza, repeticion });
  try {
    const rows = await api(`/api/mantenimiento/inventario-search?${params}`);
    if (!rows.length) {
      tbody.innerHTML = `<tr class="row-loading"><td colspan="7">Sin resultados</td></tr>`;
      return;
    }
    window._buscarRows = rows;
    tbody.innerHTML = rows.map((r, i) => `
      <tr onclick="seleccionarHer(${i})" style="cursor:pointer">
        <td><span class="rol-tag" style="background:#e8f4f7;color:var(--primary-dk)">${escapeHtml(r.Tipo)}</span></td>
        <td style="font-weight:700">${escapeHtml(r.CodMolde)}</td>
        <td>${escapeHtml(r.Version)}</td>
        <td>${escapeHtml(r.Pieza)}</td>
        <td>${escapeHtml(r.Vehiculo || '--')}</td>
        <td style="text-align:center">${escapeHtml(r.Repeticion)}</td>
        <td>${escapeHtml(r.Adicionales || r.Lote || '--')}</td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr class="row-loading"><td colspan="7">Error: ${e.message}</td></tr>`;
  }
}

async function seleccionarHer(idx) {
  const row = window._buscarRows && window._buscarRows[idx];
  if (!row) return;
  herSeleccionado = row;
  herSeleccionado._nextRep = row.Repeticion ?? '--';

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
      Repetición: ${row.Repeticion ?? '--'}
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
  const btnOrigHtml = btn.innerHTML;
  btn.disabled = true; btn.textContent = 'Creando...';

  const her = herSeleccionado;

  try {
    const res = await api('/api/mantenimiento/manttos', {
      method: 'POST',
      body: JSON.stringify({
        tipo:        her.Tipo,
        cod:         String(her.CodMolde),
        version:     String(her.Version || '000'),
        pieza:       String(her.Pieza   || '000'),
        adicionales: her.Adicionales || her.Lote || '',
      }),
    });

    if (!res.id) throw new Error('El servidor no devolvió ID del mantenimiento');

    manttoActivoId = res.id;
    document.getElementById('modal-confirmar-mantto').classList.add('hidden');
    herSeleccionado = her;
    herSeleccionado._nextRep = res.repeticion;
    await abrirFormMantto();
  } catch (e) {
    toast(e.message || 'Error al crear el mantenimiento', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = btnOrigHtml;
  }
}

/* ══════════════════════════════════════════════════════════
   FORMULARIO 4 PASOS
══════════════════════════════════════════════════════════ */

let currentStep = 1;
const TOTAL_STEPS = 3;

async function abrirFormMantto() {
  currentStep = 1;
  renderStepBar();
  showStepContent(1);
  document.getElementById('form-mantto-title').textContent =
    `${herSeleccionado.Tipo}${herSeleccionado.CodMolde} — Rep. ${herSeleccionado._nextRep}`;
  document.getElementById('modal-form-mantto').classList.remove('hidden');
  // Pre-cargar opciones dinamicas en paralelo con step1
  loadOpcionesDynamic();
  await loadStep1();
}

function closeFormMantto() {
  // Si hay un mantto activo pendiente, avisar que quedó guardado
  if (manttoActivoId) {
    toast('Mantenimiento guardado — puedes continuarlo desde la lista', 'info');
  }
  document.getElementById('modal-form-mantto').classList.add('hidden');
  manttoActivoId = null; imgConfig = null; herSeleccionado = null;
  recibeUsername = null; window._step2Data = null;
  currentStep = 1;
  const finBtn = document.getElementById('btn-confirmar-finalizar');
  if (finBtn) { finBtn.disabled = true; finBtn.classList.remove('pulse-once'); }
  // Resetear botón quien recibe
  const recibeBtn = document.getElementById('btn-set-recibe');
  if (recibeBtn) {
    recibeBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18" y1="8" x2="18" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="15" y1="11" x2="21" y2="11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Ingresar quien recibe`;
    recibeBtn.style.color = '';
    recibeBtn.style.borderColor = '';
  }
  // Resetear panel izquierdo quien recibe
  const confirmedEl = document.getElementById('step3-recibe-confirmed');
  const pendingEl   = document.getElementById('step3-recibe-pending');
  if (confirmedEl) confirmedEl.classList.add('hidden');
  if (pendingEl)   pendingEl.classList.remove('hidden');
  loadManttos();
}

async function resumeMantto(id) {
  try {
    const m = await api(`/api/mantenimiento/manttos/${id}`);
    manttoActivoId = id;
    recibeUsername = m.Recibe || null;

    // Reconstruir herSeleccionado con los datos del registro
    herSeleccionado = {
      Tipo:        m.Tipo,
      CodMolde:    m.CodHer,
      Version:     m.Version,
      Pieza:       m.Pieza,
      _nextRep:    m.Repeticion,
      Adicionales: m.Adicionales || '',
    };

    // Determinar en qué paso retomar
    let startStep = 1;
    if (m.TipoMant && m.EstadoPostes && m.PatronReferencia && m.Observaciones) startStep = 3;
    else if (m.TipoMant || m.EstadoPostes) startStep = 2;

    currentStep = startStep;
    renderStepBar();
    showStepContent(startStep);

    document.getElementById('form-mantto-title').textContent =
      `${m.Tipo}${m.CodHer} — Rep. ${m.Repeticion} (Continuando)`;
    document.getElementById('modal-form-mantto').classList.remove('hidden');

    // Cargar datos del paso correspondiente
    if (startStep === 1) {
      await loadStep1();
    } else if (startStep === 2) {
      window._step2Data = m;
      loadStep2();
      // También precargar imagen para paso 1 si vuelve
      api(`/api/mantenimiento/imagenes/buscar?tipo=${m.Tipo}&cod=${m.CodHer}&version=${normalizarCodImg(m.Version)}&pieza=${normalizarCodImg(m.Pieza)}`)
        .then(img => { imgConfig = img; }).catch(() => {});
    } else if (startStep === 3) {
      window._step2Data = m;
      await loadStep3();
    }

    toast('Continuando mantenimiento guardado', 'success');
  } catch (e) {
    toast('Error al cargar el mantenimiento: ' + e.message, 'error');
  }
}

function renderStepBar() {
  const nextBtn    = document.getElementById('btn-step-next');
  const finalizBtn = document.getElementById('btn-confirmar-finalizar');
  const recibeBtn  = document.getElementById('btn-set-recibe');
  if (currentStep === 3) {
    if (nextBtn) nextBtn.classList.add('hidden');
    if (finalizBtn) finalizBtn.classList.remove('hidden');
    if (recibeBtn) recibeBtn.classList.remove('hidden');
  } else {
    if (nextBtn) nextBtn.classList.remove('hidden');
    if (finalizBtn) finalizBtn.classList.add('hidden');
    if (recibeBtn) recibeBtn.classList.add('hidden');
  }

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
  if (nextBtn) nextBtn.innerHTML = `Siguiente <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><polyline points="9,18 15,12 9,6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
}

function showStepContent(n) {
  document.querySelectorAll('.step-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`step-content-${n}`).classList.add('active');
}

async function nextStep() {
  if (currentStep === 1) {
    // Validar que todos los campos tengan valor
    const empty = [...document.querySelectorAll('#subtab-ajuste .measure-input, #subtab-espesor .measure-input')]
      .filter(inp => inp.closest('.measure-list') && inp.value.trim() === '');
    if (empty.length) {
      toast(`Faltan ${empty.length} campo${empty.length > 1 ? 's' : ''} por llenar`, 'error');
      empty[0].closest('.measure-row').scrollIntoView({ behavior: 'smooth', block: 'center' });
      empty[0].focus();
      return;
    }
    const saved = await saveAllStep1();
    if (!saved) return;
    currentStep = 2;
    renderStepBar(); showStepContent(2);
    loadStep2();
  } else if (currentStep === 2) {
    const ok = await saveStep2();
    if (!ok) return;
    currentStep = 3;
    renderStepBar(); showStepContent(3);
    loadStep3(); // no await — la UI transiciona de inmediato, el resumen carga en background
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

/* ── PASO 2: MANTTO HER ──────────────────────────────────── */

// Definido fuera para que removeEventListener funcione (misma referencia)
function _step2AutoSave() {
  const label = document.getElementById('step2-save-status');
  clearTimeout(window._step2Deb);
  window._step2Deb = setTimeout(async () => {
    try {
      await api(`/api/mantenimiento/manttos/${manttoActivoId}`, {
        method: 'PUT',
        body: JSON.stringify({
          TipoMant:      document.getElementById('mant-tipo-mant').value,
          EstadoPostes:     document.getElementById('mant-estado-postes').value,
          PatronReferencia: document.getElementById('mant-patron-ref').value,
          Observaciones:    document.getElementById('mant-observaciones').value,
        }),
      });
      if (label) { label.textContent = '✓ Guardado automáticamente'; setTimeout(() => label.textContent = '', 2000); }
    } catch { if (label) label.textContent = 'Error al guardar'; }
  }, 600);
}

async function loadStep2() {
  // Cargar opciones dinamicas primero para que los selects tengan opciones
  // antes de restaurar los valores guardados
  try {
    await loadOpcionesDynamic();
  } catch {
    return; // el toast ya se mostro en loadOpcionesDynamic
  }

  // Restaurar valores guardados si los hay
  if (window._step2Data) {
    document.getElementById('mant-tipo-mant').value     = window._step2Data.TipoMant || '';
    document.getElementById('mant-estado-postes').value = window._step2Data.EstadoPostes || '';
    document.getElementById('mant-patron-ref').value    = window._step2Data.PatronReferencia || '';
    document.getElementById('mant-observaciones').value = window._step2Data.Observaciones || '';
  }

  // Quitar listeners previos antes de volver a agregar (evita duplicados)
  ['mant-tipo-mant','mant-estado-postes','mant-patron-ref','mant-observaciones'].forEach(id => {
    const el = document.getElementById(id);
    el.removeEventListener('input', _step2AutoSave);
    el.removeEventListener('change', _step2AutoSave);
    el.addEventListener('input', _step2AutoSave);
    el.addEventListener('change', _step2AutoSave);
  });
}

async function saveStep2() {
  clearTimeout(window._step2Deb);
  const tipo   = document.getElementById('mant-tipo-mant').value;
  const estado = document.getElementById('mant-estado-postes').value;
  const patron = document.getElementById('mant-patron-ref').value;
  const obs    = document.getElementById('mant-observaciones').value.trim();
  if (!tipo || !estado || !patron || !obs) {
    toast('Todos los campos del paso 2 son obligatorios', 'error');
    return false;
  }
  try {
    await api(`/api/mantenimiento/manttos/${manttoActivoId}`, {
      method: 'PUT',
      body: JSON.stringify({ TipoMant: tipo, EstadoPostes: estado, PatronReferencia: patron, Observaciones: obs }),
    });
    window._step2Data = { ...(window._step2Data || {}), TipoMant: tipo, EstadoPostes: estado, PatronReferencia: patron, Observaciones: obs };
    return true;
  } catch (e) {
    toast(e.message, 'error');
    return false;
  }
}

/* ── PASO 3: RESUMEN ─────────────────────────────────────── */

let recibeUsername = null;

async function loadStep3() {
  const her = herSeleccionado;

  // Datos básicos
  document.getElementById('step3-basic-data').innerHTML = `
    <div style="font-size:13px;line-height:2;color:var(--text)">
      <div><b>Tipo:</b> ${her.Tipo}</div>
      <div><b>Código:</b> ${her.CodMolde}</div>
      <div><b>Versión:</b> ${her.Version}</div>
      <div><b>Pieza:</b> ${her.Pieza}</div>
      <div><b>Repetición:</b> ${her._nextRep}</div>
    </div>`;

  // Quien entrega = usuario de sesión (se guarda ahora)
  const entregaName = (document.getElementById('mant-username-label')?.textContent || '').trim();
  document.getElementById('step3-entrega-name').textContent = entregaName;
  if (entregaName) {
    await api(`/api/mantenimiento/manttos/${manttoActivoId}`, {
      method: 'PUT', body: JSON.stringify({ Entrega: entregaName }),
    }).catch(() => {});
  }

  // Cargar detalle completo en panel derecho
  const panel = document.getElementById('step3-detail-panel');
  try {
    const m = await api(`/api/mantenimiento/manttos/${manttoActivoId}`);
    window._step2Data = m; // guardar para si vuelve al paso 2
    panel.innerHTML = buildResumenHTML(m);
  } catch (e) {
    panel.innerHTML = `<p style="color:var(--text-muted)">Error cargando resumen: ${e.message}</p>`;
  }
}

function buildResumenHTML(m) {
  const img = m._img || null;
  const imgSrc = img ? resolveImgSrc(img.IdStorage) : null;

  const byClase = m.details_by_clase || {};
  const espesorItems    = byClase['EspesorPista_Mantenimiento'] || [];
  const toleranciaItems = byClase['MedidaTolerancia_Mantenimiento'] || [];

  function buildTable(items) {
    const sorted  = [...items].sort((a, b) => a.IdMed - b.IdMed);
    const headers = sorted.map(d => `<th>${d.IdMed}</th>`).join('');
    const vals    = sorted.map(d => `<td>${d.Value ?? '--'}</td>`).join('');
    return `<table class="meds-table"><thead><tr><th>Punto</th>${headers}</tr></thead><tbody><tr><td>Valor</td>${vals}</tr></tbody></table>`;
  }

  // Fila superior: imagen izquierda + espesor derecha
  const imgBlock = imgSrc ? `
    <div class="resumen-img-wrap" onclick="openImgLightbox('${imgSrc}')" title="Click para ampliar">
      <img src="${imgSrc}" class="resumen-img" />
      <div class="resumen-img-zoom"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg></div>
    </div>` : `
    <div class="resumen-img-wrap resumen-img-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--border)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
      <span style="font-size:11px;color:var(--text-muted);margin-top:6px">Sin imagen</span>
    </div>`;

  const espesorBlock = espesorItems.length ? `
    <div class="meds-section" style="flex:1;min-width:0">
      <div class="meds-section-title">Espesor de Pista</div>
      <div class="meds-table-wrap">${buildTable(espesorItems)}</div>
    </div>` : '';

  const toleranciaBlock = toleranciaItems.length ? `
    <div class="meds-section" style="margin-top:14px">
      <div class="meds-section-title">Mediciones de Tolerancia</div>
      <div class="meds-table-wrap">${buildTable(toleranciaItems)}</div>
    </div>` : '';

  const noMeds = !espesorItems.length && !toleranciaItems.length
    ? '<p style="color:var(--text-muted);font-size:13px;margin-top:8px">Sin mediciones registradas.</p>' : '';

  return `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
      <h3 style="font-size:18px;font-weight:800;flex:1">Herramental a Liberar</h3>
      <span class="estatus-badge estatus-${m.Estatus}">${m.Estatus}</span>
    </div>
    <div class="resumen-top-row">
      ${imgBlock}
      ${espesorBlock}
    </div>
    ${toleranciaBlock}
    ${noMeds}
    <div class="detail-card" style="margin-top:16px">
      <div class="detail-card-title">Detalle del Mantenimiento</div>
      <div class="detail-row"><span class="detail-label">Tipo mantenimiento</span><span class="detail-value">${escapeHtml(m.TipoMant || '--')}</span></div>
      <div class="detail-row"><span class="detail-label">Estado de postes</span><span class="detail-value">${escapeHtml(m.EstadoPostes || '--')}</span></div>
      <div class="detail-row"><span class="detail-label">Patrón de referencia</span><span class="detail-value">${escapeHtml(m.PatronReferencia || '--')}</span></div>
      <div class="detail-row"><span class="detail-label">Observaciones</span><span class="detail-value">${escapeHtml(m.Observaciones || 'No registra')}</span></div>
    </div>`;
}

function openImgLightbox(src) {
  let ov = document.getElementById('img-lightbox-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'img-lightbox-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;cursor:zoom-out';
    ov.innerHTML = '<img id="img-lightbox-img" style="max-width:90vw;max-height:90vh;object-fit:contain;border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,.6)" />';
    ov.addEventListener('click', () => ov.remove());
    document.body.appendChild(ov);
  }
  document.getElementById('img-lightbox-img').src = src;
  ov.style.display = 'flex';
}

function bindRecibeModal() {
  document.getElementById('btn-set-recibe').addEventListener('click', openRecibeModal);
  document.getElementById('btn-close-recibe').addEventListener('click', closeRecibeModal);
  document.getElementById('btn-cancel-recibe').addEventListener('click', closeRecibeModal);
  document.getElementById('btn-confirm-recibe').addEventListener('click', confirmarRecibe);
  document.getElementById('btn-toggle-recibe-pw').addEventListener('click', () => {
    const inp = document.getElementById('recibe-password');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('btn-confirmar-finalizar').addEventListener('click', openConfirmarFinalizar);
  document.getElementById('btn-cancel-confirm-finalizar').addEventListener('click', closeConfirmarFinalizar);
  document.getElementById('btn-ok-confirm-finalizar').addEventListener('click', finalizarMantto);
}

function openConfirmarFinalizar() {
  const her = herSeleccionado;
  document.getElementById('confirm-finalizar-resumen').innerHTML = `
    <div style="display:grid;gap:6px">
      <div><b>Herramental:</b> ${her.Tipo}${her.CodMolde} — V${her.Version} P${her.Pieza}</div>
      <div><b>Repetición:</b> #${her._nextRep}</div>
      <div><b>Entrega:</b> ${document.getElementById('step3-entrega-name')?.textContent || '—'}</div>
      <div><b>Recibe:</b> ${recibeUsername || '—'}</div>
    </div>`;
  document.getElementById('modal-confirm-finalizar').classList.remove('hidden');
}

function closeConfirmarFinalizar() {
  document.getElementById('modal-confirm-finalizar').classList.add('hidden');
}

async function openRecibeModal() {
  document.getElementById('recibe-error').classList.add('hidden');
  document.getElementById('recibe-password').value = '';
  const sel = document.getElementById('recibe-user-select');
  if (sel.options.length <= 1) {
    const users = await api('/api/mantenimiento/usuarios');
    users.forEach(u => sel.insertAdjacentHTML('beforeend',
      `<option value="${u.UserName}">${u.UserName}</option>`));
  }
  document.getElementById('modal-recibe').classList.remove('hidden');
}

function closeRecibeModal() {
  document.getElementById('modal-recibe').classList.add('hidden');
}

async function confirmarRecibe() {
  const username = document.getElementById('recibe-user-select').value;
  const password = document.getElementById('recibe-password').value;
  const errEl    = document.getElementById('recibe-error');
  errEl.classList.add('hidden');

  if (!username || !password) {
    errEl.textContent = 'Selecciona un usuario e ingresa la contraseña.';
    errEl.classList.remove('hidden'); return;
  }

  const btn = document.getElementById('btn-confirm-recibe');
  btn.disabled = true;

  try {
    await api('/api/mantenimiento/verify-user', {
      method: 'POST', body: JSON.stringify({ username, password }),
    });
    recibeUsername = username;

    // Guardar en BD
    await api(`/api/mantenimiento/manttos/${manttoActivoId}`, {
      method: 'PUT', body: JSON.stringify({ Recibe: username }),
    });

    // Actualizar panel izquierdo
    const confirmedEl = document.getElementById('step3-recibe-confirmed');
    const pendingEl   = document.getElementById('step3-recibe-pending');
    const nameEl      = document.getElementById('step3-recibe-name');
    if (nameEl) nameEl.textContent = username;
    if (confirmedEl) confirmedEl.classList.remove('hidden');
    if (pendingEl)   pendingEl.classList.add('hidden');

    // Cambiar botón del footer a "confirmado"
    const recibeBtn = document.getElementById('btn-set-recibe');
    if (recibeBtn) {
      recibeBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <polyline points="9 12 11 14 15 10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
        ${username}`;
      recibeBtn.style.color = 'var(--success)';
      recibeBtn.style.borderColor = 'var(--success)';
    }

    closeRecibeModal();
    toast(`${username} confirmado como receptor`, 'success');
    // Habilitar botón confirmar y finalizar
    const finBtn = document.getElementById('btn-confirmar-finalizar');
    if (finBtn) { finBtn.disabled = false; finBtn.classList.add('pulse-once'); }
  } catch {
    errEl.textContent = 'Usuario o contraseña incorrectos.';
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
  }
}

/* ── PASO 4: FINALIZAR ────────────────────────────────────── */

function loadStep4() {
  const her = herSeleccionado;
  document.getElementById('step4-resumen').innerHTML = `
    <div class="confirm-her-card">
      <div class="confirm-row"><span class="confirm-label">Herramental</span><span class="confirm-value">${her.Tipo}${her.CodMolde} — V${her.Version} P${her.Pieza}</span></div>
      <div class="confirm-row"><span class="confirm-label">Repetición</span><span class="confirm-value">#${her._nextRep}</span></div>
      <div class="confirm-row"><span class="confirm-label">Entrega</span><span class="confirm-value">${document.getElementById('step3-entrega-name')?.textContent || '—'}</span></div>
      <div class="confirm-row"><span class="confirm-label">Recibe</span><span class="confirm-value">${recibeUsername || '⚠️ Sin confirmar'}</span></div>
    </div>`;
}

async function finalizarMantto() {
  const btn = document.getElementById('btn-ok-confirm-finalizar');
  if (btn) btn.disabled = true;
  try {
    await api(`/api/mantenimiento/manttos/${manttoActivoId}`, {
      method: 'PUT',
      body: JSON.stringify({ Estatus: 'Finalizado' }),
    });
    closeConfirmarFinalizar();
    closeFormMantto();
    toast('¡Mantenimiento finalizado correctamente!', 'success');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ── PASO 1: INGRESO HER ─────────────────────────────────── */

// Normaliza version/pieza al formato de la tabla Imagenes (3 dígitos, fallback '000')
function normalizarCodImg(val) {
  if (!val || val === 'XXX' || val === 'XXXX') return '000';
  const n = parseInt(val, 10);
  return isNaN(n) ? '000' : String(n).padStart(3, '0');
}

async function loadStep1() {
  const her = herSeleccionado;
  if (!her) return;

  const imgParams = new URLSearchParams({
    tipo:    her.Tipo,
    cod:     her.CodMolde,
    version: normalizarCodImg(her.Version),
    pieza:   normalizarCodImg(her.Pieza),
  });

  // Imagen y detalles existentes en paralelo
  const [imgResult, detailResult] = await Promise.allSettled([
    api(`/api/mantenimiento/imagenes/buscar?${imgParams}`),
    manttoActivoId ? api(`/api/mantenimiento/manttos/${manttoActivoId}`) : Promise.resolve(null),
  ]);

  imgConfig = imgResult.status === 'fulfilled' ? imgResult.value : null;
  if (imgResult.status === 'rejected' && !imgResult.reason?.message?.includes('404'))
    console.warn('buscar imagen:', imgResult.reason?.message);

  renderStep1Image();
  renderAjusteInputs();
  renderEspesorInputs();

  // Poblar valores ya guardados (del fetch paralelo, sin segunda llamada)
  if (detailResult.status === 'fulfilled' && detailResult.value) {
    const byClase = detailResult.value.details_by_clase || {};
    const ajuste  = byClase['MedidaTolerancia_Mantenimiento'] || [];
    const espesor = byClase['EspesorPista_Mantenimiento'] || [];
    ajuste.forEach(d  => setFieldSaved('ajuste',  d.IdMed, d.Value));
    espesor.forEach(d => setFieldSaved('espesor', d.IdMed, d.Value));
    // Guardar cache para paso 2 también
    if (!window._step2Data) window._step2Data = detailResult.value;
  }
}

function renderStep1Image() {
  const box  = document.getElementById('step1-img-box');
  const info = document.getElementById('step1-img-info');
  const step1Src = resolveImgSrc(imgConfig?.IdStorage);
  if (step1Src) {
    box.innerHTML = `<img src="${step1Src}" alt="Herramental" />`;
    info.textContent = imgConfig.Nombre_Imagen || '';
  } else {
    box.innerHTML = `<span class="no-img" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">Sin imagen registrada para este herramental</span>`;
    info.textContent = '';
  }
}

function _measureRowHtml(prefix, idMed, clase) {
  return `
    <div class="measure-row" id="row-${prefix}-${idMed}">
      <div class="measure-point" id="dot-${prefix}-${idMed}">${idMed}</div>
      <span class="measure-label">Punto ${idMed}</span>
      <input class="measure-input" type="text" inputmode="decimal"
        id="inp-${prefix}-${idMed}" placeholder="—"
        oninput="onMeasureChange('${prefix}', ${idMed})"
        onkeydown="onMeasureKeydown(event, '${prefix}', ${idMed}, '${clase}')" />
      <button class="measure-action-btn" id="btn-${prefix}-${idMed}"
        title="Guardar" onclick="saveSingleMeasure('${prefix}', ${idMed}, '${clase}')">
        <svg class="icon-check" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <svg class="icon-pencil" width="15" height="15" viewBox="0 0 24 24" fill="none" style="display:none">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>`;
}

// Auto-decimal: "15" → "1.5", "150" → "1.50", "1.5" → "1.5" (ya tiene punto, no tocar)
function autoDecimal(raw) {
  const s = String(raw).trim();
  if (!s) return '';
  if (s.includes('.')) return s;           // ya tiene punto manual
  if (s.length === 1) return s;            // solo un dígito, esperar más
  return s[0] + '.' + s.slice(1);         // primer dígito + punto + resto
}

function onMeasureKeydown(e, prefix, idMed, clase) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const inp = document.getElementById(`inp-${prefix}-${idMed}`);
    if (!inp.value.trim()) return;
    // Marcar visualmente como llenado (sin llamar API — se guarda en batch al Siguiente)
    setFieldSaved(prefix, idMed, null);
    // Saltar al siguiente campo sin guardar aún
    const subtabId = prefix === 'ajuste' ? 'subtab-ajuste' : 'subtab-espesor';
    const allInputs = [...document.querySelectorAll(`#${subtabId} .measure-input`)];
    const idx = allInputs.findIndex(el => el === inp);
    const next = allInputs[idx + 1];
    if (next) {
      setFieldEditing(prefix, parseInt(next.id.replace(`inp-${prefix}-`, ''), 10));
    }
  }
}

function updateProgress(prefix) {
  const rows = [...document.querySelectorAll(`[id^="row-${prefix}-"]`)];
  const total = rows.length;
  const done  = rows.filter(r => r.classList.contains('saved-row')).length;
  const pct   = total ? Math.round(done / total * 100) : 0;
  const textEl = document.getElementById(`${prefix}-progress-text`);
  const fillEl = document.getElementById(`${prefix}-progress-fill`);
  if (textEl) textEl.textContent = `${done} / ${total}`;
  if (fillEl) fillEl.style.width = `${pct}%`;
}

function renderAjusteInputs() {
  const container = document.getElementById('ajuste-inputs');
  const total = parseInt(imgConfig?.Cantidad_puntos, 10) || 0;

  if (total <= 0) {
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
    html += _measureRowHtml('ajuste', i, 'MedidaTolerancia_Mantenimiento');
  }
  container.innerHTML = html;
  updateProgress('ajuste');
  // Foco en el primer campo al abrir
  setTimeout(() => document.getElementById('inp-ajuste-1')?.focus(), 100);
}

function renderEspesorInputs() {
  const container = document.getElementById('espesor-inputs');
  const puntosRaw = imgConfig?.Puntos_Esp_Pista || '';
  const puntos = [...new Set(
    puntosRaw.split(',').map(p => p.trim()).filter(p => p !== '' && !isNaN(p)).map(Number)
  )];

  if (!puntos.length) {
    container.innerHTML = `<p style="padding:16px;font-size:13px;color:var(--text-muted)">
      No hay puntos de espesor de pista configurados para este herramental.</p>`;
    return;
  }
  let html = '';
  puntos.forEach(p => {
    html += _measureRowHtml('espesor', p, 'EspesorPista_Mantenimiento');
  });
  container.innerHTML = html;
  updateProgress('espesor');
}

async function loadExistingDetails() {
  if (!manttoActivoId) return;
  try {
    const mantto = await api(`/api/mantenimiento/manttos/${manttoActivoId}`);
    const byClase = mantto.details_by_clase || {};
    const ajuste  = byClase['MedidaTolerancia_Mantenimiento'] || [];
    const espesor = byClase['EspesorPista_Mantenimiento'] || [];
    ajuste.forEach(d  => setFieldSaved('ajuste',  d.IdMed, d.Value));
    espesor.forEach(d => setFieldSaved('espesor', d.IdMed, d.Value));
  } catch { /* sin datos existentes */ }
}

// Cuando escribe: muestra fila activa
function onMeasureChange(prefix, idMed) {
  const inp = document.getElementById(`inp-${prefix}-${idMed}`);
  const dot = document.getElementById(`dot-${prefix}-${idMed}`);
  const row = document.getElementById(`row-${prefix}-${idMed}`);
  const btn = document.getElementById(`btn-${prefix}-${idMed}`);

  // 1. Reemplazar coma por punto
  let val = inp.value.replace(',', '.');
  // 2. Quitar todo lo que no sea dígito o punto (guiones, letras, espacios, etc.)
  val = val.replace(/[^0-9.]/g, '');
  // 3. Solo permitir un punto decimal — si hay más, quitar los sobrantes
  const parts = val.split('.');
  if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
  // Actualizar el campo solo si cambió (evita mover el cursor innecesariamente)
  if (inp.value !== val) {
    inp.value = val;
    inp.setSelectionRange(val.length, val.length);
  }
  // 4. Aplicar auto-decimal mientras escribe (solo si no tiene punto aún)
  const raw = inp.value;
  if (raw && !raw.includes('.') && raw.length >= 2) {
    const converted = autoDecimal(raw);
    if (converted !== raw) {
      inp.value = converted;
      inp.setSelectionRange(converted.length, converted.length);
    }
  }

  inp.classList.remove('saved');
  if (row) { row.classList.remove('saved-row'); row.classList.add('active-row'); }
  if (dot) { dot.classList.remove('saved', 'active'); dot.classList.add('active'); }
  if (btn) {
    btn.classList.remove('btn-edit-mode');
    btn.querySelector('.icon-check').style.display = '';
    btn.querySelector('.icon-pencil').style.display = 'none';
    btn.title = 'Guardar';
  }
}

// Estado visual: guardado (muestra lápiz, input readonly)
function setFieldSaved(prefix, idMed, value) {
  const inp = document.getElementById(`inp-${prefix}-${idMed}`);
  const dot = document.getElementById(`dot-${prefix}-${idMed}`);
  const row = document.getElementById(`row-${prefix}-${idMed}`);
  const btn = document.getElementById(`btn-${prefix}-${idMed}`);
  if (!inp) return;
  if (value !== null && value !== undefined) inp.value = value;
  inp.classList.add('saved');
  inp.readOnly = true;
  if (row) { row.classList.remove('active-row'); row.classList.add('saved-row'); }
  if (dot) { dot.classList.remove('active'); dot.classList.add('saved'); }
  if (btn) {
    btn.classList.add('btn-edit-mode');
    btn.querySelector('.icon-check').style.display = 'none';
    btn.querySelector('.icon-pencil').style.display = '';
    btn.title = 'Editar';
    btn.onclick = () => setFieldEditing(prefix, idMed);
  }
  updateProgress(prefix);
}

// Vuelve el campo a modo edición (click en lápiz)
function setFieldEditing(prefix, idMed) {
  const clase = prefix === 'ajuste' ? 'MedidaTolerancia_Mantenimiento' : 'EspesorPista_Mantenimiento';
  const inp = document.getElementById(`inp-${prefix}-${idMed}`);
  const row = document.getElementById(`row-${prefix}-${idMed}`);
  const dot = document.getElementById(`dot-${prefix}-${idMed}`);
  const btn = document.getElementById(`btn-${prefix}-${idMed}`);
  if (!inp) return;
  inp.readOnly = false;
  inp.classList.remove('saved');
  if (row) { row.classList.remove('saved-row'); row.classList.add('active-row'); }
  if (dot) { dot.classList.remove('saved'); dot.classList.add('active'); }
  inp.focus();
  inp.select();
  if (btn) {
    btn.classList.remove('btn-edit-mode');
    btn.querySelector('.icon-check').style.display = '';
    btn.querySelector('.icon-pencil').style.display = 'none';
    btn.title = 'Guardar';
    btn.onclick = () => saveSingleMeasure(prefix, idMed, clase);
  }
  updateProgress(prefix);
}

// Guarda UN campo individualmente
async function saveSingleMeasure(prefix, idMed, clase, advance = false) {
  if (!manttoActivoId) return;
  const inp = document.getElementById(`inp-${prefix}-${idMed}`);
  const raw = inp.value.trim();
  if (!raw) { toast('Ingresa un valor', 'error'); return; }
  const value = parseFloat(raw);
  if (isNaN(value)) { toast('Ingresa un valor numérico', 'error'); return; }

  const btn = document.getElementById(`btn-${prefix}-${idMed}`);
  if (btn) btn.disabled = true;
  try {
    await api(`/api/mantenimiento/manttos/${manttoActivoId}/detail`, {
      method: 'PUT',
      body: JSON.stringify({ id_med: idMed, clase, value }),
    });
    setFieldSaved(prefix, idMed, null);
  } catch {
    toast('Error al guardar el campo', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Guarda en batch TODOS los campos con valor (incluyendo los marcados visualmente con Enter)
async function saveStep1Batch(clase) {
  if (!manttoActivoId) return true;
  const prefix = clase === 'MedidaTolerancia_Mantenimiento' ? 'ajuste' : 'espesor';
  const inputs = [...document.querySelectorAll(`[id^="inp-${prefix}-"]`)]
    .filter(inp => inp.value.trim() !== '');

  if (!inputs.length) return true;

  const items = inputs.map(inp => ({
    id_med: parseInt(inp.id.replace(`inp-${prefix}-`, ''), 10),
    clase,
    value:  parseFloat(inp.value) || 0,
  }));

  try {
    await api(`/api/mantenimiento/manttos/${manttoActivoId}/details/batch`, {
      method: 'PUT',
      body: JSON.stringify({ items }),
    });
    items.forEach(item => setFieldSaved(prefix, item.id_med, null));
    return true;
  } catch {
    toast('Error al guardar. Intenta de nuevo.', 'error');
    return false;
  }
}

// Guarda AMBAS clases en una sola llamada — llamado desde Siguiente paso 1
async function saveAllStep1() {
  if (!manttoActivoId) return true;
  const label = document.getElementById('step-auto-save-label');
  if (label) label.textContent = 'Guardando...';

  const clases = [
    { prefix: 'ajuste',  clase: 'MedidaTolerancia_Mantenimiento' },
    { prefix: 'espesor', clase: 'EspesorPista_Mantenimiento' },
  ];
  const items = clases.flatMap(({ prefix, clase }) =>
    [...document.querySelectorAll(`[id^="inp-${prefix}-"]`)]
      .filter(inp => inp.value.trim() !== '')
      .map(inp => ({
        id_med: parseInt(inp.id.replace(`inp-${prefix}-`, ''), 10),
        clase,
        value:  parseFloat(inp.value) || 0,
      }))
  );

  if (!items.length) {
    if (label) label.textContent = '';
    return true;
  }

  try {
    await api(`/api/mantenimiento/manttos/${manttoActivoId}/details/batch`, {
      method: 'PUT',
      body: JSON.stringify({ items }),
    });
    clases.forEach(({ prefix, clase }) => {
      items.filter(i => i.clase === clase).forEach(i => setFieldSaved(prefix, i.id_med, null));
    });
    if (label) { label.textContent = '✓ Todo guardado'; setTimeout(() => { if (label) label.textContent = ''; }, 2500); }
    return true;
  } catch {
    toast('Error al guardar. Intenta de nuevo.', 'error');
    if (label) label.textContent = 'Error al guardar';
    return false;
  }
}

/* ══════════════════════════════════════════════════════════
   MÓDULO MANTENIMIENTOS (ROBOT)
══════════════════════════════════════════════════════════ */

let allManttos  = [];
let manttoOffset = 0;
let manttoTotal  = 0;

function bindRobot() {
  document.getElementById('btn-back-detail').addEventListener('click', showManttoList);
  document.getElementById('btn-mantto-add').addEventListener('click', openBuscarHer);

  // Búsqueda con debounce
  let deb;
  document.getElementById('mantto-search').addEventListener('input', () => {
    clearTimeout(deb); deb = setTimeout(loadManttos, 350);
  });

  // Modal cancelar mantto
  document.getElementById('btn-close-cancel-mantto').addEventListener('click', closeCancelMantto);
  document.getElementById('btn-cancel-cancel-mantto').addEventListener('click', closeCancelMantto);
  document.getElementById('btn-confirm-cancel-mantto').addEventListener('click', confirmCancelMantto);

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
  showManttoList();
  loadManttos();
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
  manttoOffset = 0;
  allManttos   = [];
  const tbody = document.getElementById('mantto-tbody');
  tbody.innerHTML = `<tr class="row-loading"><td colspan="10"><span class="spinner"></span></td></tr>`;
  updateManttoLoadMore(false, true);
  try {
    const res = await fetchManttoPage(0);
    manttoOffset = res.data.length;
    manttoTotal  = res.total;
    allManttos   = res.data;
    renderManttos(false);
    updateManttoFooter(res);
  } catch (e) {
    tbody.innerHTML = `<tr class="row-loading"><td colspan="10">Error: ${e.message}</td></tr>`;
  }
}

async function loadMoreManttos() {
  updateManttoLoadMore(true, true);
  try {
    const res = await fetchManttoPage(manttoOffset);
    manttoOffset += res.data.length;
    allManttos = allManttos.concat(res.data);
    appendManttoRows(res.data);
    updateManttoFooter(res);
  } catch (e) {
    toast(e.message, 'error');
    updateManttoLoadMore(false, true);
  }
}

async function fetchManttoPage(offset) {
  const search  = document.getElementById('mantto-search').value.trim();
  const estatus = document.querySelector('#mantto-estatus-pills .pill.active')?.dataset.estatus || '';
  const params  = new URLSearchParams({ offset });
  if (search)  params.set('search', search);
  if (estatus) params.set('estatus', estatus);
  return api(`/api/mantenimiento/manttos?${params}`);
}

function updateManttoFooter(res) {
  const label = document.getElementById('mantto-count-label');
  if (!label) return;
  const showing = Math.min(manttoOffset, res.total);
  label.textContent = res.has_more
    ? `Mostrando ${showing.toLocaleString()} de ${res.total.toLocaleString()}`
    : `${res.total.toLocaleString()} registro${res.total !== 1 ? 's' : ''}`;
  updateManttoLoadMore(false, res.has_more);
}

function updateManttoLoadMore(loading, visible) {
  const btn = document.getElementById('btn-mantto-load-more');
  if (!btn) return;
  btn.style.display = visible ? '' : 'none';
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spinner"></span> Cargando...'
    : 'Cargar más registros';
}

function manttoRowHtml(m) {
  return `
    <tr>
      <td style="white-space:nowrap">${escapeHtml(m.FechaCreateMant || '--')}</td>
      <td>${escapeHtml(m.CreadoPor || '--')}</td>
      <td><span class="rol-tag" style="background:#e8f4f7;color:var(--primary-dk)">${escapeHtml(m.Tipo)}</span></td>
      <td style="font-weight:600">${escapeHtml(m.CodHer)}</td>
      <td>${escapeHtml(m.Version)}</td>
      <td>${escapeHtml(m.Pieza)}</td>
      <td style="text-align:center">${escapeHtml(m.Repeticion)}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(m.Adicionales || '--')}</td>
      <td><span class="estatus-badge estatus-${escapeHtml(m.Estatus)}">${escapeHtml(m.Estatus)}</span></td>
      <td>
        <div style="display:flex;gap:4px">
          ${m.Estatus === 'Pendiente' && (m.CreadoPor === currentUser || currentRol === 'Admin') ? `
          <button class="btn-edit" title="Continuar llenando" style="color:var(--primary)"
            onclick="resumeMantto(${m.IdManten})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg>
          </button>
          <button class="btn-edit" title="Cancelar mantenimiento" style="color:var(--danger)"
            onclick="handleCancelMantto(${m.IdManten},'${escapeHtml(m.Tipo)}${escapeHtml(m.CodHer)} Rep.${escapeHtml(String(m.Repeticion))}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2"/>
              <path d="M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2"/>
              <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>` : ''}
          <button class="btn-edit" title="Ver detalle" onclick="openManttoDetail(${m.IdManten})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
}

function appendManttoRows(rows) {
  const frag = document.createDocumentFragment();
  const tmp  = document.createElement('tbody');
  tmp.innerHTML = rows.map(manttoRowHtml).join('');
  while (tmp.firstChild) frag.appendChild(tmp.firstChild);
  document.getElementById('mantto-tbody').appendChild(frag);
}

function renderManttos(append) {
  const tbody = document.getElementById('mantto-tbody');
  if (!allManttos.length) {
    tbody.innerHTML = `<tr class="row-loading"><td colspan="10">Sin registros</td></tr>`;
    return;
  }
  if (append) { appendManttoRows(allManttos); return; }
  tbody.innerHTML = allManttos.map(manttoRowHtml).join('');
}

/* ── CANCELAR MANTTO ─────────────────────────────────────── */
let cancelManttoTarget = null;

function handleCancelMantto(id, label) {
  cancelManttoTarget = id;
  document.getElementById('cancel-mantto-info').innerHTML =
    `<strong>Mantenimiento a cancelar:</strong> ${escapeHtml(label)}`;
  document.getElementById('cancel-mantto-motivo').value = '';
  document.getElementById('cancel-mantto-error').classList.add('hidden');
  document.getElementById('modal-cancel-mantto').classList.remove('hidden');
  setTimeout(() => document.getElementById('cancel-mantto-motivo').focus(), 50);
}

function closeCancelMantto() {
  document.getElementById('modal-cancel-mantto').classList.add('hidden');
  cancelManttoTarget = null;
}

async function confirmCancelMantto() {
  if (!cancelManttoTarget) return;
  const motivo = document.getElementById('cancel-mantto-motivo').value.trim();
  const errEl  = document.getElementById('cancel-mantto-error');
  if (!motivo) {
    errEl.textContent = 'El motivo es obligatorio.';
    errEl.classList.remove('hidden');
    return;
  }
  const btn = document.getElementById('btn-confirm-cancel-mantto');
  btn.disabled = true;
  btn.textContent = 'Cancelando...';
  try {
    await api(`/api/mantenimiento/manttos/${cancelManttoTarget}`, {
      method: 'DELETE',
      body: JSON.stringify({ motivo }),
    });
    closeCancelMantto();
    toast('Mantenimiento cancelado', 'success');
    loadManttos();
  } catch (e) {
    errEl.textContent = e.message || 'Error al cancelar';
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Cancelar mantenimiento';
  }
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
  const img = m._img || null;
  const imgSrc = img ? resolveImgSrc(img.IdStorage) : null;

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

/* ── OPCIONES DINAMICAS (dropdowns desde BD) ───────────────── */
async function loadOpcionesDynamic() {
  const TTL = 5 * 60 * 1000; // 5 minutos
  if (window._opcionesCache && window._opcionesCacheTime && (Date.now() - window._opcionesCacheTime < TTL)) return;
  try {
    const data = await api('/api/mantenimiento/opciones');
    window._opcionesCache = data;
    window._opcionesCacheTime = Date.now();
    populateSelect('mant-tipo-mant',     (data['tipo_mant']     && data['tipo_mant'].options)     || []);
    populateSelect('mant-estado-postes', (data['estado_postes'] && data['estado_postes'].options) || []);
    populateSelect('mant-patron-ref',    (data['patron_ref']    && data['patron_ref'].options)    || []);
  } catch (e) {
    // No setear cache para permitir reintentos
    toast('Error cargando opciones del formulario. Verifica la conexion y recarga.', 'error');
    console.warn('No se pudieron cargar opciones dinamicas:', e.message);
    throw e;
  }
}

function populateSelect(id, opciones) {
  const sel = document.getElementById(id);
  if (!sel) return;
  // Conservar primer option placeholder, reemplazar el resto
  while (sel.options.length > 1) sel.remove(1);
  opciones.forEach(o => {
    sel.insertAdjacentHTML('beforeend',
      `<option value="${escapeHtml(o.valor)}">${escapeHtml(o.valor)}</option>`);
  });
}
