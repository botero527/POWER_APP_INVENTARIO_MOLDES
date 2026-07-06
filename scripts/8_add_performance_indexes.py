"""
Script 8: Agrega indices de rendimiento en SQL Server.
Ejecutar UNA sola vez en dev y luego en produccion.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.db import get_connection

INDEXES = [
    (
        "IX_ManttoDetails_IdMant",
        "AppControlInventarios_ManttoDetails",
        """CREATE INDEX IX_ManttoDetails_IdMant
           ON dbo.[AppControlInventarios_ManttoDetails] (IdMant)
           INCLUDE (IdMed, Clase, Value, Matricero, FechaModif)"""
    ),
    (
        "IX_ManttoHead_FechaCreate",
        "AppControlInventarios_ManttoHead",
        """CREATE INDEX IX_ManttoHead_FechaCreate
           ON dbo.[AppControlInventarios_ManttoHead] (FechaCreateMant DESC)
           INCLUDE (Estatus, CodHer, Tipo, CreadoPor)"""
    ),
    (
        "IX_Imagenes_Nombre",
        "AppControlInventarios_Imagenes",
        """CREATE UNIQUE INDEX IX_Imagenes_Nombre
           ON dbo.[AppControlInventarios_Imagenes] (Nombre_Imagen)"""
    ),
]


def index_exists(conn, index_name, table_name):
    cursor = conn.cursor()
    cursor.execute(
        "SELECT 1 FROM sys.indexes WHERE name = ? AND object_id = OBJECT_ID(?)",
        [index_name, f'dbo.[{table_name}]']
    )
    return cursor.fetchone() is not None


def main():
    conn = get_connection()
    try:
        for idx_name, table_name, sql in INDEXES:
            if index_exists(conn, idx_name, table_name):
                print(f"  [SKIP] {idx_name} ya existe")
            else:
                cursor = conn.cursor()
                cursor.execute(sql)
                conn.commit()
                print(f"  [OK]   {idx_name} creado")
        print("\nIndexes listos.")
    finally:
        conn.close()


if __name__ == '__main__':
    main()
