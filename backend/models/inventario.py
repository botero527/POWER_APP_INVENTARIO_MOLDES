from backend.db import query, execute

TABLE = 'AppControlInventarios_RegistroInventario'

UBICACIONES = ['HORNOS', 'MATRICERIA', 'MEZANINE', 'PARQUEADERO', 'B10', 'B15']
TIPOS = ['M', 'G']


PAGE_SIZE = 100


def get_all(filters=None, offset=0, limit=None):
    conditions = []
    params = []
    has_filters = False

    if filters:
        if filters.get('tipo'):
            conditions.append('Tipo = ?')
            params.append(filters['tipo'])
            has_filters = True
        if filters.get('cod_molde'):
            conditions.append('CodMolde LIKE ?')
            params.append(f"%{filters['cod_molde']}%")
            has_filters = True
        if filters.get('version'):
            conditions.append('Version LIKE ?')
            params.append(f"%{filters['version']}%")
            has_filters = True
        if filters.get('pieza'):
            conditions.append('Pieza LIKE ?')
            params.append(f"%{filters['pieza']}%")
            has_filters = True

    # Excluir registros eliminados (soft-delete). Activo IS NULL = filas previas a la migración
    conditions.append("(Activo IS NULL OR Activo = 1)")

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ''

    # Contar total para el footer
    count_rows = query(f"SELECT COUNT(*) AS n FROM dbo.[{TABLE}] {where}", params)
    total = count_rows[0]['n'] if count_rows else 0

    # Sin filtros: paginación. Con filtros: trae todo
    if has_filters or limit is None:
        sql = f"SELECT * FROM dbo.[{TABLE}] {where} ORDER BY FechaCreacion DESC, IdRegistro DESC"
        rows = query(sql, params)
    else:
        sql = (
            f"SELECT * FROM dbo.[{TABLE}] {where} "
            f"ORDER BY FechaCreacion DESC, IdRegistro DESC "
            f"OFFSET ? ROWS FETCH NEXT ? ROWS ONLY"
        )
        rows = query(sql, params + [offset, limit])

    return rows, total, has_filters


def get_by_id(id_registro):
    rows = query(f"SELECT * FROM dbo.[{TABLE}] WHERE IdRegistro = ?", [id_registro])
    return rows[0] if rows else None


def create(data, usuario):
    sql = f"""
        INSERT INTO dbo.[{TABLE}]
            (Tipo, CodMolde, Vehiculo, Pieza, Lote, Version, Repeticion,
             Ubicacion, Usos, Puesto, FechaCreacion, UsuarioCreate, FechaEdicion, UsuarioEdit)
        VALUES (?,?,?,?,?,?,?,?,?,?,GETDATE(),?,GETDATE(),?)
    """
    params = [
        data.get('tipo'), data.get('cod_molde'), data.get('vehiculo'),
        data.get('pieza'), data.get('lote'), data.get('version'),
        data.get('repeticion'), data.get('ubicacion'),
        int(data.get('usos') or 0),  # siempre int, evita error en columna INT
        data.get('puesto'), usuario, usuario,
    ]
    execute(sql, params)


def update(id_registro, data, usuario):
    sql = f"""
        UPDATE dbo.[{TABLE}] SET
            Tipo=?, CodMolde=?, Vehiculo=?, Pieza=?, Lote=?, Version=?,
            Repeticion=?, Ubicacion=?, Usos=?, Puesto=?,
            FechaEdicion=GETDATE(), UsuarioEdit=?
        WHERE IdRegistro=?
    """
    params = [
        data.get('tipo'), data.get('cod_molde'), data.get('vehiculo'),
        data.get('pieza'), data.get('lote'), data.get('version'),
        data.get('repeticion'), data.get('ubicacion'), data.get('usos'),
        data.get('puesto'), usuario, id_registro,
    ]
    execute(sql, params)


def soft_delete(id_registro, motivo, usuario):
    """Marca el registro como eliminado sin borrarlo físicamente."""
    execute(
        f"""UPDATE dbo.[{TABLE}] SET
            Activo = 0,
            MotivoEliminacion = ?,
            EliminadoPor = ?,
            FechaEliminacion = GETDATE()
            WHERE IdRegistro = ?""",
        [motivo, usuario, id_registro]
    )
