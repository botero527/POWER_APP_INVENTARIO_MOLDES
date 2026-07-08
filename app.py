import socket
import logging
from functools import wraps
from flask import Flask, render_template, session, redirect, url_for, request, jsonify
from werkzeug.exceptions import HTTPException
from flask_compress import Compress
from backend.config import SECRET_KEY, DEBUG
from backend.routes.consultar import bp as consultar_bp
from backend.routes.mantenimiento import bp as mantenimiento_bp
from backend.db import close_request_connection
from backend.limiter import limiter

app = Flask(
    __name__,
    template_folder='frontend/templates',
    static_folder='frontend/static',
)
app.secret_key = SECRET_KEY
app.config['COMPRESS_ALGORITHM'] = ['br', 'gzip']  # Brotli primero, gzip fallback
app.config['COMPRESS_MIN_SIZE'] = 500               # comprimir respuestas > 500 bytes
Compress(app)
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
# SECURE solo cuando haya HTTPS — mientras se corre en HTTP, debe ser False
app.config['SESSION_COOKIE_SECURE'] = False

limiter.init_app(app)

app.register_blueprint(consultar_bp)
app.register_blueprint(mantenimiento_bp)

# Cierra la conexión DB al final de cada request (una sola conexión por request)
app.teardown_appcontext(close_request_connection)


@app.errorhandler(HTTPException)
def handle_http_error(e):
    # 404, 405, etc. son errores esperados — solo debug, no exception traceback
    app.logger.debug('HTTP %s: %s', e.code, request.path)
    return jsonify({'error': e.description}), e.code


@app.errorhandler(Exception)
def handle_unexpected_error(e):
    from backend.db import DBConnectionError
    if isinstance(e, DBConnectionError):
        app.logger.warning('Sin conexion a la BD: %s', str(e.__cause__))
        return jsonify({'error': 'Sin conexión a la base de datos. Verifica tu red e intenta de nuevo.', 'db_down': True}), 503
    app.logger.exception('Error no manejado: %s', str(e))
    return jsonify({'error': 'Error interno del servidor. Intentalo nuevamente.'}), 500


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/consultar')
def consultar():
    return render_template('consultar.html')


@app.route('/mantenimiento')
def mantenimiento():
    return render_template('mantenimiento.html')


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get('mant_rol') != 'Admin':
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    return decorated


@app.route('/admin')
@admin_required
def admin():
    return render_template('admin.html', username=session.get('mant_username'))


@app.route('/admin/login', methods=['GET', 'POST'])
@limiter.limit('10 per minute', methods=['POST'])
def admin_login():
    from backend.models.usuarios import verify_login, get_usernames
    error = None
    selected = ''
    if request.method == 'POST':
        selected = request.form.get('username', '').strip()
        user = verify_login(selected, request.form.get('password', ''))
        if user and user['Rol'] == 'Admin':
            session['mant_user_id'] = user['UserId']
            session['mant_username'] = user['UserName']
            session['mant_rol'] = user['Rol']
            return redirect(url_for('admin'))
        error = 'Usuario o contraseña incorrectos, o sin permisos de administrador.'
    usuarios = get_usernames()
    return render_template('admin_login.html', error=error, usuarios=usuarios, selected=selected)


@app.route('/admin/logout', methods=['POST'])
def admin_logout():
    session.pop('mant_user_id', None)
    session.pop('mant_username', None)
    session.pop('mant_rol', None)
    return redirect(url_for('admin_login'))


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'


if __name__ == '__main__':
    port = 5001
    local_ip = get_local_ip()
    print(f'\n  Local:   http://127.0.0.1:{port}')
    print(f'  Red LAN: http://{local_ip}:{port}  <-- comparte este link\n')
    if DEBUG:
        # Modo desarrollo: servidor single-thread de Flask
        app.run(host='0.0.0.0', debug=True, port=port)
    else:
        # Modo produccion: Waitress con 8 threads para multiples usuarios simultaneos
        from waitress import serve
        print('  Servidor: Waitress (produccion, 8 threads)\n')
        serve(app, host='0.0.0.0', port=port, threads=8)
