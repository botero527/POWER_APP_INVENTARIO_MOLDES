"""
Normaliza CodMolde (4 dígitos) y Pieza (3 dígitos) en registros históricos.
Solo afecta valores puramente numéricos — alfanuméricos como 'AL1715' se dejan intactos.
Ejecutar una sola vez antes de usar los filtros mejorados.
"""
import re, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.db import query, execute


def _pad(val, digits):
    if not val:
        return val
    s = str(val).strip()
    return s.zfill(digits) if re.fullmatch(r'\d+', s) else s


def normalizar():
    rows = query(
        "SELECT IdRegistro, CodMolde, Pieza "
        "FROM dbo.[AppControlInventarios_RegistroInventario] "
        "WHERE Activo IS NULL OR Activo = 1"
    )
    print(f"Total registros activos: {len(rows)}")

    updates = []
    for r in rows:
        new_cod   = _pad(r['CodMolde'], 4)
        new_pieza = _pad(r['Pieza'], 3)
        if new_cod != r['CodMolde'] or new_pieza != r['Pieza']:
            updates.append((new_cod, new_pieza, r['IdRegistro'],
                            r['CodMolde'], r['Pieza']))

    if not updates:
        print("Ningún registro necesita normalización.")
        return

    print(f"\nRegistros a actualizar: {len(updates)}")
    for new_cod, new_pieza, id_, old_cod, old_pieza in updates[:10]:
        print(f"  ID {id_:>6}: CodMolde {old_cod!r:>8} -> {new_cod!r:<8}  "
              f"Pieza {old_pieza!r:>5} -> {new_pieza!r}")
    if len(updates) > 10:
        print(f"  ... y {len(updates)-10} más")

    if '--yes' not in sys.argv:
        confirm = input("\n¿Aplicar cambios? (s/N): ").strip().lower()
        if confirm != 's':
            print("Cancelado.")
            return

    for new_cod, new_pieza, id_, *_ in updates:
        execute(
            "UPDATE dbo.[AppControlInventarios_RegistroInventario] "
            "SET CodMolde=?, Pieza=? WHERE IdRegistro=?",
            [new_cod, new_pieza, id_]
        )

    print(f"\nOK: {len(updates)} registros normalizados.")


if __name__ == '__main__':
    normalizar()
