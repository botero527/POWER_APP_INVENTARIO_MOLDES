from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# storage_uri="memory://" es correcto para Waitress (threads, no procesos separados)
limiter = Limiter(key_func=get_remote_address, default_limits=[], storage_uri='memory://')
