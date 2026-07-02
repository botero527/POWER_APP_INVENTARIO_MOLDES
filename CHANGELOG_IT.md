# Changelog para IT — Despliegue Producción
## App: Control Inventarios Ingeniería (AGP GROUP)

Este documento registra todos los cambios de estructura de base de datos y configuración
que deben aplicarse en el servidor de producción antes de desplegar la aplicación.

---

## [v1.1] — Soft-delete en módulo Consultar

**Fecha estimada:** 2026-07-xx  
**Responsable:** Desarrollo Ingeniería  
**Estado:** Pendiente de aplicar en PROD

### Descripción
Se agregó la funcionalidad de "eliminación lógica" en el inventario de herramientas.
Los registros **no se borran físicamente** de la base de datos; en cambio, se marcan como
inactivos (`Activo = 0`) y se registra quién los eliminó, cuándo, y por qué motivo.

### Script SQL — aplicar en producción

```sql
-- ============================================================
-- Tabla: AppControlInventarios_RegistroInventario
-- Base de datos: AGP_Ingenieria
-- ============================================================

ALTER TABLE dbo.[AppControlInventarios_RegistroInventario]
    ADD Activo           BIT           NOT NULL DEFAULT 1,
        MotivoEliminacion NVARCHAR(500) NULL,
        EliminadoPor      NVARCHAR(100) NULL,
        FechaEliminacion  DATETIME      NULL;
```

### Verificación post-migración

```sql
-- Confirmar columnas agregadas
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'AppControlInventarios_RegistroInventario'
  AND COLUMN_NAME IN ('Activo','MotivoEliminacion','EliminadoPor','FechaEliminacion');

-- Confirmar que todos los registros previos quedan como activos (Activo = 1)
SELECT COUNT(*) AS TotalRegistros,
       SUM(CASE WHEN Activo = 1 THEN 1 ELSE 0 END) AS Activos,
       SUM(CASE WHEN Activo = 0 THEN 1 ELSE 0 END) AS Eliminados
FROM dbo.[AppControlInventarios_RegistroInventario];
```

### Impacto
- Los registros existentes en producción recibirán `Activo = 1` automáticamente (DEFAULT).
- La app **no mostrará** registros con `Activo = 0` en la tabla de consulta.
- Requiere reinicio del servicio web luego de aplicar el script.
- **Sin pérdida de datos** — operación no destructiva.

---

## [v1.0] — Deploy inicial

**Fecha:** 2026-07  
**Tablas utilizadas (solo lectura/escritura, sin cambios de estructura):**
- `dbo.AppControlInventarios_RegistroInventario`
- `dbo.AppControlInventarios_ManttoHerramientales`
- `dbo.AppControlInventarios_ManttoHerramientalesDetalle`
- `dbo.AppControlInventarios_ImagenesMoldes`
- `dbo.AppControlInventarios_Usuarios`

---

## Notas generales

- Servidor DB: `agpcolombia.database.windows.net`
- Base de datos: `AGP_Ingenieria`
- Usuario app: `DevIngenieria` (permisos: SELECT, INSERT, UPDATE — **sin DELETE**)
- Las imágenes se almacenan en Azure Blob Storage (contenedor: `imagenes-moldes`)
