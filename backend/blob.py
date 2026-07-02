"""Utilidades para subir y eliminar imágenes en Azure Blob Storage."""
import uuid
from azure.storage.blob import BlobServiceClient, ContentSettings
from backend.config import AZURE_STORAGE_CONNECTION_STRING, AZURE_STORAGE_CONTAINER


def _client():
    return BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)


def upload_image(file_obj, original_filename) -> str:
    """Sube una imagen y retorna la URL pública."""
    ext      = original_filename.rsplit('.', 1)[-1].lower()
    blob_name = f"{uuid.uuid4().hex}.{ext}"

    content_type_map = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
        'png': 'image/png',  'gif': 'image/gif',
        'bmp': 'image/bmp',  'webp': 'image/webp',
    }
    content_type = content_type_map.get(ext, 'application/octet-stream')

    client = _client()
    blob   = client.get_blob_client(container=AZURE_STORAGE_CONTAINER, blob=blob_name)
    blob.upload_blob(
        file_obj,
        overwrite=True,
        content_settings=ContentSettings(content_type=content_type),
    )
    return blob.url  # URL pública directa


def delete_image(url: str):
    """Elimina un blob dado su URL completa."""
    if not url or not url.startswith('https://'):
        return
    blob_name = url.split(f'/{AZURE_STORAGE_CONTAINER}/')[-1]
    client = _client()
    blob   = client.get_blob_client(container=AZURE_STORAGE_CONTAINER, blob=blob_name)
    try:
        blob.delete_blob()
    except Exception:
        pass
