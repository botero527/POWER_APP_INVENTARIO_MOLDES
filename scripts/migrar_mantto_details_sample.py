"""
Copia las primeras 1000 filas de ManttoDetails de produccion a dev.
Solo para pruebas de desarrollo.
"""
import pyodbc

PROD = (
    'DRIVER={ODBC Driver 17 for SQL Server};'
    'SERVER=agpcol.database.windows.net;'
    'DATABASE=agpc-productivity;'
    'UID=Consulta;'
    '[PWD=REDACTED];'
    'Encrypt=yes;TrustServerCertificate=no;'
)
DEV = (
    'DRIVER={ODBC Driver 17 for SQL Server};'
    'SERVER=agpcolombia.database.windows.net;'
    'DATABASE=AGP_Ingenieria;'
    'UID=DevIngenieria;'
    '[PWD=REDACTED];'
    'Encrypt=yes;TrustServerCertificate=no;'
)

TABLE = 'AppControlInventarios_ManttoDetails'
LIMIT = 1000

print("Conectando...")
prod = pyodbc.connect(PROD, timeout=30)
dev  = pyodbc.connect(DEV,  timeout=30)
dev.autocommit = False
pc = prod.cursor()
dc = dev.cursor()

print(f"Limpiando {TABLE} en dev...")
dc.execute(f"DELETE FROM dbo.[{TABLE}]")
dev.commit()

# Leer columnas (saltar identity = primera col)
pc.execute(f"SELECT TOP 0 * FROM dbo.[{TABLE}]")
all_cols = [d[0] for d in pc.description]
ins_cols = all_cols[1:]
col_list = ','.join(f'[{c}]' for c in ins_cols)
holders  = ','.join('?' for _ in ins_cols)
sql_ins  = f"INSERT INTO dbo.[{TABLE}] ({col_list}) VALUES ({holders})"

print(f"Copiando {LIMIT} filas...")
pc.execute(f"SELECT TOP {LIMIT} * FROM dbo.[{TABLE}] ORDER BY 1")
rows = [tuple(row[1:]) for row in pc.fetchall()]

dc.executemany(sql_ins, rows)
dev.commit()

print(f"✓ {len(rows)} filas copiadas a dev correctamente.")
prod.close()
dev.close()
