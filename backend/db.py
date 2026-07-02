import pyodbc
from backend.config import CONNECTION_STRING


def get_connection():
    return pyodbc.connect(CONNECTION_STRING, timeout=15)


def query(sql, params=None, fetchall=True):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, params or [])
        if fetchall:
            cols = [d[0] for d in cursor.description]
            return [dict(zip(cols, row)) for row in cursor.fetchall()]
        return None


def execute(sql, params=None):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, params or [])
        conn.commit()
        return cursor.rowcount
