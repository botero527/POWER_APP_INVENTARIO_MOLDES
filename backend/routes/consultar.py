from flask import Blueprint, request, jsonify, session
from backend.models.inventario import get_all, get_by_id, create, update, delete, UBICACIONES, TIPOS
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
    rows = get_all(filters)
    return jsonify({'data': rows, 'total': len(rows)})


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
    if not session.get('admin_verified'):
        return jsonify({'error': 'No autorizado'}), 403
    delete(id_registro)
    return jsonify({'ok': True})


@bp.route('/opciones', methods=['GET'])
def opciones():
    return jsonify({'ubicaciones': UBICACIONES, 'tipos': TIPOS})
