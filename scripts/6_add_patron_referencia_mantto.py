"""
Script idempotente: agrega columna PatronReferencia a ManttoHead.
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

if 'PatronReferencia' not in existing:
    execute(f"ALTER TABLE dbo.[{TABLE}] ADD PatronReferencia NVARCHAR(100) NULL")
    print("OK: Columna PatronReferencia agregada")
else:
    print("OK: PatronReferencia ya existe, sin cambios")
