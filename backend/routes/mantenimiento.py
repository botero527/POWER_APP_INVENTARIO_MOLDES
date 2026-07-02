import os
import uuid
from flask import Blueprint, request, jsonify, session, current_app
from werkzeug.utils import secure_filename
from backend.models.imagenes import get_all, get_by_id, find_for_tool, create, update, delete, build_nombre
from backend.models.usuarios import get_usernames, verify_login

bp = Blueprint('mantenimiento', __name__, url_prefix='/api/mantenimiento')

ALLOWED_EXT = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXT


def is_admin():
    return session.get('mant_rol') == 'Admin'


# ── AUTH ──────────────────────────────────────────────────────────────────────

@bp.route('/usuarios', methods=['GET'])
def list_usuarios():
    return jsonify(get_usernames())


@bp.route('/login', methods=['POST'])
def login():
    body = request.get_json()
    user = verify_login(body.get('username', ''), body.get('password', ''))
    if user:
        session['mant_user_id'] = user['UserId']
        session['mant_username'] = user['UserName']
        session['mant_rol'] = user['Rol']
        return jsonify({'ok': True, 'username': user['UserName'], 'rol': user['Rol']})
    return jsonify({'ok': False, 'error': 'Usuario o contraseña incorrectos'}), 401


@bp.route('/logout', methods=['POST'])
def logout():
    session.pop('mant_user_id', None)
    session.pop('mant_username', None)
    session.pop('mant_rol', None)
    return jsonify({'ok': True})


@bp.route('/me', methods=['GET'])
def me():
    if 'mant_username' not in session:
        return jsonify({'logged': False}), 401
    return jsonify({
        'logged': True,
        'username': session['mant_username'],
        'rol': session['mant_rol'],
    })


# ── IMAGENES ──────────────────────────────────────────────────────────────────

@bp.route('/imagenes', methods=['GET'])
def list_imagenes():
    search = request.args.get('search', '').strip()
    rows = get_all(search or None)
    # Convertir fechas a string
    for r in rows:
        for k in ('Create_Date', 'Modif_Date'):
            if r.get(k):
                r[k] = r[k].strftime('%d/%m/%Y %H:%M')
    return jsonify(rows)


@bp.route('/imagenes/buscar', methods=['GET'])
def buscar_imagen():
    tipo    = request.args.get('tipo', '')
    cod     = request.args.get('cod', '')
    version = request.args.get('version', '')
    pieza   = request.args.get('pieza', '')
    row = find_for_tool(tipo, cod, version, pieza)
    if row:
        if row.get('Create_Date'):
            row['Create_Date'] = row['Create_Date'].strftime('%d/%m/%Y %H:%M')
        if row.get('Modif_Date'):
            row['Modif_Date'] = row['Modif_Date'].strftime('%d/%m/%Y %H:%M')
    return jsonify(row)


@bp.route('/imagenes/<int:id_img>', methods=['GET'])
def get_imagen(id_img):
    row = get_by_id(id_img)
    if not row:
        return jsonify({'error': 'No encontrado'}), 404
    for k in ('Create_Date', 'Modif_Date'):
        if row.get(k):
            row[k] = row[k].strftime('%d/%m/%Y %H:%M')
    return jsonify(row)


@bp.route('/imagenes', methods=['POST'])
def create_imagen():
    if not is_admin():
        return jsonify({'error': 'Solo administradores'}), 403

    tipo            = request.form.get('tipo', '')
    cod             = request.form.get('cod', '')
    version         = request.form.get('version', '')
    pieza           = request.form.get('pieza', '')
    cantidad_puntos = request.form.get('cantidad_puntos', 0)
    puntos_esp      = request.form.get('puntos_esp_pista', '')

    nombre = build_nombre(tipo, cod, version, pieza)
    id_storage = _save_file(request.files.get('imagen'))

    create(nombre, cantidad_puntos, puntos_esp, id_storage or '')
    return jsonify({'ok': True}), 201


@bp.route('/imagenes/<int:id_img>', methods=['PUT'])
def update_imagen(id_img):
    if not is_admin():
        return jsonify({'error': 'Solo administradores'}), 403

    tipo            = request.form.get('tipo', '')
    cod             = request.form.get('cod', '')
    version         = request.form.get('version', '')
    pieza           = request.form.get('pieza', '')
    cantidad_puntos = request.form.get('cantidad_puntos', 0)
    puntos_esp      = request.form.get('puntos_esp_pista', '')

    nombre = build_nombre(tipo, cod, version, pieza)
    id_storage = _save_file(request.files.get('imagen'))

    update(id_img, nombre, cantidad_puntos, puntos_esp, id_storage)
    return jsonify({'ok': True})


@bp.route('/imagenes/<int:id_img>', methods=['DELETE'])
def delete_imagen(id_img):
    if not is_admin():
        return jsonify({'error': 'Solo administradores'}), 403
    delete(id_img)
    return jsonify({'ok': True})


# ── USUARIOS CRUD ─────────────────────────────────────────────────────────────

@bp.route('/users', methods=['GET'])
def list_users():
    from backend.models.usuarios import get_all
    rows = get_all()
    for r in rows:
        for k in ('Create_Date', 'Modif_Date'):
            if r.get(k):
                r[k] = r[k].strftime('%d/%m/%Y %H:%M')
    return jsonify(rows)


@bp.route('/users', methods=['POST'])
def create_user():
    if not is_admin():
        return jsonify({'error': 'Solo administradores'}), 403
    body = request.get_json()
    nombre   = body.get('nombre', '').strip()
    rol      = body.get('rol', '').strip()
    password = body.get('password', '').strip()
    if not nombre or not rol or not password:
        return jsonify({'error': 'Nombre, rol y contraseña son requeridos'}), 400
    from backend.models.usuarios import create
    create(nombre, password, rol)
    return jsonify({'ok': True}), 201


@bp.route('/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    if not is_admin():
        return jsonify({'error': 'Solo administradores'}), 403
    body = request.get_json()
    nombre   = body.get('nombre', '').strip()
    rol      = body.get('rol', '').strip()
    password = body.get('password', '').strip()
    if not nombre or not rol:
        return jsonify({'error': 'Nombre y rol son requeridos'}), 400
    from backend.models.usuarios import update
    update(user_id, nombre, password or None, rol)
    return jsonify({'ok': True})


@bp.route('/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    if not is_admin():
        return jsonify({'error': 'Solo administradores'}), 403
    if user_id == session.get('mant_user_id'):
        return jsonify({'error': 'No puedes eliminar tu propio usuario'}), 400
    from backend.models.usuarios import delete
    delete(user_id)
    return jsonify({'ok': True})


# ── VERIFY USER (para "Quien recibe") ────────────────────────────────────────

@bp.route('/verify-user', methods=['POST'])
def verify_user():
    body = request.get_json()
    from backend.models.usuarios import verify_login
    user = verify_login(body.get('username', ''), body.get('password', ''))
    if user:
        return jsonify({'ok': True, 'username': user['UserName'], 'rol': user['Rol']})
    return jsonify({'ok': False, 'error': 'Usuario o contraseña incorrectos'}), 401


# ── INVENTARIO SEARCH (para modal crear mantto) ───────────────────────────────

@bp.route('/inventario-search', methods=['GET'])
def inventario_search():
    from backend.models.inventario import get_all
    filters = {
        'tipo':      request.args.get('tipo', '').strip() or None,
        'cod_molde': request.args.get('cod', '').strip() or None,
        'version':   request.args.get('version', '').strip() or None,
        'pieza':     request.args.get('pieza', '').strip() or None,
    }
    rows = get_all({k: v for k, v in filters.items() if v})
    for r in rows:
        for k in ('FechaCreacion', 'FechaEdicion'):
            if r.get(k) and hasattr(r[k], 'strftime'):
                r[k] = r[k].strftime('%d/%m/%Y')
    return jsonify(rows)


# ── MANTENIMIENTOS (ROBOT) ────────────────────────────────────────────────────

@bp.route('/manttos', methods=['GET'])
def list_manttos():
    from backend.models.mantto import get_all
    search  = request.args.get('search', '').strip()
    estatus = request.args.get('estatus', '').strip()
    rows = get_all(search or None, estatus or None, is_admin())
    return jsonify(rows)


@bp.route('/manttos/<int:id_mant>', methods=['GET'])
def get_mantto(id_mant):
    from backend.models.mantto import get_by_id
    from backend.models.imagenes import find_for_tool
    row = get_by_id(id_mant)
    if not row:
        return jsonify({'error': 'No encontrado'}), 404
    img = find_for_tool(row['Tipo'], str(row['CodHer']), row['Version'], row['Pieza'])
    if img:
        for k in ('Create_Date', 'Modif_Date'):
            if img.get(k) and hasattr(img[k], 'strftime'):
                img[k] = img[k].strftime('%d/%m/%Y %H:%M')
        row['_img'] = img
    return jsonify(row)


@bp.route('/manttos', methods=['POST'])
def create_mantto():
    body        = request.get_json()
    tipo        = str(body.get('tipo', '')).strip()
    cod         = str(body.get('cod', '')).strip()
    version     = str(body.get('version', '')).strip()
    pieza       = str(body.get('pieza', '')).strip()
    tipo_mant   = str(body.get('tipo_mant', '')).strip()
    adicionales = str(body.get('adicionales', '')).strip()
    creado_por  = session.get('mant_username', '')
    if not tipo or not cod:
        return jsonify({'error': 'Tipo y código son requeridos'}), 400
    from backend.models.mantto import create, get_by_id
    new_id = create(tipo, cod, version, pieza, creado_por, tipo_mant, adicionales)
    created = get_by_id(new_id) if new_id else {}
    return jsonify({'ok': True, 'id': new_id, 'repeticion': created.get('Repeticion', '?')}), 201


@bp.route('/manttos/<int:id_mant>', methods=['PUT'])
def update_mantto(id_mant):
    body = request.get_json()
    from backend.models.mantto import update_head
    update_head(id_mant, body)
    return jsonify({'ok': True})


@bp.route('/manttos/<int:id_mant>/detail', methods=['PUT'])
def upsert_mantto_detail(id_mant):
    body      = request.get_json()
    id_med    = body.get('id_med')
    clase     = body.get('clase', '')
    value     = body.get('value')
    matricero = session.get('mant_username', '')
    from backend.models.mantto import upsert_detail
    upsert_detail(id_mant, id_med, clase, value, matricero)
    return jsonify({'ok': True})


@bp.route('/manttos/<int:id_mant>', methods=['DELETE'])
def delete_mantto(id_mant):
    if not is_admin():
        return jsonify({'error': 'Solo administradores'}), 403
    from backend.models.mantto import delete
    delete(id_mant)
    return jsonify({'ok': True})


def _save_file(file_obj):
    """Guarda imagen en uploads/ y retorna la ruta relativa."""
    if not file_obj or not allowed_file(file_obj.filename):
        return None
    ext = file_obj.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    upload_dir = os.path.join(current_app.static_folder, 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    file_obj.save(os.path.join(upload_dir, filename))
    return f"uploads/{filename}"
