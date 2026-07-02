import pyodbc
from backend.config import CONNECTION_STRING


def get_connection():
    return pyodbc.connect(CONNECTION_STRING, timeout=15)


def query(sql, params=None):
    """SELECT — retorna lista de dicts."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params or [])
        cols = [d[0] for d in cursor.description]
        return [dict(zip(cols, row)) for row in cursor.fetchall()]
    finally:
        conn.close()


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
    finally:
        conn.close()


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
    finally:
        conn.close()


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
    finally:
        conn.close()
