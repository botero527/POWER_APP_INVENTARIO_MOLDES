from backend.db import query, execute

try:
    import bcrypt
    _BCRYPT_OK = True
except ImportError:
    _BCRYPT_OK = False


def _hash(password: str) -> str:
    if not _BCRYPT_OK:
        return password
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _check(password: str, stored: str) -> bool:
    """Verifica contraseña con bcrypt. Si el hash no es bcrypt, compara plano
    y actualiza a hash automáticamente la próxima vez que se guarde."""
    if _BCRYPT_OK and stored.startswith('$2b$'):
        return bcrypt.checkpw(password.encode(), stored.encode())
    return password == stored  # legacy plaintext


def get_all():
    return query(
        "SELECT UserId, UserName, Rol, Create_Date, Modif_Date "
        "FROM dbo.AppControlInventarios_UserLog ORDER BY Rol, UserName"
    )


def get_usernames():
    return query(
        "SELECT UserId, UserName, Rol FROM dbo.AppControlInventarios_UserLog ORDER BY UserName"
    )


def verify_login(username, password):
    rows = query(
        "SELECT UserId, UserName, Rol, Password FROM dbo.AppControlInventarios_UserLog "
        "WHERE UserName=?",
        [username]
    )
    if not rows:
        return None
    user = rows[0]
    if not _check(password, user['Password'] or ''):
        return None

    # Migración automática: si la contraseña era plaintext, actualizarla a bcrypt
    if _BCRYPT_OK and not (user['Password'] or '').startswith('$2b$'):
        try:
            hashed = _hash(password)
            execute(
                "UPDATE dbo.AppControlInventarios_UserLog SET Password=?, Modif_Date=GETDATE() WHERE UserId=?",
                [hashed, user['UserId']]
            )
        except Exception:
            pass  # fallo al migrar no bloquea el login

    return {k: user[k] for k in ('UserId', 'UserName', 'Rol')}


def create(username, password, rol):
    execute(
        "INSERT INTO dbo.AppControlInventarios_UserLog "
        "(UserName, Password, Rol, Create_Date, Modif_Date) VALUES (?,?,?,GETDATE(),GETDATE())",
        [username, _hash(password), rol]
    )


def update(user_id, username, password, rol):
    if password:
        execute(
            "UPDATE dbo.AppControlInventarios_UserLog SET UserName=?, Password=?, Rol=?, Modif_Date=GETDATE() WHERE UserId=?",
            [username, _hash(password), rol, user_id]
        )
    else:
        execute(
            "UPDATE dbo.AppControlInventarios_UserLog SET UserName=?, Rol=?, Modif_Date=GETDATE() WHERE UserId=?",
            [username, rol, user_id]
        )


def delete(user_id):
    execute("DELETE FROM dbo.AppControlInventarios_UserLog WHERE UserId=?", [user_id])
