from backend.db import query, execute

TABLE = 'AppControlInventarios_Imagenes'


def parse_nombre(nombre):
    parts = (nombre or '').split('|')
    return {
        'tipo':    parts[0] if len(parts) > 0 else '',
        'cod':     parts[1] if len(parts) > 1 else '',
        'version': parts[2] if len(parts) > 2 else '',
        'pieza':   parts[3] if len(parts) > 3 else '',
    }


def _pad3(val):
    """Normaliza version/pieza a 3 dígitos igual que normalizarCodImg() en JS.
    '23' → '023', '3' → '003', texto no numérico → se usa tal cual."""
    if not val:
        return 'XXX'
    try:
        return str(int(val)).zfill(3)
    except (ValueError, TypeError):
        return val  # valor alfanumérico como '00/1840009' → se deja igual


def build_nombre(tipo, cod, version, pieza):
    cod_val     = cod if cod else 'XXXX'
    version_val = _pad3(version) if version else 'XXX'
    pieza_val   = _pad3(pieza)   if pieza   else 'XXX'
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
    Busca la imagen más específica en una sola query usando CASE para prioridad.
    Wildcards: XXXX (cod), XXX (version/pieza).
    Si version/pieza son vacíos y no hay coincidencia exacta/wildcard,
    hace fallback LIKE para encontrar cualquier imagen del mismo tipo+cod.
    """
    version = _pad3(version)
    pieza   = _pad3(pieza)
    candidates = [
        f"{tipo}|{cod}|{version}|{pieza}",  # exacto
        f"{tipo}|{cod}|{version}|XXX",       # misma versión, cualquier pieza
        f"{tipo}|{cod}|XXX|{pieza}",         # cualquier versión, misma pieza
        f"{tipo}|XXXX|{version}|{pieza}",    # genérica: cualquier cod, misma versión y pieza
        f"{tipo}|{cod}|XXX|XXX",             # cualquier versión/pieza del mismo molde
        f"{tipo}|XXXX|{version}|XXX",        # genérica: cualquier cod, misma versión
        f"{tipo}|XXXX|XXX|{pieza}",          # genérica: cualquier cod, misma pieza
        f"{tipo}|XXXX|XXX|XXX",              # genérica total
    ]
    placeholders = ','.join(['?'] * len(candidates))
    case_when = ' '.join(
        f"WHEN Nombre_Imagen=? THEN {len(candidates) - i}"
        for i, _ in enumerate(candidates)
    )
    rows = query(
        f"SELECT TOP 1 * FROM dbo.[{TABLE}] "
        f"WHERE Nombre_Imagen IN ({placeholders}) "
        f"ORDER BY CASE {case_when} ELSE 0 END DESC",
        candidates + candidates
    )
    return rows[0] if rows else None


def find_candidates(tipo, cod):
    """Retorna todas las imágenes que coinciden con tipo+cod (cualquier versión/pieza)."""
    rows = query(
        f"SELECT * FROM dbo.[{TABLE}] WHERE Nombre_Imagen LIKE ? ORDER BY Nombre_Imagen",
        [f"{tipo}|{cod}|%"]
    )
    return rows


def create(nombre, cantidad_puntos, puntos_esp_pista, id_storage):
    execute(
        f"""INSERT INTO dbo.[{TABLE}]
            (Nombre_Imagen, Cantidad_puntos, Puntos_Esp_Pista, IdStorage, Create_Date, Modif_Date)
            VALUES (?, ?, ?, ?, GETDATE(), GETDATE())""",
        [nombre, cantidad_puntos, puntos_esp_pista, id_storage]
    )


def update(id_img, nombre, cantidad_puntos, puntos_esp_pista, id_storage=None):
    if id_storage is not None:
        # id_storage explícitamente pasado (puede ser '' para limpiar)
        execute(
            f"""UPDATE dbo.[{TABLE}] SET
                Nombre_Imagen=?, Cantidad_puntos=?, Puntos_Esp_Pista=?,
                IdStorage=?, Modif_Date=GETDATE()
                WHERE id=?""",
            [nombre, cantidad_puntos, puntos_esp_pista, id_storage or None, id_img]
        )
    else:
        # Sin archivo nuevo: no tocar IdStorage
        execute(
            f"""UPDATE dbo.[{TABLE}] SET
                Nombre_Imagen=?, Cantidad_puntos=?, Puntos_Esp_Pista=?,
                Modif_Date=GETDATE()
                WHERE id=?""",
            [nombre, cantidad_puntos, puntos_esp_pista, id_img]
        )


def delete(id_img):
    execute(f"DELETE FROM dbo.[{TABLE}] WHERE id=?", [id_img])
