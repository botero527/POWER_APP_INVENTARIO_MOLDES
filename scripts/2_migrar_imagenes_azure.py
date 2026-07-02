"""
PASO 2: Sube imágenes de la carpeta scripts/imagenes_sharepoint/ a Azure Blob
y actualiza IdStorage en la BD con la URL nueva.

Antes de ejecutar:
  1. Corre py scripts/1_ver_imagenes_sharepoint.py para ver qué archivos necesitas
  2. Guarda las imágenes en scripts/imagenes_sharepoint/
  3. Nombra cada archivo como: NombreImagen.ext  (ej: M|1244|000|000.jpg)
     Si el nombre tiene | usa ese formato exacto.

Ejecutar: py scripts/2_migrar_imagenes_azure.py
"""
import os
import sys
import pyodbc
from dotenv import load_dotenv
from azure.storage.blob import BlobServiceClient, ContentSettings

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# ── Config (desde .env) ────────────────────────────────────────────────────────
CONN_STR   = os.environ['DATABASE_URL']
AZURE_CONN = os.environ['AZURE_STORAGE_CONNECTION_STRING']
CONTAINER   = 'inventario-moldes'
IMAGES_DIR  = os.path.join(os.path.dirname(__file__), 'imagenes_sharepoint')

CONTENT_TYPES = {
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
    'png': 'image/png',  'gif': 'image/gif',
    'bmp': 'image/bmp',  'webp': 'image/webp',
}

# ── Validar carpeta ────────────────────────────────────────────────────────────
if not os.path.isdir(IMAGES_DIR):
    os.makedirs(IMAGES_DIR)
    print(f"✓ Carpeta creada: {IMAGES_DIR}")
    print("  Coloca las imágenes ahí y vuelve a ejecutar el script.")
    sys.exit(0)

files = [f for f in os.listdir(IMAGES_DIR)
         if f.rsplit('.', 1)[-1].lower() in CONTENT_TYPES]

if not files:
    print(f"No se encontraron imágenes en {IMAGES_DIR}")
    print("Extensiones soportadas: jpg, jpeg, png, gif, bmp, webp")
    sys.exit(0)

print(f"\nArchivos encontrados: {len(files)}")

# ── Conectar ───────────────────────────────────────────────────────────────────
print("Conectando a BD y Azure...")
db     = pyodbc.connect(CONN_STR, timeout=15)
blob_s = BlobServiceClient.from_connection_string(AZURE_CONN)

ok = 0; skip = 0; err = 0

for filename in files:
    ext            = filename.rsplit('.', 1)[-1].lower()
    nombre_en_disco = filename[:-(len(ext)+1)]          # ej: M-1244-000-000
    nombre_img      = nombre_en_disco.replace('- -', '--').replace('-', '|') # ej: M||001|001 o M|1244|000|000

    cur = db.cursor()
    cur.execute(
        "SELECT id, IdStorage FROM dbo.AppControlInventarios_Imagenes WHERE Nombre_Imagen = ?",
        [nombre_img]
    )
    row = cur.fetchone()

    if not row:
        print(f"  ⚠️  Sin coincidencia en BD: {filename}")
        skip += 1
        continue

    id_img, id_storage_actual = row

    # Si ya tiene URL de Azure, saltar
    if id_storage_actual and id_storage_actual.startswith('https://'):
        print(f"  ✓  Ya en Azure: {nombre_img}")
        skip += 1
        continue

    # Subir a Azure Blob
    try:
        blob_name    = f"{nombre_img.replace('|', '_')}.{ext}"
        blob_client  = blob_s.get_blob_client(container=CONTAINER, blob=blob_name)
        content_type = CONTENT_TYPES.get(ext, 'image/jpeg')

        filepath = os.path.join(IMAGES_DIR, filename)
        with open(filepath, 'rb') as f:
            blob_client.upload_blob(
                f, overwrite=True,
                content_settings=ContentSettings(content_type=content_type)
            )

        new_url = blob_client.url

        # Actualizar BD
        cur.execute(
            "UPDATE dbo.AppControlInventarios_Imagenes SET IdStorage=?, Modif_Date=GETDATE() WHERE id=?",
            [new_url, id_img]
        )
        db.commit()
        print(f"  ✅  {nombre_img}  →  {new_url}")
        ok += 1

    except Exception as e:
        print(f"  ❌  Error con {filename}: {e}")
        err += 1

db.close()

print(f"\n{'='*60}")
print(f"  Subidas:    {ok}")
print(f"  Saltadas:   {skip}  (ya en Azure o sin coincidencia)")
print(f"  Errores:    {err}")
print(f"{'='*60}")
print("\n¡Listo! Las imágenes ya están en Azure y la BD actualizada.")
