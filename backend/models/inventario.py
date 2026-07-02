from backend.db import query, execute

TABLE = 'AppControlInventarios_RegistroInventario'

UBICACIONES = ['HORNOS', 'MATRICERIA', 'MEZANINE', 'PARQUEADERO', 'B10', 'B15']
TIPOS = ['M', 'G']


def get_all(filters=None):
    conditions = []
    params = []

    if filters:
        if filters.get('tipo'):
            conditions.append('Tipo = ?')
            params.append(filters['tipo'])
        if filters.get('cod_molde'):
            conditions.append('CodMolde LIKE ?')
            params.append(f"%{filters['cod_molde']}%")
        if filters.get('version'):
            conditions.append('Version LIKE ?')
            params.append(f"%{filters['version']}%")
        if filters.get('pieza'):
            conditions.append('Pieza LIKE ?')
            params.append(f"%{filters['pieza']}%")

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ''
    sql = f"SELECT * FROM dbo.[{TABLE}] {where} ORDER BY CodMolde, Repeticion"
    return query(sql, params)


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
        data.get('repeticion'), data.get('ubicacion'), data.get('usos', '0'),
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


def delete(id_registro):
    execute(f"DELETE FROM dbo.[{TABLE}] WHERE IdRegistro=?", [id_registro])
