from flask import Flask, render_template
from backend.config import SECRET_KEY, DEBUG
from backend.routes.consultar import bp as consultar_bp
from backend.routes.mantenimiento import bp as mantenimiento_bp

app = Flask(
    __name__,
    template_folder='frontend/templates',
    static_folder='frontend/static',
)
app.secret_key = SECRET_KEY

app.register_blueprint(consultar_bp)
app.register_blueprint(mantenimiento_bp)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/consultar')
def consultar():
    return render_template('consultar.html')


@app.route('/mantenimiento')
def mantenimiento():
    return render_template('mantenimiento.html')


if __name__ == '__main__':
    app.run(debug=DEBUG, port=5000)
