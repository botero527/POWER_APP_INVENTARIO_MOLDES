import os
from dotenv import load_dotenv

load_dotenv()

AZURE_STORAGE_CONNECTION_STRING = os.getenv('AZURE_STORAGE_CONNECTION_STRING', '')
AZURE_STORAGE_CONTAINER         = os.getenv('AZURE_STORAGE_CONTAINER', 'inventario-moldes')

DB_SERVER   = os.getenv('DB_SERVER')
DB_NAME     = os.getenv('DB_NAME')
DB_USER     = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')
SECRET_KEY  = os.getenv('FLASK_SECRET_KEY', '')
DEBUG       = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'

if not SECRET_KEY or SECRET_KEY == 'change_me':
    raise RuntimeError(
        "FLASK_SECRET_KEY no esta configurada o usa el valor por defecto inseguro. "
        "Generar con: python -c \"import secrets; print(secrets.token_hex(32))\""
    )

CONNECTION_STRING = (
    f'DRIVER={{ODBC Driver 17 for SQL Server}};'
    f'SERVER={DB_SERVER};'
    f'DATABASE={DB_NAME};'
    f'UID={DB_USER};'
    f'PWD={DB_PASSWORD};'
    f'Encrypt=yes;TrustServerCertificate=no;'
)
