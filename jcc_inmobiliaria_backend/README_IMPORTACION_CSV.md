# 📋 Guía de Importación de Datos CSV - JCC Inmobiliaria

## 🎯 Descripción General

Esta guía te ayudará a importar datos históricos desde archivos CSV a tu aplicación Django de gestión inmobiliaria. Los scripts están diseñados para manejar el formato específico de tus datos y crear automáticamente las relaciones entre clientes, lotes, presencias y ventas.

## 🔄 Flujo de Negocio Especial

### Manejo de Presencias Duplicadas
**IMPORTANTE:** En tu tabla de presencias, las filas duplicadas representan un flujo de negocio específico:

- **Separaciones que evolucionan:** Una presencia con status "SEPARACION" puede aparecer nuevamente en meses posteriores con status "PROCESABLE" o "COMPLETADA"
- **Columna FECHA:** Indica el mes donde se procesan ventas que anteriormente quedaron como separaciones
- **Columna FECHA.1:** Indica la fecha real de la presencia física
- **ID_LEAD:** Conecta con tu CRM externo para mapeo de leads

### Conexión con CRM Externo
- El campo `ID_LEAD` se usa para conectar con tu aplicación CRM existente
- Los scripts buscan clientes primero por ID_LEAD, luego por DNI, nombre o teléfono
- Se mantiene la integridad referencial entre sistemas

## 📊 Estructura de Datos CSV

### Mapeo de Campos del CSV a Modelos Django

**CLIENTE:**
- `INVITADO` → `nombres_completos_razon_social`
- `DNI` → `numero_documento`
- `CELULAR` → `telefono_principal`
- `DISTRITO` → `distrito`
- `ID_LEAD` → `id_lead` (conexión con CRM)

**LOTE:**
- `COSTO LOTE` → `precio_venta_soles`
- `LOTE` → `numero_lote`
- `MZ` → `manzana`
- `PROYECTO` → `ubicacion_proyecto`

**PRESENCIA:**
- `FECHA.1` → `fecha_hora_presencia` (fecha de presencia física)
- `FECHA` → `fecha_venta` (mes de procesamiento de venta)
- `FUENTE` → `medio_captacion`
- `VISITA` → `modalidad`
- `STATUS` → `status_presencia`
- `OBSERVACION` → `observaciones`
- `TOUR` → `tipo_tour`
- `OPC` → `asesor_captacion_opc` (captador)
- `TMK` → `asesor_call_agenda` (operador llamadas)
- `SUP_TLMK` → Supervisor (no mapeado actualmente)
- `LINER` → `asesor_liner` (presentador)
- `CLOSER` → `asesor_closer` (negociador)

**VENTA:**
- `FECHA` → `fecha_venta` (mes de venta)
- `CUOTA` → `cuota_inicial_requerida`
- `COBRANZA` → `monto_pagado_actual`
- `RECAUDO` → Se usa para crear `RegistroPago`
- `MEDIO PAGO` → `metodo_pago` en `RegistroPago`
- `CONTADO/CREDITO` → `tipo_venta`
- `STATUS` → `status_venta`

## 🚀 Scripts Disponibles

### 1. `crear_asesores_basicos.py`
**Propósito:** Crear asesores básicos desde nombres encontrados en el CSV de presencias.

**Uso:**
```bash
cd jcc_inmobiliaria_backend
python manage.py shell < crear_asesores_basicos.py
```

**Funcionalidad:**
- Extrae nombres únicos de las columnas OPC, TMK, SUP_TLMK, LINER, CLOSER
- Crea asesores con datos básicos
- Asigna roles según la función (captador, operador, supervisor, presentador, negociador)

### 2. `importar_presencias_csv.py`
**Propósito:** Importar presencias con manejo especial de duplicados y evolución de status.

**Uso:**
```bash
cd jcc_inmobiliaria_backend
python manage.py shell < importar_presencias_csv.py
```

**Funcionalidad:**
- Crea clientes automáticamente si no existen
- Busca asesores por nombre
- **Maneja presencias duplicadas** usando ID_LEAD
- **Actualiza status** de separaciones que se vuelven procesables
- Conecta con CRM externo a través de ID_LEAD
- Maneja duplicados actualizando registros existentes

### 3. `importar_ventas_completas.py`
**Propósito:** Importar ventas con manejo de evolución de status y conexión CRM.

**Uso:**
```bash
cd jcc_inmobiliaria_backend
python manage.py shell < importar_ventas_completas.py
```

**Funcionalidad:**
- Procesa solo filas con status de venta válido (SEPARACION, PROCESABLE, COMPLETADA)
- **Detecta evolución de status** (separación → procesable → completada)
- Crea ventas con información completa
- Registra pagos iniciales automáticamente
- **Conecta con CRM** usando ID_LEAD
- Maneja relaciones entre clientes, lotes y asesores

### 4. `importar_lotes_y_presencias.py`
**Propósito:** Script combinado que importa lotes, presencias y ventas en una sola ejecución.

**Uso:**
```bash
cd jcc_inmobiliaria_backend
python manage.py shell < importar_lotes_y_presencias.py
```

**Funcionalidad:**
- Crea lotes automáticamente si no existen
- Importa presencias con mapeo completo
- **Maneja evolución de status** de presencias y ventas
- Crea ventas para registros con status válido
- Registra pagos iniciales
- **Conecta con CRM** a través de ID_LEAD
- Maneja todas las relaciones automáticamente

## 📋 Orden de Ejecución Recomendado

### Opción 1: Ejecución por Pasos (Recomendado para datos grandes)

1. **Crear asesores básicos:**
   ```bash
   python manage.py shell < crear_asesores_basicos.py
   ```

2. **Importar presencias (con manejo de duplicados):**
   ```bash
   python manage.py shell < importar_presencias_csv.py
   ```

3. **Importar ventas (con evolución de status):**
   ```bash
   python manage.py shell < importar_ventas_completas.py
   ```

### Opción 2: Ejecución Combinada (Recomendado para datos pequeños)

```bash
python manage.py shell < importar_lotes_y_presencias.py
```

## 📁 Archivos CSV Requeridos

### `presencias_import.csv`
Formato esperado con delimitador `;`:

```csv
FECHA;CÓDIGO;ID_LEAD;FECHA.1;TOUR;INVITADO;DNI;CELULAR;VISITA;DISTRITO;FUENTE;OPC;TMK;SUP_TLMK;LINER;CLOSER;COSTO LOTE;LOTE;CUOTA;COBRANZA;MZ;STATUS;OBSERVACION;LOTES;RECAUDO;MEDIO PAGO;4%;4,50%;2,00%;PROYECTO;CONTADO/CREDITO
01/11/2023;;6942;04/11/2023;TOUR;ERIKA PEREZ NOGUNI;;900490075;SALA LINCE;;REDES;;CLARA;;BRIAN;EDUARDO;2600,00;1;1;2600,00;A;SEPARACION;SEP. S/2600 Lote 1;1;2600,00;EFECTIVO;;;;PROYECTO PRINCIPAL;CREDITO
01/12/2023;;6942;04/11/2023;TOUR;ERIKA PEREZ NOGUNI;;900490075;SALA LINCE;;REDES;;CLARA;;BRIAN;EDUARDO;2600,00;1;1;2600,00;A;PROCESABLE;PROCESANDO VENTA;1;2600,00;EFECTIVO;;;;PROYECTO PRINCIPAL;CREDITO
```

**Nota:** La segunda fila muestra cómo una separación (noviembre) evoluciona a procesable (diciembre) con el mismo ID_LEAD.

## ⚙️ Configuración y Personalización

### Personalizar Nombres de Proyectos
En los scripts, puedes cambiar el nombre por defecto del proyecto:

```python
# En la función find_or_create_lote()
proyecto = clean_string(row.get('PROYECTO', 'TU PROYECTO AQUÍ'))
```

### Personalizar Mapeos
Los scripts incluyen funciones de mapeo que puedes modificar:

- `map_medio_captacion()`: Mapea fuentes de captación
- `map_status_presencia()`: Mapea estados de presencia
- `map_tipo_tour()`: Mapea tipos de tour
- `map_status_venta()`: Mapea estados de venta
- `map_metodo_pago()`: Mapea métodos de pago

## 🔍 Manejo de Errores y Validaciones

### Validaciones Automáticas
- **Clientes duplicados:** Se buscan por ID_LEAD, DNI, nombre o teléfono
- **Lotes duplicados:** Se buscan por número, manzana y proyecto
- **Presencias duplicadas:** Se buscan por ID_LEAD y proyecto (manejo especial)
- **Ventas duplicadas:** Se buscan por ID_LEAD y lote (evolución de status)

### Manejo Especial de Duplicados
- **Presencias:** Las duplicadas se actualizan en lugar de crear nuevas
- **Ventas:** Se detecta evolución de status (separación → procesable → completada)
- **ID_LEAD:** Se usa como clave principal para conectar con CRM
- **Status:** Se actualiza automáticamente según la evolución del negocio

### Manejo de Datos Faltantes
- **DNI vacío:** Se genera un DNI temporal
- **Teléfono vacío:** Se deja como NULL
- **Fechas inválidas:** Se usa la fecha actual
- **Precios inválidos:** Se usan 0.00
- **ID_LEAD vacío:** Se busca por otros criterios

### Logs y Reportes
Cada script genera:
- ✅ Confirmaciones de creación/actualización
- 🔄 Información sobre duplicados manejados
- 📈 Evolución de status detectada
- ⚠️ Advertencias sobre datos no encontrados
- ❌ Errores con detalles específicos
- 📊 Resumen final con estadísticas

## 🛠️ Solución de Problemas

### Error: "No module named 'gestion_inmobiliaria'"
**Solución:** Asegúrate de estar en el directorio correcto:
```bash
cd jcc_inmobiliaria_backend
```

### Error: "Database connection failed"
**Solución:** Verifica que la base de datos esté configurada y accesible.

### Error: "CSV file not found"
**Solución:** Verifica que el archivo CSV esté en el directorio correcto y tenga el nombre esperado.

### Datos no se importan correctamente
**Solución:** 
1. Verifica el formato del CSV (delimitadores, encoding)
2. Revisa los logs para identificar errores específicos
3. Ajusta las funciones de mapeo según sea necesario

### Problemas con duplicados
**Solución:**
1. Verifica que el ID_LEAD esté presente en el CSV
2. Revisa los logs de "presencias duplicadas manejadas"
3. Confirma que la evolución de status sea correcta

## 📈 Monitoreo y Verificación

### Verificar Importación
Después de la importación, puedes verificar los datos:

```python
# En Django shell
from gestion_inmobiliaria.models import Cliente, Lote, Presencia, Venta

# Contar registros
print(f"Clientes: {Cliente.objects.count()}")
print(f"Lotes: {Lote.objects.count()}")
print(f"Presencias: {Presencia.objects.count()}")
print(f"Ventas: {Venta.objects.count()}")

# Verificar conexión con CRM
clientes_con_lead = Cliente.objects.filter(id_lead__isnull=False).count()
print(f"Clientes conectados con CRM: {clientes_con_lead}")

# Verificar evolución de ventas
ventas_separacion = Venta.objects.filter(status_venta='separacion').count()
ventas_procesable = Venta.objects.filter(status_venta='procesable').count()
ventas_completada = Venta.objects.filter(status_venta='completada').count()
print(f"Ventas en separación: {ventas_separacion}")
print(f"Ventas procesables: {ventas_procesable}")
print(f"Ventas completadas: {ventas_completada}")
```

### Limpiar Datos de Prueba
Si necesitas limpiar datos de prueba:

```python
# En Django shell (¡CUIDADO!)
Cliente.objects.all().delete()
Lote.objects.all().delete()
Presencia.objects.all().delete()
Venta.objects.all().delete()
```

## 🔗 Integración con CRM

### Conexión a través de ID_LEAD
- El campo `ID_LEAD` conecta tu sistema Django con el CRM externo
- Los scripts buscan clientes primero por ID_LEAD
- Se mantiene la integridad referencial entre sistemas
- Permite sincronización bidireccional de datos

### Flujo de Datos
1. **Importación:** Los datos del CSV se importan con ID_LEAD
2. **Conexión:** El sistema Django se conecta con el CRM usando ID_LEAD
3. **Sincronización:** Los cambios se reflejan en ambos sistemas
4. **Evolución:** El status evoluciona según el flujo de negocio

## 🎯 Próximos Pasos

1. **Ejecutar scripts en orden**
2. **Verificar datos importados**
3. **Confirmar conexión con CRM**
4. **Ajustar mapeos si es necesario**
5. **Configurar usuarios y permisos**
6. **Probar funcionalidades del frontend**
7. **Monitorear evolución de status**

## 📞 Soporte

Si encuentras problemas durante la importación:
1. Revisa los logs detallados
2. Verifica el formato del CSV
3. Confirma que el ID_LEAD esté presente
4. Asegúrate de que la base de datos esté configurada correctamente
5. Consulta la documentación de Django si es necesario

¡La importación está lista para comenzar! 🚀

**Nota especial:** El sistema está diseñado para manejar automáticamente el flujo de negocio donde las separaciones evolucionan a ventas procesables, manteniendo la integridad de los datos y la conexión con tu CRM externo. 