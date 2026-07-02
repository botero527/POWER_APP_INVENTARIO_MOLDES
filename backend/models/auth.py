from backend.db import query, execute


def verify_admin_password(password):
    """Returns True if password matches any Admin user."""
    rows = query(
        "SELECT UserName FROM dbo.AppControlInventarios_UserLog WHERE Rol='Admin' AND Password=?",
        [password]
    )
    return rows[0]['UserName'] if rows else None


def get_all_users():
    return query(
        "SELECT UserId, UserName, Rol, Create_Date FROM dbo.AppControlInventarios_UserLog ORDER BY Rol, UserName"
    )
