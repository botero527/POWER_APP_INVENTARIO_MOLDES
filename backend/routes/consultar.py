from flask import Blueprint, request, jsonify, session
from backend.models.inventario import get_all, get_by_id, create, update, soft_delete, UBICACIONES, TIPOS, PAGE_SIZE
from backend.models.auth import verify_admin_password

bp = Blueprint('consultar', __name__, url_prefix='/api/consultar')


@bp.route('/items', methods=['GET'])
def list_items():
    filters = {
        'tipo':      request.args.get('tipo'),
        'cod_molde': request.args.get('cod_molde'),
        'version':   request.args.get('version'),
        'pieza':     request.args.get('pieza'),
    }
    filters = {k: v for k, v in filters.items() if v}
    offset = int(request.args.get('offset', 0))

    rows, total, has_filters = get_all(filters, offset=offset, limit=PAGE_SIZE)
    has_more = (not has_filters) and (offset + len(rows) < total)
    return jsonify({'data': rows, 'total': total, 'has_more': has_more, 'offset': offset})


@bp.route('/items/<int:id_registro>', methods=['GET'])
def get_item(id_registro):
    item = get_by_id(id_registro)
    if not item:
        return jsonify({'error': 'No encontrado'}), 404
    return jsonify(item)


@bp.route('/verify-password', methods=['POST'])
def verify_password():
    body = request.get_json()
    password = body.get('password', '')
    username = verify_admin_password(password)
    if username:
        session['admin_verified'] = True
        session['admin_user'] = username
        return jsonify({'ok': True, 'user': username})
    return jsonify({'ok': False, 'error': 'Clave incorrecta'}), 401


@bp.route('/items', methods=['POST'])
def create_item():
    if not session.get('admin_verified'):
        return jsonify({'error': 'No autorizado'}), 403
    data = request.get_json()
    usuario = session.get('admin_user', 'admin')
    create(data, usuario)
    return jsonify({'ok': True}), 201


@bp.route('/items/<int:id_registro>', methods=['PUT'])
def update_item(id_registro):
    if not session.get('admin_verified'):
        return jsonify({'error': 'No autorizado'}), 403
    data = request.get_json()
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
