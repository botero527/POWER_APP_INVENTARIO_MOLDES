"""
Migración: Agregar columnas de soft-delete a AppControlInventarios_RegistroInventario.

Ejecutar una sola vez en DEV (y luego en PROD con el script SQL de CHANGELOG_IT.md).
Idempotente: no falla si las columnas ya existen.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.db import get_connection

COLUMNS = [
    ("Activo",            "BIT           NOT NULL DEFAULT 1"),
    ("MotivoEliminacion", "NVARCHAR(500) NULL"),
    ("EliminadoPor",      "NVARCHAR(100) NULL"),
    ("FechaEliminacion",  "DATETIME      NULL"),
]
TABLE = "AppControlInventarios_RegistroInventario"


def column_exists(cursor, table, column):
    cursor.execute(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
        "WHERE TABLE_NAME=? AND COLUMN_NAME=?",
        [table, column]
    )
    return cursor.fetchone()[0] > 0


def run():
    conn = get_connection()
    try:
        cursor = conn.cursor()
        added = []
        skipped = []

        for col_name, col_def in COLUMNS:
            if column_exists(cursor, TABLE, col_name):
                skipped.append(col_name)
            else:
                cursor.execute(
                    f"ALTER TABLE dbo.[{TABLE}] ADD {col_name} {col_def}"
                )
                added.append(col_name)

        conn.commit()

        if added:
            print(f"OK Columnas agregadas: {', '.join(added)}")
        if skipped:
            print(f"  Ya existían (omitidas): {', '.join(skipped)}")

        # Verificación
        cursor.execute(
            f"SELECT COUNT(*) AS total, "
            f"SUM(CASE WHEN Activo=1 THEN 1 ELSE 0 END) AS activos "
            f"FROM dbo.[{TABLE}]"
        )
        row = cursor.fetchone()
        print(f"  Registros totales: {row[0]} | Con Activo=1: {row[1]}")
        print("Migración completada.")
    finally:
        conn.close()


if __name__ == '__main__':
    run()
