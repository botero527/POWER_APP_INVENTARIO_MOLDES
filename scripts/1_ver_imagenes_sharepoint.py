"""
PASO 1: Muestra todas las imágenes en BD con sus nombres originales de SharePoint.
Ejecutar: py scripts/1_ver_imagenes_sharepoint.py

Esto te dice exactamente qué archivos buscar en SharePoint.
"""
import pyodbc
import base64
from urllib.parse import unquote

CONN = (
    'DRIVER={ODBC Driver 17 for SQL Server};'
    'SERVER=agpcolombia.database.windows.net;'
    'DATABASE=AGP_Ingenieria;'
    'UID=DevIngenieria;'
    'PWD=HiJE068i0LQVrwA;'
    'Encrypt=yes;TrustServerCertificate=no;'
)

conn = pyodbc.connect(CONN, timeout=15)
cur  = conn.cursor()
cur.execute("SELECT id, Nombre_Imagen, IdStorage FROM dbo.AppControlInventarios_Imagenes ORDER BY Nombre_Imagen")
rows = cur.fetchall()
conn.close()

print(f"\n{'='*70}")
print(f"IMÁGENES EN BD: {len(rows)} registros")
print(f"{'='*70}\n")

sin_imagen   = []
sharepoint   = []
azure        = []
local        = []

for row in rows:
    id_img, nombre, id_storage = row

    if not id_storage:
        sin_imagen.append((id_img, nombre, ''))
    elif id_storage.startswith('https://'):
        azure.append((id_img, nombre, id_storage))
    elif id_storage.startswith('JTJ') or id_storage.startswith('JTI'):
        # Base64 URL-encoded SharePoint path
        try:
            padding  = '=' * (4 - len(id_storage) % 4)
            decoded  = base64.b64decode(id_storage + padding).decode('utf-8', errors='replace')
            path     = unquote(decoded)
            filename = path.split('/')[-1].split('?')[0]
        except Exception:
            filename = f'[error decodificando] {id_storage[:30]}...'
        sharepoint.append((id_img, nombre, filename))
    else:
        local.append((id_img, nombre, id_storage))

# ── Reporte ──────────────────────────────────────────────────────────────────

print(f"✅ Ya en Azure Blob:    {len(azure)}")
print(f"📁 Rutas locales:       {len(local)}")
print(f"🔗 En SharePoint:       {len(sharepoint)}  ← ESTOS HAY QUE MIGRAR")
print(f"❌ Sin imagen:          {len(sin_imagen)}")

if sharepoint:
    print(f"\n{'─'*70}")
    print("ARCHIVOS A DESCARGAR DE SHAREPOINT:")
    print("Guárdalos en: scripts/imagenes_sharepoint/")
    print("El nombre del archivo DEBE SER el Nombre_Imagen + extensión original")
    print(f"{'─'*70}\n")
    print(f"{'ID':>6}  {'Nombre_Imagen':<35}  {'Archivo en SharePoint'}")
    print(f"{'─'*6}  {'─'*35}  {'─'*30}")
    for id_img, nombre, filename in sharepoint:
        print(f"{id_img:>6}  {nombre:<35}  {filename}")

if local:
    print(f"\n{'─'*70}")
    print("IMÁGENES CON RUTA LOCAL (también migrar a Azure):")
    print(f"{'─'*70}")
    for id_img, nombre, path in local:
        print(f"  ID={id_img}  {nombre}  →  {path}")

print(f"\n{'='*70}")
print("PRÓXIMO PASO:")
print("1. Descarga los archivos de SharePoint listados arriba")
print("2. Guárdalos en:  scripts/imagenes_sharepoint/")
print("3. Nombra cada archivo como: NombreImagen.ext")
print("   Ejemplo: M|1244|000|000.jpg")
print("4. Ejecuta: py scripts/2_migrar_imagenes_azure.py")
print(f"{'='*70}\n")
