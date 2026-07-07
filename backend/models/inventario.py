import re
from backend.db import query, execute

TABLE = 'AppControlInventarios_RegistroInventario'

PAGE_SIZE = 100


def _pad(val, digits):
    """Zero-pad val a `digits` dígitos solo si es puramente numérico."""
    if not val:
        return val
    s = str(val).strip()
    return s.zfill(digits) if re.fullmatch(r'\d+', s) else s


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
            v = _pad(filters['cod_molde'], 4)
            if re.fullmatch(r'\d+', v):
                # Valor numérico: coincide exacto O equivalente numérico (cubre histórico sin padding)
                conditions.append(
                    '(CodMolde = ? OR (ISNUMERIC(CodMolde) = 1 AND CAST(CodMolde AS INT) = CAST(? AS INT)))'
                )
                params.extend([v, v])
            else:
                conditions.append('CodMolde LIKE ?')
                params.append(f"%{v}%")
            has_filters = True
        if filters.get('version'):
            conditions.append('Version LIKE ?')
            params.append(f"%{filters['version']}%")
            has_filters = True
        if filters.get('pieza'):
            v = _pad(filters['pieza'], 3)
            if re.fullmatch(r'\d+', v):
                conditions.append(
                    '(Pieza = ? OR (ISNUMERIC(Pieza) = 1 AND CAST(Pieza AS INT) = CAST(? AS INT)))'
                )
                params.extend([v, v])
            else:
                conditions.append('Pieza LIKE ?')
                params.append(f"%{v}%")
            has_filters = True
        if filters.get('repeticion'):
            conditions.append('Repeticion = ?')
            params.append(filters['repeticion'])
            has_filters = True

    # Excluir registros eliminados (soft-delete). Activo IS NULL = filas previas a la migración
    conditions.append("(Activo IS NULL OR Activo = 1)")

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ''

    # Contar total para el footer
    count_rows = query(f"SELECT COUNT(*) AS n FROM dbo.[{TABLE}] {where}", params)
    total = count_rows[0]['n'] if count_rows else 0

    sql = (
        f"SELECT * FROM dbo.[{TABLE}] {where} "
        f"ORDER BY FechaCreacion DESC, IdRegistro DESC "
        f"OFFSET ? ROWS FETCH NEXT ? ROWS ONLY"
    )
    rows = query(sql, params + [offset, limit or PAGE_SIZE])

    return rows, total, has_filters


def get_by_id(id_registro):
    rows = query(f"SELECT * FROM dbo.[{TABLE}] WHERE IdRegistro = ?", [id_registro])
    return rows[0] if rows else None


def create(data, usuario):
    sql = f"""
        INSERT INTO dbo.[{TABLE}]
            (Tipo, CodMolde, Vehiculo, Pieza, Lote, Version, Repeticion,
             Ubicacion, Usos, Puesto, FechaCreacion, UsuarioCreate, FechaEdicion, UsuarioEdit)
        VALUES (?,?,?,?,?,?,?,?,0,?,GETDATE(),?,GETDATE(),?)
    """
    params = [
        data.get('tipo'), _pad(data.get('cod_molde'), 4), data.get('vehiculo'),
        _pad(data.get('pieza'), 3), data.get('lote'), data.get('version'),
        data.get('repeticion'), data.get('ubicacion'),
        data.get('puesto'), usuario, usuario,
    ]
    execute(sql, params)


def update(id_registro, data, usuario):
    sql = f"""
        UPDATE dbo.[{TABLE}] SET
            Tipo=?, CodMolde=?, Vehiculo=?, Pieza=?, Lote=?, Version=?,
            Repeticion=?, Ubicacion=?, Puesto=?,
            FechaEdicion=GETDATE(), UsuarioEdit=?
        WHERE IdRegistro=?
    """
    params = [
        data.get('tipo'), _pad(data.get('cod_molde'), 4), data.get('vehiculo'),
        _pad(data.get('pieza'), 3), data.get('lote'), data.get('version'),
        data.get('repeticion'), data.get('ubicacion'),
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
