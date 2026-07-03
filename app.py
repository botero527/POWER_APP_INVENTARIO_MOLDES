import socket
from functools import wraps
from flask import Flask, render_template, session, redirect, url_for, request
from backend.config import SECRET_KEY, DEBUG
from backend.routes.consultar import bp as consultar_bp
from backend.routes.mantenimiento import bp as mantenimiento_bp
from backend.db import close_request_connection

app = Flask(
    __name__,
    template_folder='frontend/templates',
    static_folder='frontend/static',
)
app.secret_key = SECRET_KEY

app.register_blueprint(consultar_bp)
app.register_blueprint(mantenimiento_bp)

# Cierra la conexión DB al final de cada request (una sola conexión por request)
app.teardown_appcontext(close_request_connection)


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
    app.run(host='0.0.0.0', debug=DEBUG, port=port)
