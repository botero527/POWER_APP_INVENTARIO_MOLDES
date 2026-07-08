import re
from backend.db import query, execute, execute_returning, execute_multi

HEAD = 'AppControlInventarios_ManttoHead'
DET  = 'AppControlInventarios_ManttoDetails'

CLASE_LABELS = {
    'MedidaTolerancia_Mantenimiento': 'Mediciones de Tolerancia',
    'EspesorPista_Mantenimiento':     'Espesor de Pista',
}


def _pad(val, digits):
    if not val:
        return val
    s = str(val).strip()
    return s.zfill(digits) if re.fullmatch(r'\d+', s) else s


def _normalize_row(row):
    """Normaliza CodHer/Pieza/Version al leer desde BD sin modificarla."""
    if row:
        row['CodHer']  = _pad(row.get('CodHer'), 4)
        row['Pieza']   = _pad(row.get('Pieza'), 3)
        row['Version'] = _pad(row.get('Version'), 3)
    return row


def _fmt(rows, keys):
    for r in rows:
        for k in keys:
            if r.get(k) and hasattr(r[k], 'strftime'):
                r[k] = r[k].strftime('%d/%m/%Y %H:%M')
    return rows


PAGE_SIZE = 100


def get_all(search=None, estatus=None, offset=0, limit=None):
    wheres, params = [], []
    has_filters = bool(search or estatus)

    if search:
        s = search.strip()
        if re.fullmatch(r'\d+', s):
            # Búsqueda numérica: compara valor entero para encontrar '831' buscando '0831' y viceversa
            wheres.append(
                "(ISNUMERIC(CodHer) = 1 AND CAST(CodHer AS INT) = TRY_CAST(? AS INT) "
                "OR CreadoPor LIKE ? OR Adicionales LIKE ?)"
            )
            params += [s, f'%{s}%', f'%{s}%']
        else:
            wheres.append("(CAST(CodHer AS VARCHAR) LIKE ? OR CreadoPor LIKE ? OR Adicionales LIKE ?)")
            params += [f'%{s}%', f'%{s}%', f'%{s}%']

    if estatus:
        wheres.append("Estatus = ?")
        params.append(estatus)

    where_sql = f"WHERE {' AND '.join(wheres)}" if wheres else ''

    total_rows = query(f"SELECT COUNT(*) AS n FROM dbo.[{HEAD}] {where_sql}", params)
    total = total_rows[0]['n'] if total_rows else 0

    rows = query(
        f"SELECT * FROM dbo.[{HEAD}] {where_sql} "
        f"ORDER BY FechaCreateMant DESC "
        f"OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
        params + [offset, limit or PAGE_SIZE]
    )

    rows = [_normalize_row(r) for r in rows]
    return _fmt(rows, ['FechaCreateMant', 'FechaReleaseMant']), total, has_filters


def get_head(id_mant):
    """Solo cabecera — sin detalles. Usar para verificaciones de permisos."""
    rows = query(f"SELECT * FROM dbo.[{HEAD}] WHERE IdManten = ?", [id_mant])
    if not rows:
        return None
    return _normalize_row(rows[0])


def get_by_id(id_mant):
    rows = query(f"SELECT * FROM dbo.[{HEAD}] WHERE IdManten = ?", [id_mant])
    if not rows:
        return None
    head = _normalize_row(rows[0])
    _fmt([head], ['FechaCreateMant', 'FechaReleaseMant'])

    details = query(
        f"SELECT * FROM dbo.[{DET}] WHERE IdMant = ? ORDER BY Clase, IdMed",
        [id_mant]
    )
    _fmt(details, ['FechaModif'])

    by_clase = {}
    for d in details:
        c = d['Clase']
        if c not in by_clase:
            by_clase[c] = []
        by_clase[c].append(d)

    head['details_by_clase'] = by_clase
    head['clase_labels'] = CLASE_LABELS
    return head


def next_repeticion(tipo, cod, version, pieza):
    """Retorna el siguiente número de repetición para un herramental."""
    cod   = _pad(cod, 4)
    pieza = _pad(pieza, 3)
    rows = query(
        f"SELECT ISNULL(MAX(Repeticion), 0) + 1 AS next_rep FROM dbo.[{HEAD}] "
        f"WHERE Tipo=? AND (CodHer=? OR (ISNUMERIC(CodHer)=1 AND CAST(CodHer AS INT)=TRY_CAST(? AS INT))) "
        f"AND Version=? "
        f"AND (Pieza=? OR (ISNUMERIC(Pieza)=1 AND CAST(Pieza AS INT)=TRY_CAST(? AS INT)))",
        [tipo, cod, cod, version, pieza, pieza]
    )
    return rows[0]['next_rep'] if rows else 1


def create(tipo, cod, version, pieza, creado_por, tipo_mant='', adicionales=''):
    """Crea un nuevo ManttoHead. Repeticion = Repeticion del inventario (ingresada manualmente)."""
    cod   = _pad(cod, 4)
    pieza = _pad(pieza, 3)
    from backend.models.inventario import TABLE as INV_TABLE
    rows = execute_returning(
        f"""INSERT INTO dbo.[{HEAD}]
                (Tipo, CodHer, Version, Pieza, Repeticion, Estatus,
                 TipoMant, CreadoPor, Adicionales, FechaCreateMant)
            OUTPUT INSERTED.IdManten
            SELECT ?,?,?,?,
                   ISNULL((SELECT TOP 1 Repeticion FROM dbo.[{INV_TABLE}]
                            WHERE Tipo=? AND (CodMolde=? OR (ISNUMERIC(CodMolde)=1 AND CAST(CodMolde AS INT)=TRY_CAST(? AS INT)))
                              AND Version=? AND (Pieza=? OR (ISNUMERIC(Pieza)=1 AND CAST(Pieza AS INT)=TRY_CAST(? AS INT)))
                              AND (Activo IS NULL OR Activo=1)), 0),
                   'Pendiente',?,?,?,GETDATE()""",
        [tipo, cod, version, pieza,
         tipo, cod, cod, version, pieza, pieza,
         tipo_mant, creado_por, adicionales]
    )
    return rows[0]['IdManten'] if rows else None


def update_head(id_mant, fields: dict):
    allowed = {'TipoMant', 'EstadoPostes', 'PatronReferencia', 'Observaciones',
               'Entrega', 'Recibe', 'Estatus', 'Adicionales'}
    sets, params = [], []
    for k, v in fields.items():
        if k in allowed:
            sets.append(f"[{k}] = ?")
            params.append(v if v != '' else None)

    # Cuando se finaliza, poner fecha en servidor (nunca desde el cliente)
    if fields.get('Estatus') == 'Finalizado':
        sets.append('[FechaReleaseMant] = GETDATE()')

    if not sets:
        return
    params.append(id_mant)
    execute(f"UPDATE dbo.[{HEAD}] SET {', '.join(sets)} WHERE IdManten = ?", params)


def upsert_detail(id_mant, id_med, clase, value, matricero):
    rows = query(
        f"SELECT Id FROM dbo.[{DET}] WHERE IdMant=? AND IdMed=? AND Clase=?",
        [id_mant, id_med, clase]
    )
    if rows:
        execute(
            f"UPDATE dbo.[{DET}] SET Value=?, FechaModif=GETDATE(), Matricero=? WHERE Id=?",
            [value, matricero, rows[0]['Id']]
        )
    else:
        execute(
            f"INSERT INTO dbo.[{DET}] (IdMant, IdMed, Clase, Value, FechaModif, Matricero) "
            f"VALUES (?,?,?,?,GETDATE(),?)",
            [id_mant, id_med, clase, value, matricero]
        )


def upsert_details_batch(id_mant, items, matricero):
    """Guarda una lista de {id_med, clase, value} en una sola transacción."""
    existing = {
        (r['IdMed'], r['Clase']): r['Id']
        for r in query(
            f"SELECT Id, IdMed, Clase FROM dbo.[{DET}] WHERE IdMant=?", [id_mant]
        )
    }
    statements = []
    for item in items:
        id_med = item.get('id_med')
        clase  = item.get('clase', '')
        value  = item.get('value')
        if id_med is None:
            continue
        key    = (id_med, clase)
        if key in existing:
            statements.append((
                f"UPDATE dbo.[{DET}] SET Value=?, FechaModif=GETDATE(), Matricero=? WHERE Id=?",
                [value, matricero, existing[key]]
            ))
        else:
            statements.append((
                f"INSERT INTO dbo.[{DET}] (IdMant, IdMed, Clase, Value, FechaModif, Matricero) "
                f"VALUES (?,?,?,?,GETDATE(),?)",
                [id_mant, id_med, clase, value, matricero]
            ))
    if statements:
        execute_multi(statements)


def delete(id_mant):
    """Borra detalles y cabecera en una sola transacción."""
    execute_multi([
        (f"DELETE FROM dbo.[{DET}] WHERE IdMant=?",    [id_mant]),
        (f"DELETE FROM dbo.[{HEAD}] WHERE IdManten=?", [id_mant]),
    ])


def soft_cancel(id_mant, motivo, usuario):
    """Cancela un mantenimiento Pendiente sin borrarlo físicamente."""
    execute(
        f"""UPDATE dbo.[{HEAD}] SET
            Estatus = 'Cancelado',
            MotivoCancelacion = ?,
            CanceladoPor = ?,
            FechaCancelacion = GETDATE()
            WHERE IdManten = ? AND Estatus = 'Pendiente'""",
        [motivo, usuario, id_mant]
    )
