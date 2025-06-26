#!/usr/bin/env python
"""
Script principal para importar datos completos desde CSV
Incluye importación de asesores, lotes, presencias y ventas en el orden correcto
Uso: python manage.py shell < importar_datos_completos.py
"""

import os
import sys
from datetime import datetime

# Importar las funciones de los otros scripts
from importar_asesores_csv import importar_asesores_desde_csv
from importar_lotes_csv import importar_lotes_desde_csv
from importar_presencias_csv import importar_presencias_desde_csv
from importar_ventas_csv import importar_ventas_desde_csv

def main():
    """Función principal que ejecuta la importación completa en el orden correcto"""
    
    print("🚀 INICIANDO IMPORTACIÓN COMPLETA DE DATOS")
    print("=" * 60)
    print(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # Verificar archivos CSV disponibles
    archivos_csv = {
        'asesores': 'asesores_import.csv',
        'lotes': 'lotes_import.csv', 
        'presencias': 'presencias_import.csv',
        'ventas': 'presencias_import.csv'  # Usar el mismo archivo para ventas
    }
    
    archivos_existentes = {}
    for tipo, archivo in archivos_csv.items():
        if os.path.exists(archivo):
            archivos_existentes[tipo] = archivo
            print(f"✅ Archivo encontrado: {archivo} ({tipo})")
        else:
            print(f"⚠️  Archivo no encontrado: {archivo} ({tipo})")
    
    if not archivos_existentes:
        print("❌ No se encontraron archivos CSV para importar")
        return
    
    print(f"\n📋 Archivos a procesar: {len(archivos_existentes)}")
    
    # Paso 1: Importar asesores (requerido para presencias y ventas)
    if 'asesores' in archivos_existentes:
        print("\n📋 PASO 1: IMPORTANDO ASESORES")
        print("-" * 40)
        importar_asesores_desde_csv(archivos_existentes['asesores'])
    else:
        print("\n⚠️  PASO 1: ASESORES - No se encontró archivo CSV")
        print("   Los asesores deben existir previamente en el sistema")
    
    # Paso 2: Importar lotes (requerido para presencias y ventas)
    if 'lotes' in archivos_existentes:
        print("\n📋 PASO 2: IMPORTANDO LOTES")
        print("-" * 40)
        importar_lotes_desde_csv(archivos_existentes['lotes'])
    else:
        print("\n⚠️  PASO 2: LOTES - No se encontró archivo CSV")
        print("   Los lotes deben existir previamente en el sistema")
    
    # Paso 3: Importar presencias
    if 'presencias' in archivos_existentes:
        print("\n📋 PASO 3: IMPORTANDO PRESENCIAS")
        print("-" * 40)
        importar_presencias_desde_csv(archivos_existentes['presencias'])
    else:
        print("\n⚠️  PASO 3: PRESENCIAS - No se encontró archivo CSV")
    
    # Paso 4: Importar ventas
    if 'ventas' in archivos_existentes:
        print("\n📋 PASO 4: IMPORTANDO VENTAS")
        print("-" * 40)
        importar_ventas_desde_csv(archivos_existentes['ventas'])
    else:
        print("\n⚠️  PASO 4: VENTAS - No se encontró archivo CSV")
    
    print("\n" + "=" * 60)
    print("🎉 IMPORTACIÓN COMPLETA FINALIZADA")
    print("=" * 60)
    print("✅ Asesores importados/verificados")
    print("✅ Lotes importados/verificados")
    print("✅ Presencias importadas")
    print("✅ Ventas importadas")
    print("✅ Clientes creados/actualizados automáticamente")
    print("\n📝 Notas importantes:")
    print("- Verifica que todos los asesores y lotes se importaron correctamente")
    print("- Revisa los logs para identificar posibles errores")
    print("- Los clientes se crean automáticamente si no existen")
    print("- Las presencias y ventas se actualizan si ya existen")

if __name__ == "__main__":
    main() 