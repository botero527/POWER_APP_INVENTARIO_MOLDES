from backend.db import query, execute

TABLE = 'AppControlInventarios_Imagenes'


def parse_nombre(nombre):
    """Descompone 'M|1244|000|000' en dict con tipo/cod/ver/pieza."""
    parts = (nombre or '').split('|')
    return {
        'tipo':    parts[0] if len(parts) > 0 else '',
        'cod':     parts[1] if len(parts) > 1 else '',
        'version': parts[2] if len(parts) > 2 else '',
        'pieza':   parts[3] if len(parts) > 3 else '',
    }


def build_nombre(tipo, cod, version, pieza):
    cod_val     = cod     if cod     else 'XXXX'
    version_val = version if version else 'XXX'
    pieza_val   = pieza   if pieza   else 'XXX'
    return f"{tipo}|{cod_val}|{version_val}|{pieza_val}"


def get_all(search=None):
    if search:
        rows = query(
            f"SELECT * FROM dbo.[{TABLE}] WHERE Nombre_Imagen LIKE ? ORDER BY Nombre_Imagen",
            [f"%{search}%"]
        )
    else:
        rows = query(f"SELECT * FROM dbo.[{TABLE}] ORDER BY Nombre_Imagen")
    for r in rows:
        r['_parsed'] = parse_nombre(r['Nombre_Imagen'])
    return rows


def get_by_id(id_img):
    rows = query(f"SELECT * FROM dbo.[{TABLE}] WHERE id = ?", [id_img])
    if rows:
        rows[0]['_parsed'] = parse_nombre(rows[0]['Nombre_Imagen'])
        return rows[0]
    return None


def find_for_tool(tipo, cod, version, pieza):
    """
    Busca la imagen mas especifica para un molde dado.
    Wildcards: XXXX (cod), XXX (version/pieza).
    Orden de especificidad: 4 campos exactos > 3 > 2 > 1.
    """
    wildcards = [
        (tipo, cod,    version, pieza),    # exacto
        (tipo, cod,    version, 'XXX'),
        (tipo, cod,    'XXX',   pieza),
        (tipo, 'XXXX', version, pieza),
        (tipo, cod,    'XXX',   'XXX'),
        (tipo, 'XXXX', version, 'XXX'),
        (tipo, 'XXXX', 'XXX',   pieza),
        (tipo, 'XXXX', 'XXX',   'XXX'),
    ]
    for t, c, v, p in wildcards:
        nombre = f"{t}|{c}|{v}|{p}"
        rows = query(f"SELECT * FROM dbo.[{TABLE}] WHERE Nombre_Imagen = ?", [nombre])
        if rows:
            return rows[0]
    return None


def create(nombre, cantidad_puntos, puntos_esp_pista, id_storage):
    execute(
        f"""INSERT INTO dbo.[{TABLE}]
            (Nombre_Imagen, Cantidad_puntos, Puntos_Esp_Pista, IdStorage, Create_Date, Modif_Date)
            VALUES (?, ?, ?, ?, GETDATE(), GETDATE())""",
        [nombre, cantidad_puntos, puntos_esp_pista, id_storage]
    )


def update(id_img, nombre, cantidad_puntos, puntos_esp_pista, id_storage=None):
    if id_storage:
        execute(
            f"""UPDATE dbo.[{TABLE}] SET
                Nombre_Imagen=?, Cantidad_puntos=?, Puntos_Esp_Pista=?,
                IdStorage=?, Modif_Date=GETDATE()
                WHERE id=?""",
            [nombre, cantidad_puntos, puntos_esp_pista, id_storage, id_img]
        )
    else:
        execute(
            f"""UPDATE dbo.[{TABLE}] SET
                Nombre_Imagen=?, Cantidad_puntos=?, Puntos_Esp_Pista=?,
                Modif_Date=GETDATE()
                WHERE id=?""",
            [nombre, cantidad_puntos, puntos_esp_pista, id_img]
        )


def delete(id_img):
    execute(f"DELETE FROM dbo.[{TABLE}] WHERE id=?", [id_img])
