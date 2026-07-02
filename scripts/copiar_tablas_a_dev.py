"""
Copia las tablas de produccion (agpc-productivity) a dev (AGP_Ingenieria).
Ejecutar una sola vez: py scripts/copiar_tablas_a_dev.py
"""
import os
import pyodbc
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Credenciales PROD: configurar en .env como PROD_DB_PASSWORD y PROD_DB_USER
PROD = (
    'DRIVER={ODBC Driver 17 for SQL Server};'
    'SERVER=agpcol.database.windows.net;'
    'DATABASE=agpc-productivity;'
    f'UID={os.getenv("PROD_DB_USER", "Consulta")};'
    f'PWD={os.environ["PROD_DB_PASSWORD"]};'
    'Encrypt=yes;TrustServerCertificate=no;'
)
DEV = (
    'DRIVER={ODBC Driver 17 for SQL Server};'
    f'SERVER={os.environ["DB_SERVER"]};'
    f'DATABASE={os.environ["DB_NAME"]};'
    f'UID={os.environ["DB_USER"]};'
    f'PWD={os.environ["DB_PASSWORD"]};'
    'Encrypt=yes;TrustServerCertificate=no;'
)

TABLES = [
    'AppControlInventarios_RegistroInventario',
    'AppControlInventarios_UserLog',
    'AppControlInventarios_BlockedHer',
    'AppControlInventarios_Imagenes',
    'AppControlInventarios_RegistroConsumo',
    'AppControlInventarios_ManttoHead',
    'AppControlInventarios_ManttoDetails',   # 233k filas - tarda un poco
]

print("Conectando a produccion...")
prod = pyodbc.connect(PROD, timeout=30)
print("Conectando a dev...")
dev  = pyodbc.connect(DEV,  timeout=30)
dev.autocommit = False
pc = prod.cursor()
dc = dev.cursor()

for t in TABLES:
    print(f"\n[{t}]")

    # Contar origen
    pc.execute(f"SELECT COUNT(*) FROM dbo.[{t}]")
    total = pc.fetchone()[0]
    print(f"  Origen: {total} filas")

    if total == 0:
        print("  (vacia, saltando)")
        continue

    # Limpiar destino
    dc.execute(f"DELETE FROM dbo.[{t}]")
    dev.commit()

    # Leer columnas (saltar identity = primera col)
    pc.execute(f"SELECT TOP 0 * FROM dbo.[{t}]")
    all_cols  = [d[0] for d in pc.description]
    ins_cols  = all_cols[1:]
    col_list  = ','.join(f'[{c}]' for c in ins_cols)
    holders   = ','.join('?' for _ in ins_cols)
    sql_ins   = f"INSERT INTO dbo.[{t}] ({col_list}) VALUES ({holders})"

    # Copiar en lotes de 1000
    pc.execute(f"SELECT * FROM dbo.[{t}]")
    batch = []
    copiadas = 0
    for row in pc:
        batch.append(tuple(row[1:]))
        if len(batch) == 1000:
            dc.executemany(sql_ins, batch)
            dev.commit()
            copiadas += len(batch)
            print(f"  {copiadas}/{total} copiadas...", end='\r')
            batch = []
    if batch:
        dc.executemany(sql_ins, batch)
        dev.commit()
        copiadas += len(batch)

    print(f"  {copiadas}/{total} filas copiadas OK        ")

prod.close()
dev.close()
print("\n✓ Listo! Todas las tablas copiadas a AGP_Ingenieria.")
