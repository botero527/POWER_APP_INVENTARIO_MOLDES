import pyodbc
from backend.config import CONNECTION_STRING

# pyodbc pooling a nivel de driver ODBC (por defecto activo, lo hacemos explícito)
pyodbc.pooling = True


def get_connection():
    """Retorna la conexión del request actual (Flask g) o una nueva fuera de contexto."""
    try:
        from flask import g
        if 'db_conn' not in g:
            g.db_conn = pyodbc.connect(CONNECTION_STRING, timeout=15)
        return g.db_conn
    except RuntimeError:
        # Fuera de contexto Flask (scripts, tests)
        return pyodbc.connect(CONNECTION_STRING, timeout=15)


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
