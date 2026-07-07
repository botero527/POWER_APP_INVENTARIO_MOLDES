from functools import wraps
from flask import Blueprint, request, jsonify, session
from backend.models.inventario import get_all, get_by_id, create, update, soft_delete, PAGE_SIZE
from backend.models.opciones import get_by_grupo
from backend.models.auth import verify_admin_password

bp = Blueprint('consultar', __name__, url_prefix='/api/consultar')


def _fmt_row(r):
    for k in ('FechaCreacion', 'FechaEdicion', 'FechaEliminacion'):
        if r.get(k) and hasattr(r[k], 'strftime'):
            r[k] = r[k].strftime('%d/%m/%Y')
    return r


def _require_any_session(f):
    """Acepta sesion de mantenimiento O sesion admin de consultar."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'mant_username' not in session and not session.get('admin_verified'):
            return jsonify({'error': 'No autenticado'}), 401
        return f(*args, **kwargs)
    return decorated



@bp.route('/items', methods=['GET'])
def list_items():
    filters = {
        'tipo':      request.args.get('tipo'),
        'cod_molde': request.args.get('cod_molde'),
        'version':   request.args.get('version'),
        'pieza':     request.args.get('pieza'),
    }
    filters = {k: v for k, v in filters.items() if v}
    try:
        offset = int(request.args.get('offset', 0))
    except ValueError:
        return jsonify({'error': 'El parametro offset debe ser un entero'}), 400

    rows, total, has_filters = get_all(filters, offset=offset, limit=PAGE_SIZE)
    rows = [_fmt_row(r) for r in rows]
    has_more = offset + len(rows) < total
    return jsonify({'data': rows, 'total': total, 'has_more': has_more, 'offset': offset})


@bp.route('/items/<int:id_registro>', methods=['GET'])
def get_item(id_registro):
    item = get_by_id(id_registro)
    if not item:
        return jsonify({'error': 'No encontrado'}), 404
    return jsonify(_fmt_row(item))


@bp.route('/verify-password', methods=['POST'])
def verify_password():
    body = request.get_json(silent=True) or {}
    password = body.get('password', '')
    username = verify_admin_password(password)
    if username:
        session['admin_verified'] = True
        session['admin_user'] = username
        return jsonify({'ok': True, 'user': username})
    return jsonify({'ok': False, 'error': 'Clave incorrecta'}), 401


@bp.route('/items', methods=['POST'])
def create_item():
    data = request.get_json(silent=True) or {}
    usuario = session.get('admin_user', 'admin')
    try:
        create(data, usuario)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify({'ok': True}), 201


@bp.route('/items/<int:id_registro>', methods=['PUT'])
def update_item(id_registro):
    data = request.get_json(silent=True) or {}
    usuario = session.get('admin_user', 'admin')
    try:
        update(id_registro, data, usuario)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify({'ok': True})


@bp.route('/items/<int:id_registro>', methods=['DELETE'])
def delete_item(id_registro):
    body   = request.get_json(silent=True) or {}
    motivo = body.get('motivo', '').strip()

    if not motivo:
        return jsonify({'error': 'El motivo de eliminación es requerido'}), 400

    usuario = session.get('admin_user', 'admin')
    soft_delete(id_registro, motivo, usuario)
    return jsonify({'ok': True})


@bp.route('/opciones', methods=['GET'])
def opciones():
    tipos       = [o['valor'] for o in get_by_grupo('tipo_inv')]
    ubicaciones = [o['valor'] for o in get_by_grupo('ubicacion_inv')]
    return jsonify({'ubicaciones': ubicaciones, 'tipos': tipos})


@bp.route('/tipos-existentes', methods=['GET'])
def tipos_existentes():
    """Tipos DISTINTOS que existen en registros — solo lo que está en los datos."""
    from backend.db import query as db_query
    from backend.models.inventario import TABLE
    rows = db_query(f"SELECT DISTINCT Tipo FROM dbo.[{TABLE}] WHERE Tipo IS NOT NULL AND Tipo <> '' ORDER BY Tipo")
    return jsonify([r['Tipo'] for r in rows])
