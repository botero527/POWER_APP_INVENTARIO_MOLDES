# Changelog para IT — Despliegue Producción
## App: Control Inventarios Ingeniería (AGP GROUP)

Este documento registra todos los cambios de estructura de base de datos y configuración
que deben aplicarse en el servidor de producción antes de desplegar la aplicación.

---

## [v1.4] — Índices de rendimiento para paginación

**Fecha estimada:** 2026-07-xx  
**Estado:** Pendiente de aplicar en PROD

### Descripción
La app usa paginación (100 registros + "Cargar más") con `ORDER BY fecha DESC`.
Sin índices, SQL Server hace un full scan en cada página. Estos índices hacen
las consultas ~10x más rápidas en producción con muchos usuarios simultáneos.

### Script SQL — aplicar en producción

```sql
-- RegistroInventario: paginación ordenada por fecha
CREATE INDEX IX_RegistroInventario_Fecha
  ON dbo.[AppControlInventarios_RegistroInventario] (FechaCreacion DESC, IdRegistro DESC)
  INCLUDE (Tipo, CodMolde, Version, Pieza, Activo);

-- ManttoHead: paginación ordenada por fecha + filtros frecuentes
CREATE INDEX IX_ManttoHead_Fecha
  ON dbo.[AppControlInventarios_ManttoHead] (FechaCreateMant DESC)
  INCLUDE (Estatus, CreadoPor, CodHer, Tipo);

-- ManttoHead: búsqueda por Estatus (filtro "Pendiente/Finalizado")
CREATE INDEX IX_ManttoHead_Estatus
  ON dbo.[AppControlInventarios_ManttoHead] (Estatus, FechaCreateMant DESC);

-- ManttoDetails: lookup por mantto (JOIN frecuente al abrir detalle)
CREATE INDEX IX_ManttoDetails_IdMant
  ON dbo.[AppControlInventarios_ManttoDetails] (IdMant, Clase);
```

### Verificación post-migración

```sql
-- Confirmar índices creados
SELECT name, type_desc FROM sys.indexes
WHERE object_id IN (
  OBJECT_ID('AppControlInventarios_RegistroInventario'),
  OBJECT_ID('AppControlInventarios_ManttoHead'),
  OBJECT_ID('AppControlInventarios_ManttoDetails')
) AND name LIKE 'IX_%';
```

### Impacto
- Operación no destructiva — solo agrega índices (no modifica datos).
- Puede tardar algunos segundos en tablas grandes (ManttoDetails con 234k filas).
- **Sin pérdida de datos.** Sin reinicio necesario.

---

## [v1.3] — Cancelación de mantenimientos en ManttoHead

**Fecha estimada:** 2026-07-xx  
**Estado:** Pendiente de aplicar en PROD

### Descripción
Se agregó la funcionalidad de "cancelación" de mantenimientos en estado **Pendiente**.
Los registros **no se borran físicamente**; el campo `Estatus` cambia a `'Cancelado'`
y se registran el motivo, el usuario que canceló y la fecha.

### Script SQL — aplicar en producción

```sql
-- ============================================================
-- Tabla: AppControlInventarios_ManttoHead
-- Base de datos: AGP_Ingenieria
-- ============================================================

ALTER TABLE dbo.[AppControlInventarios_ManttoHead]
    ADD MotivoCancelacion NVARCHAR(500) NULL,
        CanceladoPor      NVARCHAR(100) NULL,
        FechaCancelacion  DATETIME      NULL;
```

### Verificación post-migración

```sql
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'AppControlInventarios_ManttoHead'
  AND COLUMN_NAME IN ('MotivoCancelacion','CanceladoPor','FechaCancelacion');
```

### Impacto
- Operación no destructiva — solo agrega columnas nuevas (NULL por defecto).
- Los mantenimientos cancelados quedan visibles en la lista con estatus 'Cancelado'.
- Solo administradores pueden cancelar; solo aplica a registros con Estatus = 'Pendiente'.
- Requiere reinicio del servicio web.

---

## [v1.2] — Ampliar columnas de AppControlInventarios_ManttoHead

**Fecha estimada:** 2026-07-xx  
**Estado:** Pendiente de aplicar en PROD

### Problema
Las columnas `Pieza`, `Version`, `CodHer` y `Tipo` en `ManttoHead` tienen tamaños muy pequeños
(varchar(3), varchar(3), varchar(10), varchar(1)) heredados de la Power App original.
Los valores reales del inventario son más largos (ej: Pieza `00/1840009` = 10 chars),
causando error `String or binary data would be truncated` al crear mantenimientos.

### Script SQL — aplicar en producción

```sql
-- ============================================================
-- Tabla: AppControlInventarios_ManttoHead
-- Base de datos: AGP_Ingenieria
-- ============================================================

ALTER TABLE dbo.[AppControlInventarios_ManttoHead] ALTER COLUMN Pieza   NVARCHAR(100) NULL;
ALTER TABLE dbo.[AppControlInventarios_ManttoHead] ALTER COLUMN Version  NVARCHAR(100) NULL;
ALTER TABLE dbo.[AppControlInventarios_ManttoHead] ALTER COLUMN CodHer  NVARCHAR(100) NULL;
ALTER TABLE dbo.[AppControlInventarios_ManttoHead] ALTER COLUMN Tipo    NVARCHAR(20)  NULL;
```

### Impacto
- Operación no destructiva — solo amplía el tamaño permitido, no borra datos.
- Sin pérdida de datos existentes.
- Requiere reinicio del servicio web.

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
