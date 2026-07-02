from backend.db import query, execute

HEAD = 'AppControlInventarios_ManttoHead'
DET  = 'AppControlInventarios_ManttoDetails'

CLASE_LABELS = {
    'MedidaTolerancia_Mantenimiento': 'Mediciones de Tolerancia',
    'EspesorPista_Mantenimiento':     'Espesor de Pista',
}


def _fmt(rows, keys):
    for r in rows:
        for k in keys:
            if r.get(k) and hasattr(r[k], 'strftime'):
                r[k] = r[k].strftime('%d/%m/%Y %H:%M')
    return rows


def get_all(search=None, estatus=None, is_admin=False):
    wheres, params = [], []

    if not is_admin:
        wheres.append("Estatus = 'Finalizado'")

    if search:
        wheres.append("(CAST(CodHer AS VARCHAR) LIKE ? OR CreadoPor LIKE ? OR Adicionales LIKE ?)")
        params += [f'%{search}%', f'%{search}%', f'%{search}%']

    if estatus:
        wheres.append("Estatus = ?")
        params.append(estatus)

    where_sql = f"WHERE {' AND '.join(wheres)}" if wheres else ''
    rows = query(
        f"SELECT * FROM dbo.[{HEAD}] {where_sql} ORDER BY FechaCreateMant DESC",
        params
    )
    return _fmt(rows, ['FechaCreateMant', 'FechaReleaseMant'])


def get_by_id(id_mant):
    rows = query(f"SELECT * FROM dbo.[{HEAD}] WHERE IdManten = ?", [id_mant])
    if not rows:
        return None
    head = rows[0]
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


def get_next_repeticion(tipo, cod, version, pieza):
    rows = query(
        f"SELECT ISNULL(MAX(Repeticion), 0) + 1 AS next_rep FROM dbo.[{HEAD}] "
        f"WHERE Tipo=? AND CodHer=? AND Version=? AND Pieza=?",
        [tipo, cod, version, pieza]
    )
    return rows[0]['next_rep'] if rows else 1


def create(tipo, cod, version, pieza, creado_por, tipo_mant='', adicionales=''):
    rep = get_next_repeticion(tipo, cod, version, pieza)
    execute(
        f"""INSERT INTO dbo.[{HEAD}]
            (Tipo, CodHer, Version, Pieza, Repeticion, Estatus,
             TipoMant, CreadoPor, Adicionales, FechaCreateMant)
            VALUES (?,?,?,?,?,'Pendiente',?,?,?,GETDATE())""",
        [tipo, cod, version, pieza, rep, tipo_mant, creado_por, adicionales]
    )
    rows = query(
        f"SELECT TOP 1 IdManten FROM dbo.[{HEAD}] "
        f"WHERE Tipo=? AND CodHer=? AND Version=? AND Pieza=? AND Repeticion=?",
        [tipo, cod, version, pieza, rep]
    )
    return rows[0]['IdManten'] if rows else None


def update_head(id_mant, fields: dict):
    allowed = {'TipoMant', 'EstadoPostes', 'Observaciones', 'Entrega',
               'Recibe', 'Estatus', 'FechaReleaseMant', 'Adicionales'}
    sets, params = [], []
    for k, v in fields.items():
        if k in allowed:
            sets.append(f"[{k}] = ?")
            params.append(v if v != '' else None)
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


def delete(id_mant):
    execute(f"DELETE FROM dbo.[{DET}] WHERE IdMant=?", [id_mant])
    execute(f"DELETE FROM dbo.[{HEAD}] WHERE IdManten=?", [id_mant])
