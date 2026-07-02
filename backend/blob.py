"""Utilidades para subir y eliminar imágenes en Azure Blob Storage."""
import uuid
from azure.storage.blob import BlobServiceClient, ContentSettings
from backend.config import AZURE_STORAGE_CONNECTION_STRING, AZURE_STORAGE_CONTAINER

_CONTENT_TYPES = {
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
    'png': 'image/png',  'gif': 'image/gif',
    'bmp': 'image/bmp',  'webp': 'image/webp',
}

# Singleton: se crea una vez por proceso, no en cada llamada
_service_client = None


def _client():
    global _service_client
    if _service_client is None:
        _service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
    return _service_client


def upload_image(file_obj, original_filename) -> str:
    """Sube una imagen y retorna la URL pública."""
    ext       = original_filename.rsplit('.', 1)[-1].lower()
    blob_name = f"{uuid.uuid4().hex}.{ext}"
    content_type = _CONTENT_TYPES.get(ext, 'application/octet-stream')

    blob = _client().get_blob_client(container=AZURE_STORAGE_CONTAINER, blob=blob_name)
    blob.upload_blob(
        file_obj,
        overwrite=True,
        content_settings=ContentSettings(content_type=content_type),
    )
    return blob.url


def delete_image(url: str):
    """Elimina un blob dado su URL completa. Loguea si falla."""
    if not url or not url.startswith('https://'):
        return
    blob_name = url.split(f'/{AZURE_STORAGE_CONTAINER}/')[-1]
    blob = _client().get_blob_client(container=AZURE_STORAGE_CONTAINER, blob=blob_name)
    try:
        blob.delete_blob()
    except Exception as e:
        try:
            from flask import current_app
            current_app.logger.warning(f'Blob delete failed for {url}: {e}')
        except RuntimeError:
            print(f'[blob] delete failed for {url}: {e}')
