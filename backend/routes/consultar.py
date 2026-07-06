import time
from functools import wraps
from flask import Blueprint, request, jsonify, session
from backend.models.inventario import get_all, get_by_id, create, update, soft_delete, UBICACIONES, TIPOS, PAGE_SIZE
from backend.models.auth import verify_admin_password

bp = Blueprint('consultar', __name__, url_prefix='/api/consultar')

_ADMIN_VERIFIED_TTL = 600  # segundos (10 minutos)


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


def _admin_verified_recently():
    """True si admin_verified fue otorgado en los ultimos 10 minutos."""
    if not session.get('admin_verified'):
        return False
    return (time.time() - session.get('admin_verified_at', 0)) < _ADMIN_VERIFIED_TTL


@bp.route('/items', methods=['GET'])
@_require_any_session
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
@_require_any_session
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
        session['admin_verified_at'] = time.time()
        session['admin_user'] = username
        return jsonify({'ok': True, 'user': username})
    return jsonify({'ok': False, 'error': 'Clave incorrecta'}), 401


@bp.route('/items', methods=['POST'])
def create_item():
    if not _admin_verified_recently():
        return jsonify({'error': 'Sesion de administrador expirada. Vuelva a ingresar la clave.'}), 403
    data = request.get_json(silent=True) or {}
    usuario = session.get('admin_user', 'admin')
    create(data, usuario)
    return jsonify({'ok': True}), 201


@bp.route('/items/<int:id_registro>', methods=['PUT'])
def update_item(id_registro):
    if not _admin_verified_recently():
        return jsonify({'error': 'Sesion de administrador expirada. Vuelva a ingresar la clave.'}), 403
    data = request.get_json(silent=True) or {}
    usuario = session.get('admin_user', 'admin')
    update(id_registro, data, usuario)
    return jsonify({'ok': True})


@bp.route('/items/<int:id_registro>', methods=['DELETE'])
def delete_item(id_registro):
    body    = request.get_json(silent=True) or {}
    password = body.get('password', '')
    motivo   = body.get('motivo', '').strip()

    if not motivo:
        return jsonify({'error': 'El motivo de eliminación es requerido'}), 400

    # Re-verifica la clave admin en cada eliminación (no depender de sesión)
    username = verify_admin_password(password)
    if not username:
        return jsonify({'error': 'Clave incorrecta'}), 401

    soft_delete(id_registro, motivo, username)
    return jsonify({'ok': True})


@bp.route('/opciones', methods=['GET'])
def opciones():
    return jsonify({'ubicaciones': UBICACIONES, 'tipos': TIPOS})
