#!/usr/bin/env python
"""
Script para crear asesores básicos basándose en los nombres del CSV de presencias
Uso: python manage.py shell < crear_asesores_basicos.py
"""

import csv
import os
from datetime import datetime
from django.utils import timezone
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist

# Importar los modelos
from gestion_inmobiliaria.models import Asesor

def clean_string(value):
    """Limpia y valida strings"""
    if value is None:
        return ''
    return str(value).strip()

def find_asesor_by_name(nombre):
    """Busca un asesor por nombre"""
    if not nombre:
        return None
    
    nombre_clean = clean_string(nombre)
    
    # Buscar coincidencias exactas
    try:
        asesor = Asesor.objects.get(nombre_asesor__iexact=nombre_clean)
        return asesor
    except ObjectDoesNotExist:
        pass
    
    # Buscar coincidencias parciales
    try:
        asesor = Asesor.objects.filter(nombre_asesor__icontains=nombre_clean).first()
        if asesor:
            return asesor
    except:
        pass
    
    return None

def crear_asesores_desde_presencias(archivo_csv):
    """Crea asesores básicos basándose en los nombres del CSV de presencias"""
    
    if not os.path.exists(archivo_csv):
        print(f"❌ El archivo {archivo_csv} no existe")
        return
    
    print(f"🚀 Creando asesores básicos desde {archivo_csv}")
    print("=" * 60)
    
    # Conjunto para almacenar nombres únicos de asesores
    asesores_encontrados = set()
    
    try:
        with open(archivo_csv, 'r', encoding='utf-8') as file:
            # Detectar delimitador
            sample = file.read(1024)
            file.seek(0)
            
            if ';' in sample:
                delimiter = ';'
            elif ',' in sample:
                delimiter = ','
            else:
                delimiter = '\t'
            
            reader = csv.DictReader(file, delimiter=delimiter)
            
            for row in reader:
                # Extraer nombres de asesores de las columnas relevantes
                opc = clean_string(row.get('OPC', ''))
                liner = clean_string(row.get('LINER', ''))
                closer = clean_string(row.get('CLOSER', ''))
                tmk_nombre = clean_string(row.get('TMK_NOMBRE', ''))
                supervisor_tlmk = clean_string(row.get('SUPERVISOR_TLMK', ''))
                
                # Agregar nombres únicos al conjunto
                for nombre in [opc, liner, closer, tmk_nombre, supervisor_tlmk]:
                    if nombre and nombre.strip():
                        asesores_encontrados.add(nombre.strip())
    
    except Exception as e:
        print(f"❌ Error leyendo archivo CSV: {e}")
        return
    
    print(f"📋 Asesores encontrados en el CSV: {len(asesores_encontrados)}")
    print("Nombres:", ", ".join(sorted(asesores_encontrados)))
    
    # Crear asesores básicos
    asesores_creados = 0
    asesores_existentes = 0
    
    for nombre in sorted(asesores_encontrados):
        print(f"\n📋 Procesando asesor: {nombre}")
        
        try:
            with transaction.atomic():
                # Verificar si ya existe
                asesor_existente = find_asesor_by_name(nombre)
                
                if asesor_existente:
                    print(f"✅ Asesor ya existe: {asesor_existente.id_asesor}")
                    asesores_existentes += 1
                else:
                    # Crear asesor básico
                    asesor_data = {
                        'nombre_asesor': nombre,
                        'fecha_ingreso': timezone.now().date(),
                        'tipo_asesor_actual': 'Junior',  # Por defecto
                    }
                    
                    asesor = Asesor.objects.create(**asesor_data)
                    asesores_creados += 1
                    print(f"✅ Asesor creado: {asesor.id_asesor}")
        
        except Exception as e:
            print(f"❌ Error creando asesor {nombre}: {e}")
            continue
    
    # Resumen final
    print("\n" + "=" * 60)
    print("📊 RESUMEN DE CREACIÓN DE ASESORES")
    print("=" * 60)
    print(f"Total asesores encontrados: {len(asesores_encontrados)}")
    print(f"Asesores creados: {asesores_creados}")
    print(f"Asesores ya existían: {asesores_existentes}")
    
    if asesores_creados > 0:
        print("\n🎉 ¡Asesores básicos creados exitosamente!")
        print("📝 Nota: Los asesores se crearon como 'Junior' por defecto.")
        print("   Puedes cambiar su tipo desde el admin si es necesario.")
    else:
        print("\nℹ️  No se crearon nuevos asesores (todos ya existían)")

def crear_asesores_manuales():
    """Crea asesores básicos manualmente basándose en los nombres típicos"""
    
    print("🚀 Creando asesores básicos manualmente")
    print("=" * 60)
    
    # Lista de asesores típicos que aparecen en el CSV
    asesores_tipicos = [
        'CLARA',
        'BRIAN', 
        'EDUARDO',
        'SAUL',
        'CARMEN'
    ]
    
    asesores_creados = 0
    asesores_existentes = 0
    
    for nombre in asesores_tipicos:
        print(f"\n📋 Procesando asesor: {nombre}")
        
        try:
            with transaction.atomic():
                # Verificar si ya existe
                asesor_existente = find_asesor_by_name(nombre)
                
                if asesor_existente:
                    print(f"✅ Asesor ya existe: {asesor_existente.id_asesor}")
                    asesores_existentes += 1
                else:
                    # Crear asesor básico
                    asesor_data = {
                        'nombre_asesor': nombre,
                        'fecha_ingreso': timezone.now().date(),
                        'tipo_asesor_actual': 'Junior',  # Por defecto
                    }
                    
                    asesor = Asesor.objects.create(**asesor_data)
                    asesores_creados += 1
                    print(f"✅ Asesor creado: {asesor.id_asesor}")
        
        except Exception as e:
            print(f"❌ Error creando asesor {nombre}: {e}")
            continue
    
    # Resumen final
    print("\n" + "=" * 60)
    print("📊 RESUMEN DE CREACIÓN DE ASESORES")
    print("=" * 60)
    print(f"Total asesores procesados: {len(asesores_tipicos)}")
    print(f"Asesores creados: {asesores_creados}")
    print(f"Asesores ya existían: {asesores_existentes}")
    
    if asesores_creados > 0:
        print("\n🎉 ¡Asesores básicos creados exitosamente!")
        print("📝 Nota: Los asesores se crearon como 'Junior' por defecto.")
        print("   Puedes cambiar su tipo desde el admin si es necesario.")
    else:
        print("\nℹ️  No se crearon nuevos asesores (todos ya existían)")

if __name__ == "__main__":
    # Opción 1: Crear asesores desde el CSV de presencias
    archivo_csv = "presencias_import.csv"
    if os.path.exists(archivo_csv):
        crear_asesores_desde_presencias(archivo_csv)
    else:
        # Opción 2: Crear asesores manualmente
        crear_asesores_manuales() 