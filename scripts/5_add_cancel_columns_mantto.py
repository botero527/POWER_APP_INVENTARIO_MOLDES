"""
Script idempotente: agrega columnas de cancelacion a ManttoHead.
Seguro correr varias veces — verifica antes de ALTER.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()
from backend.db import query, execute

TABLE = 'AppControlInventarios_ManttoHead'

existing = {r['COLUMN_NAME'] for r in query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=?", [TABLE]
)}

cols = [
    ('MotivoCancelacion', 'NVARCHAR(500) NULL'),
    ('CanceladoPor',      'NVARCHAR(100) NULL'),
    ('FechaCancelacion',  'DATETIME NULL'),
]

for col, definition in cols:
    if col not in existing:
        execute(f"ALTER TABLE dbo.[{TABLE}] ADD {col} {definition}", [])
        print(f"  ✓ Columna {col} agregada")
    else:
        print(f"  · {col} ya existe — sin cambios")

print("\nMigración completada.")
