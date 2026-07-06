"""
Script idempotente: crea la tabla AppControlInventarios_Opciones y la puebla
con los valores actualmente hardcodeados en mantenimiento.html.
Seguro correr varias veces: verifica antes de crear/insertar.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()
from backend.db import query, execute

TABLE = 'AppControlInventarios_Opciones'

# ── 1. Crear tabla si no existe ────────────────────────────────────────────────

existing_tables = {r['TABLE_NAME'] for r in query(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME=?", [TABLE]
)}

if TABLE not in existing_tables:
    execute(f"""
        CREATE TABLE dbo.[{TABLE}] (
            Id          INT IDENTITY(1,1) PRIMARY KEY,
            Grupo       NVARCHAR(50)  NOT NULL,
            GrupoLabel  NVARCHAR(100) NOT NULL,
            Valor       NVARCHAR(200) NOT NULL,
            Orden       INT           DEFAULT 0,
            Activo      BIT           DEFAULT 1
        )
    """, [])
    print("Tabla " + TABLE + " creada.")
else:
    print("Tabla " + TABLE + " ya existe - sin cambios de estructura.")

# ── 2. Poblar con valores iniciales si la tabla esta vacia ─────────────────────

count_rows = query(f"SELECT COUNT(*) AS n FROM dbo.[{TABLE}]", [])
total = count_rows[0]['n'] if count_rows else 0

if total == 0:
    seed_data = [
        # (grupo, grupo_label, valor, orden)
        ('tipo_mant',     'Tipo de Mantenimiento',  'Mantenimiento Tipo 1',       1),
        ('tipo_mant',     'Tipo de Mantenimiento',  'Mantenimiento Tipo 2',       2),
        ('tipo_mant',     'Tipo de Mantenimiento',  'Mantenimiento Tipo 3',       3),
        ('tipo_mant',     'Tipo de Mantenimiento',  'Mantenimiento Preventivo',   4),
        ('tipo_mant',     'Tipo de Mantenimiento',  'Mantenimiento Correctivo',   5),
        ('estado_postes', 'Estado de Postes',        'Bueno',                     1),
        ('estado_postes', 'Estado de Postes',        'Regular',                   2),
        ('estado_postes', 'Estado de Postes',        'Malo',                      3),
        ('estado_postes', 'Estado de Postes',        'Requiere reemplazo',        4),
        ('patron_ref',    'Patron de Referencia',    'Vidrio original',           1),
        ('patron_ref',    'Patron de Referencia',    'Galgas 3D',                 2),
        ('patron_ref',    'Patron de Referencia',    'Galgas verificacion',       3),
        ('patron_ref',    'Patron de Referencia',    'Ninguna',                   4),
    ]
    for grupo, label, valor, orden in seed_data:
        execute(
            f"INSERT INTO dbo.[{TABLE}] (Grupo, GrupoLabel, Valor, Orden, Activo) VALUES (?,?,?,?,1)",
            [grupo, label, valor, orden]
        )
    print("Datos iniciales insertados: " + str(len(seed_data)) + " registros.")
else:
    print("Tabla ya tiene datos (" + str(total) + " registros) - seed omitido.")

print("\nMigracion completada.")
