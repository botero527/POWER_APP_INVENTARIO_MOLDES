"""
Modelo para AppControlInventarios_Opciones.
Gestiona las listas desplegables configurables desde el panel de administracion.
"""
from backend.db import query, execute, execute_returning

TABLE = 'AppControlInventarios_Opciones'

# Longitud maxima permitida por campo en ManttoHead
MAX_LENS = {
    'tipo_mant':     95,
    'estado_postes': 95,
    'patron_ref':    95,
    'tipo_inv':      10,
    'ubicacion_inv': 50,
}

# Labels canonicos por grupo
GROUP_LABELS = {
    'tipo_mant':     'Tipo de Mantenimiento',
    'estado_postes': 'Estado de Postes',
    'patron_ref':    'Patron de Referencia',
    'tipo_inv':      'Tipo Herramental (Inventario)',
    'ubicacion_inv': 'Ubicacion (Inventario)',
}


def get_all():
    """
    Retorna todas las opciones activas agrupadas:
    { grupo: { label, max_len, options: [{id, valor, orden}] } }
    """
    rows = query(
        f"SELECT Id, Grupo, GrupoLabel, Valor, Orden "
        f"FROM dbo.[{TABLE}] WHERE Activo=1 ORDER BY Grupo, Orden, Id",
        []
    )
    result = {}
    for r in rows:
        g = r['Grupo']
        if g not in result:
            result[g] = {
                'label':   r['GrupoLabel'],
                'max_len': MAX_LENS.get(g, 200),
                'options': [],
            }
        result[g]['options'].append({
            'id':    r['Id'],
            'valor': r['Valor'],
            'orden': r['Orden'],
        })
    return result


def get_by_grupo(grupo):
    """Lista de opciones activas para un grupo, ordenadas por Orden."""
    rows = query(
        f"SELECT Id, Valor, Orden FROM dbo.[{TABLE}] "
        f"WHERE Activo=1 AND Grupo=? ORDER BY Orden, Id",
        [grupo]
    )
    return [{'id': r['Id'], 'valor': r['Valor'], 'orden': r['Orden']} for r in rows]


def create(grupo, grupo_label, valor, orden):
    """INSERT una nueva opcion. Retorna el nuevo Id."""
    rows = execute_returning(
        f"INSERT INTO dbo.[{TABLE}] (Grupo, GrupoLabel, Valor, Orden, Activo) "
        f"OUTPUT INSERTED.Id VALUES (?,?,?,?,1)",
        [grupo, grupo_label, valor, orden]
    )
    return rows[0]['Id'] if rows else None


def update(id_op, valor, orden):
    """UPDATE valor y orden de una opcion existente."""
    execute(
        f"UPDATE dbo.[{TABLE}] SET Valor=?, Orden=? WHERE Id=?",
        [valor, orden, id_op]
    )


def delete(id_op):
    """Hard delete de una opcion."""
    execute(f"DELETE FROM dbo.[{TABLE}] WHERE Id=?", [id_op])
