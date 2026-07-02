from backend.db import query, execute


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
        "SELECT UserId, UserName, Rol FROM dbo.AppControlInventarios_UserLog "
        "WHERE UserName=? AND Password=?",
        [username, password]
    )
    return rows[0] if rows else None


def create(username, password, rol):
    execute(
        "INSERT INTO dbo.AppControlInventarios_UserLog "
        "(UserName, Password, Rol, Create_Date, Modif_Date) VALUES (?,?,?,GETDATE(),GETDATE())",
        [username, password, rol]
    )


def update(user_id, username, password, rol):
    if password:
        execute(
            "UPDATE dbo.AppControlInventarios_UserLog SET UserName=?, Password=?, Rol=?, Modif_Date=GETDATE() WHERE UserId=?",
            [username, password, rol, user_id]
        )
    else:
        execute(
            "UPDATE dbo.AppControlInventarios_UserLog SET UserName=?, Rol=?, Modif_Date=GETDATE() WHERE UserId=?",
            [username, rol, user_id]
        )


def delete(user_id):
    execute("DELETE FROM dbo.AppControlInventarios_UserLog WHERE UserId=?", [user_id])
