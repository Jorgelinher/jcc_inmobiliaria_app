#!/usr/bin/env python
"""
Script para importar asesores desde CSV a Django
Uso: python manage.py shell < importar_asesores_csv.py
"""

import csv
import os
import sys
from datetime import datetime
from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist, ValidationError

# Importar los modelos
from gestion_inmobiliaria.models import Asesor

def parse_date(date_str):
    """Convierte string de fecha a objeto datetime"""
    if not date_str or date_str.strip() == '':
        return None
    
    # Intentar diferentes formatos de fecha
    date_formats = [
        '%d/%m/%Y',
        '%Y-%m-%d',
        '%d-%m-%Y',
        '%m/%d/%Y'
    ]
    
    for fmt in date_formats:
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except ValueError:
            continue
    
    print(f"⚠️  No se pudo parsear la fecha: {date_str}")
    return None

def clean_string(value):
    """Limpia y valida strings"""
    if value is None:
        return ''
    return str(value).strip()

def parse_integer(value):
    """Convierte string a integer"""
    if not value or value.strip() == '':
        return None
    
    try:
        return int(str(value).strip())
    except:
        return None

def map_tipo_asesor(tipo_str):
    """Mapea el tipo de asesor"""
    if not tipo_str:
        return 'Junior'
    
    tipo_clean = clean_string(tipo_str).upper()
    
    mapping = {
        'JUNIOR': 'Junior',
        'SOCIO': 'Socio',
        'LIDER': 'Socio',
        'SUPERVISOR': 'Socio',
    }
    
    for key, value in mapping.items():
        if key in tipo_clean:
            return value
    
    return 'Junior'  # Por defecto

def map_banco(banco_str):
    """Mapea el banco"""
    if not banco_str:
        return None
    
    banco_clean = clean_string(banco_str).upper()
    
    mapping = {
        'BCP': 'BCP',
        'INTERBANK': 'Interbank',
        'SCOTIABANK': 'Scotiabank',
        'BBVA': 'BBVA',
        'CONTINENTAL': 'BBVA',
    }
    
    for key, value in mapping.items():
        if key in banco_clean:
            return value
    
    return 'Otro'

def map_estado_civil(estado_str):
    """Mapea el estado civil"""
    if not estado_str:
        return None
    
    estado_clean = clean_string(estado_str).upper()
    
    mapping = {
        'SOLTERO': 'Soltero(a)',
        'SOLTERA': 'Soltero(a)',
        'CASADO': 'Casado(a)',
        'CASADA': 'Casado(a)',
        'VIUDO': 'Viudo(a)',
        'VIUDA': 'Viudo(a)',
        'DIVORCIADO': 'Divorciado(a)',
        'DIVORCIADA': 'Divorciado(a)',
        'CONVIVIENTE': 'Conviviente',
    }
    
    for key, value in mapping.items():
        if key in estado_clean:
            return value
    
    return None

def find_asesor_by_name_or_dni(nombre, dni=None):
    """Busca un asesor por nombre o DNI"""
    if dni:
        try:
            asesor = Asesor.objects.get(dni=dni)
            return asesor
        except ObjectDoesNotExist:
            pass
    
    if nombre:
        try:
            asesor = Asesor.objects.get(nombre_asesor__iexact=nombre)
            return asesor
        except ObjectDoesNotExist:
            pass
        
        # Buscar coincidencias parciales
        try:
            asesor = Asesor.objects.filter(nombre_asesor__icontains=nombre).first()
            if asesor:
                return asesor
        except:
            pass
    
    return None

def importar_asesores_desde_csv(archivo_csv):
    """Función principal para importar asesores desde CSV"""
    
    if not os.path.exists(archivo_csv):
        print(f"❌ El archivo {archivo_csv} no existe")
        return
    
    print(f"🚀 Iniciando importación de asesores desde {archivo_csv}")
    print("=" * 60)
    
    # Contadores
    total_filas = 0
    asesores_creados = 0
    asesores_actualizados = 0
    errores = 0
    
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
            
            for row_num, row in enumerate(reader, start=2):  # Empezar en 2 porque la fila 1 es header
                total_filas += 1
                
                # Obtener identificadores del asesor
                nombre = clean_string(row.get('NOMBRE', row.get('ASESOR', row.get('NOMBRE_COMPLETO', ''))))
                dni = clean_string(row.get('DNI', ''))
                
                if not nombre:
                    print(f"⚠️  Fila {row_num} sin nombre de asesor, saltando...")
                    continue
                
                print(f"\n📋 Procesando fila {row_num}: {nombre}")
                
                try:
                    with transaction.atomic():
                        # Verificar si ya existe un asesor similar
                        asesor_existente = find_asesor_by_name_or_dni(nombre, dni)
                        
                        # Preparar datos del asesor
                        fecha_ingreso = parse_date(row.get('FECHA_INGRESO', row.get('INGRESO', '')))
                        if not fecha_ingreso:
                            fecha_ingreso = timezone.now().date()
                        
                        asesor_data = {
                            'nombre_asesor': nombre,
                            'dni': dni if dni else None,
                            'fecha_nacimiento': parse_date(row.get('FECHA_NACIMIENTO', row.get('NACIMIENTO', ''))),
                            'estado_civil': map_estado_civil(row.get('ESTADO_CIVIL', '')),
                            'numero_hijos': parse_integer(row.get('NUMERO_HIJOS', row.get('HIJOS', '0'))),
                            'direccion': clean_string(row.get('DIRECCION', row.get('DIRECCION_DOMICILIO', ''))),
                            'distrito': clean_string(row.get('DISTRITO', '')),
                            'telefono_personal': clean_string(row.get('TELEFONO', row.get('CELULAR', row.get('TELEFONO_PERSONAL', '')))),
                            'email_personal': clean_string(row.get('EMAIL', row.get('EMAIL_PERSONAL', ''))),
                            'banco': map_banco(row.get('BANCO', '')),
                            'numero_cuenta_bancaria': clean_string(row.get('CUENTA_BANCARIA', row.get('NUMERO_CUENTA', ''))),
                            'cci_cuenta_bancaria': clean_string(row.get('CCI', row.get('CCI_CUENTA', ''))),
                            'fecha_ingreso': fecha_ingreso,
                            'tipo_asesor_actual': map_tipo_asesor(row.get('TIPO', row.get('TIPO_ASESOR', ''))),
                            'fecha_cambio_socio': parse_date(row.get('FECHA_CAMBIO_SOCIO', '')),
                            'observaciones_asesor': clean_string(row.get('OBSERVACIONES', row.get('OBSERVACION', ''))),
                        }
                        
                        # Remover campos vacíos para evitar errores
                        asesor_data = {k: v for k, v in asesor_data.items() if v is not None and v != ''}
                        
                        if asesor_existente:
                            print(f"⚠️  Asesor existente encontrado: {asesor_existente.id_asesor}")
                            # Actualizar campos importantes
                            for key, value in asesor_data.items():
                                if key not in ['id_asesor']:  # No cambiar el ID
                                    setattr(asesor_existente, key, value)
                            asesor_existente.save()
                            asesores_actualizados += 1
                            print(f"✅ Asesor actualizado: {asesor_existente.id_asesor}")
                        else:
                            # Crear nuevo asesor
                            asesor = Asesor.objects.create(**asesor_data)
                            asesores_creados += 1
                            print(f"✅ Asesor creado: {asesor.id_asesor}")
                        
                except Exception as e:
                    print(f"❌ Error procesando fila {row_num}: {e}")
                    errores += 1
                    continue
    
    except Exception as e:
        print(f"❌ Error leyendo archivo CSV: {e}")
        return
    
    # Resumen final
    print("\n" + "=" * 60)
    print("📊 RESUMEN DE IMPORTACIÓN DE ASESORES")
    print("=" * 60)
    print(f"Total filas procesadas: {total_filas}")
    print(f"Asesores creados: {asesores_creados}")
    print(f"Asesores actualizados: {asesores_actualizados}")
    print(f"Errores: {errores}")
    print(f"Total asesores procesados: {asesores_creados + asesores_actualizados}")
    
    if errores == 0:
        print("\n🎉 ¡Importación de asesores completada exitosamente!")
    else:
        print(f"\n⚠️  Importación de asesores completada con {errores} errores")

if __name__ == "__main__":
    # Ejecutar la importación
    archivo_csv = "asesores_import.csv"
    importar_asesores_desde_csv(archivo_csv) 