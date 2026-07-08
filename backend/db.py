import pyodbc
from backend.config import CONNECTION_STRING

# pyodbc pooling a nivel de driver ODBC (por defecto activo, lo hacemos explícito)
pyodbc.pooling = True

# Códigos ODBC que indican fallo de red / servidor inalcanzable
_NETWORK_STATES = {'08S01', '08001', '08003', '08007', 'HYT00', 'IM002'}


class DBConnectionError(Exception):
    """Se lanza cuando no se puede conectar a la BD (sin red, BD caída)."""


def _is_network_error(exc):
    code = exc.args[0] if exc.args else ''
    return str(code) in _NETWORK_STATES


def get_connection():
    """Retorna la conexión del request actual (Flask g) o una nueva fuera de contexto."""
    try:
        from flask import g
        if 'db_conn' not in g:
            try:
                g.db_conn = pyodbc.connect(CONNECTION_STRING, timeout=15)
            except pyodbc.Error as e:
                raise DBConnectionError() from e
        return g.db_conn
    except RuntimeError:
        # Fuera de contexto Flask (scripts, tests)
        try:
            return pyodbc.connect(CONNECTION_STRING, timeout=15)
        except pyodbc.Error as e:
            raise DBConnectionError() from e


def close_request_connection(error=None):
    """Cierra la conexión al final del request. Registrar en app.py."""
    try:
        from flask import g
        conn = g.pop('db_conn', None)
        if conn:
            conn.close()
    except RuntimeError:
        pass


def query(sql, params=None):
    """SELECT — retorna lista de dicts."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(sql, params or [])
    cols = [d[0] for d in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]


def execute(sql, params=None):
    """INSERT / UPDATE / DELETE — hace commit, retorna rowcount."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params or [])
        conn.commit()
        return cursor.rowcount
    except Exception:
        conn.rollback()
        raise


def execute_returning(sql, params=None):
    """INSERT ... OUTPUT INSERTED — hace commit y retorna las filas insertadas."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params or [])
        cols = [d[0] for d in cursor.description]
        rows = [dict(zip(cols, row)) for row in cursor.fetchall()]
        conn.commit()
        return rows
    except Exception:
        conn.rollback()
        raise


def execute_multi(statements):
    """Ejecuta múltiples (sql, params) en una sola transacción."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        for sql, params in statements:
            cursor.execute(sql, params or [])
        conn.commit()
    except Exception:
        conn.rollback()
        raise
