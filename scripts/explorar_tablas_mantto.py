"""Muestra columnas y una fila de muestra de ManttoHead y ManttoDetails."""
import os
import pyodbc
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

CONN = (
    'DRIVER={ODBC Driver 17 for SQL Server};'
    f'SERVER={os.environ["DB_SERVER"]};'
    f'DATABASE={os.environ["DB_NAME"]};'
    f'UID={os.environ["DB_USER"]};'
    f'PWD={os.environ["DB_PASSWORD"]};'
    'Encrypt=yes;TrustServerCertificate=no;'
)

conn = pyodbc.connect(CONN, timeout=15)
cur = conn.cursor()

for tabla in ['AppControlInventarios_ManttoHead', 'AppControlInventarios_ManttoDetails']:
    print(f"\n{'='*60}")
    print(f"TABLA: {tabla}")
    print('='*60)
    cur.execute(f"SELECT TOP 0 * FROM dbo.[{tabla}]")
    cols = [d[0] for d in cur.description]
    print("COLUMNAS:", cols)
    cur.execute(f"SELECT TOP 1 * FROM dbo.[{tabla}]")
    row = cur.fetchone()
    if row:
        print("\nEJEMPLO:")
        for col, val in zip(cols, row):
            print(f"  {col}: {val}")
    else:
        print("(tabla vacía)")

conn.close()
