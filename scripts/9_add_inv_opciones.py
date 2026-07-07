"""
Migración v1.7 — Agrega grupos tipo_inv y ubicacion_inv a AppControlInventarios_Opciones.
Ejecutar UNA sola vez en dev y producción.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from dotenv import load_dotenv
load_dotenv()
from backend.db import query, execute

TABLE = 'AppControlInventarios_Opciones'

SEEDS = [
    ('tipo_inv',      'Tipo Herramental (Inventario)', 'M',            1),
    ('tipo_inv',      'Tipo Herramental (Inventario)', 'G',            2),
    ('ubicacion_inv', 'Ubicacion (Inventario)',        'HORNOS',       1),
    ('ubicacion_inv', 'Ubicacion (Inventario)',        'MATRICERIA',   2),
    ('ubicacion_inv', 'Ubicacion (Inventario)',        'MEZANINE',     3),
    ('ubicacion_inv', 'Ubicacion (Inventario)',        'PARQUEADERO',  4),
    ('ubicacion_inv', 'Ubicacion (Inventario)',        'B10',          5),
    ('ubicacion_inv', 'Ubicacion (Inventario)',        'B15',          6),
]

existing = {r['Valor'] for r in query(
    f"SELECT Valor FROM dbo.[{TABLE}] WHERE Grupo IN ('tipo_inv','ubicacion_inv')", []
)}

inserted = 0
for grupo, label, valor, orden in SEEDS:
    if valor not in existing:
        execute(
            f"INSERT INTO dbo.[{TABLE}] (Grupo, GrupoLabel, Valor, Orden, Activo) VALUES (?,?,?,?,1)",
            [grupo, label, valor, orden]
        )
        print(f"  + {grupo}: {valor}")
        inserted += 1
    else:
        print(f"  ~ ya existe: {valor}")

print(f"\nListo. {inserted} opciones insertadas.")
