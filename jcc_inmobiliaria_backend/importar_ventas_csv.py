#!/usr/bin/env python
"""
Script para importar ventas desde CSV a Django
Uso: python manage.py shell < importar_ventas_csv.py
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
from gestion_inmobiliaria.models import (
    Venta, Cliente, Asesor, Lote, Presencia
)

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

def parse_decimal(value):
    """Convierte string a Decimal"""
    if not value or value.strip() == '':
        return Decimal('0.00')
    
    try:
        # Remover caracteres no numéricos excepto punto y coma
        clean_value = str(value).replace(',', '').replace('S/', '').replace('$', '').strip()
        return Decimal(clean_value)
    except:
        return Decimal('0.00')

def find_cliente_by_name_or_dni(nombre, dni=None):
    """Busca un cliente por nombre o DNI"""
    if dni:
        try:
            cliente = Cliente.objects.get(numero_documento=dni)
            return cliente
        except ObjectDoesNotExist:
            pass
    
    if nombre:
        try:
            cliente = Cliente.objects.get(nombres_completos_razon_social__iexact=nombre)
            return cliente
        except ObjectDoesNotExist:
            pass
        
        # Buscar coincidencias parciales
        try:
            cliente = Cliente.objects.filter(nombre_asesor__icontains=nombre).first()
            if cliente:
                return cliente
        except:
            pass
    
    return None

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

def find_lote_by_reference(lote_ref, proyecto):
    """Busca un lote por referencia y proyecto"""
    if not lote_ref:
        return None
    
    lote_ref_clean = clean_string(lote_ref)
    proyecto_clean = clean_string(proyecto)
    
    # Buscar por ID de lote
    try:
        lote = Lote.objects.get(id_lote=lote_ref_clean)
        return lote
    except ObjectDoesNotExist:
        pass
    
    # Buscar por número de lote y proyecto
    if proyecto_clean:
        try:
            lote = Lote.objects.filter(
                numero_lote=lote_ref_clean,
                ubicacion_proyecto__icontains=proyecto_clean
            ).first()
            if lote:
                return lote
        except:
            pass
    
    # Buscar solo por número de lote
    try:
        lote = Lote.objects.filter(numero_lote=lote_ref_clean).first()
        if lote:
            return lote
    except:
        pass
    
    return None

def map_status_venta(status):
    """Mapea el status del CSV al status de venta"""
    status_clean = clean_string(status).upper()
    
    mapping = {
        'SEPARACION': 'separacion',
        'PROCESABLE': 'procesable',
        'COMPLETADA': 'completada',
        'ANULADO': 'anulado',
        'CANCELADA': 'anulado',
    }
    
    for key, value in mapping.items():
        if key in status_clean:
            return value
    
    return 'separacion'  # Por defecto

def map_tipo_venta(tipo_credito):
    """Mapea el tipo de crédito al tipo de venta"""
    tipo_clean = clean_string(tipo_credito).upper()
    
    if 'CREDITO' in tipo_clean or 'CRÉDITO' in tipo_clean:
        return 'credito'
    else:
        return 'contado'

def map_plazo_credito(cuota_str):
    """Determina el plazo de crédito basado en la información de cuotas"""
    if not cuota_str:
        return 0
    
    cuota_clean = clean_string(cuota_str).upper()
    
    # Buscar patrones de meses
    if '12' in cuota_clean or 'DOCE' in cuota_clean:
        return 12
    elif '24' in cuota_clean or 'VEINTICUATRO' in cuota_clean:
        return 24
    elif '36' in cuota_clean or 'TREINTA Y SEIS' in cuota_clean:
        return 36
    else:
        return 0

def map_participacion_junior(participacion_str):
    """Mapea la participación del junior"""
    participacion_clean = clean_string(participacion_str).upper()
    
    if 'OPC' in participacion_clean and 'CALL' in participacion_clean and 'LINEA' in participacion_clean:
        return 'opc, call y línea'
    elif 'OPC' in participacion_clean and 'CALL' in participacion_clean and 'FRONT' in participacion_clean:
        return 'opc, call, front'
    elif 'OPC' in participacion_clean and 'CALL' in participacion_clean:
        return 'opc y call'
    else:
        return 'N/A'

def map_participacion_socio(participacion_str):
    """Mapea la participación del socio"""
    participacion_clean = clean_string(participacion_str).upper()
    
    if 'FRONT' in participacion_clean:
        return 'front'
    elif 'CIERRE' in participacion_clean:
        return 'cierre'
    elif 'NO PARTICIPA' in participacion_clean:
        return 'no participa'
    else:
        return 'N/A'

def importar_ventas_desde_csv(archivo_csv):
    """Función principal para importar ventas desde CSV"""
    
    if not os.path.exists(archivo_csv):
        print(f"❌ El archivo {archivo_csv} no existe")
        return
    
    print(f"🚀 Iniciando importación de ventas desde {archivo_csv}")
    print("=" * 60)
    
    # Contadores
    total_filas = 0
    ventas_creadas = 0
    ventas_actualizadas = 0
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
                print(f"\n📋 Procesando fila {row_num}: {row.get('INVITADO', 'Sin nombre')}")
                
                # Solo procesar filas que tengan información de venta
                status = clean_string(row.get('STATUS', ''))
                if not status or status.upper() not in ['SEPARACION', 'PROCESABLE', 'COMPLETADA']:
                    print(f"⚠️  Fila sin status de venta válido, saltando...")
                    continue
                
                try:
                    with transaction.atomic():
                        # 1. Buscar cliente
                        cliente = find_cliente_by_name_or_dni(
                            row.get('INVITADO', ''),
                            row.get('DNI', '')
                        )
                        if not cliente:
                            print(f"❌ Cliente no encontrado: {row.get('INVITADO', '')}")
                            errores += 1
                            continue
                        
                        # 2. Buscar lote
                        lote = find_lote_by_reference(
                            row.get('LOTE', ''),
                            row.get('PROYECTO', '')
                        )
                        if not lote:
                            print(f"❌ Lote no encontrado: {row.get('LOTE', '')}")
                            errores += 1
                            continue
                        
                        # 3. Buscar asesores
                        vendedor_principal = find_asesor_by_name(row.get('CLOSER', ''))
                        if not vendedor_principal:
                            vendedor_principal = find_asesor_by_name(row.get('LINER', ''))
                        
                        if not vendedor_principal:
                            print(f"❌ Vendedor principal no encontrado")
                            errores += 1
                            continue
                        
                        socio_participante = find_asesor_by_name(row.get('LINER', ''))
                        if socio_participante == vendedor_principal:
                            socio_participante = None
                        
                        # 4. Preparar datos de venta
                        fecha_venta = parse_date(row.get('FECHA.1', row.get('FECHA', '')))
                        if not fecha_venta:
                            fecha_venta = timezone.now().date()
                        
                        valor_venta = parse_decimal(row.get('COSTO LOTE', '0'))
                        if valor_venta == Decimal('0.00'):
                            valor_venta = parse_decimal(row.get('CUOTA', '0'))
                        
                        tipo_venta = map_tipo_venta(row.get('CONTADO/CREDITO', ''))
                        plazo_credito = map_plazo_credito(row.get('CUOTA', ''))
                        
                        venta_data = {
                            'fecha_venta': fecha_venta,
                            'lote': lote,
                            'cliente': cliente,
                            'valor_lote_venta': valor_venta,
                            'tipo_venta': tipo_venta,
                            'plazo_meses_credito': plazo_credito,
                            'vendedor_principal': vendedor_principal,
                            'participacion_junior_venta': map_participacion_junior(row.get('OPC', '')),
                            'id_socio_participante': socio_participante,
                            'participacion_socio_venta': map_participacion_socio(row.get('LINER', '')),
                            'status_venta': map_status_venta(status),
                            'monto_pagado_actual': parse_decimal(row.get('RECUADO', '0')),
                            'cuota_inicial_requerida': parse_decimal(row.get('CUOTA', '0')),
                            'cliente_firmo_contrato': status.upper() in ['PROCESABLE', 'COMPLETADA'],
                            'notas': clean_string(row.get('OBSERVACION', '')),
                        }
                        
                        # 5. Verificar si ya existe una venta similar
                        venta_existente = Venta.objects.filter(
                            cliente=cliente,
                            lote=lote,
                            fecha_venta=fecha_venta
                        ).first()
                        
                        if venta_existente:
                            print(f"⚠️  Venta existente encontrada: {venta_existente.id_venta}")
                            # Actualizar campos importantes
                            for key, value in venta_data.items():
                                if key not in ['cliente', 'lote']:  # No cambiar cliente ni lote
                                    setattr(venta_existente, key, value)
                            venta_existente.save()
                            ventas_actualizadas += 1
                            print(f"✅ Venta actualizada: {venta_existente.id_venta}")
                        else:
                            # Crear nueva venta
                            venta = Venta.objects.create(**venta_data)
                            ventas_creadas += 1
                            print(f"✅ Venta creada: {venta.id_venta}")
                        
                except Exception as e:
                    print(f"❌ Error procesando fila {row_num}: {e}")
                    errores += 1
                    continue
    
    except Exception as e:
        print(f"❌ Error leyendo archivo CSV: {e}")
        return
    
    # Resumen final
    print("\n" + "=" * 60)
    print("📊 RESUMEN DE IMPORTACIÓN DE VENTAS")
    print("=" * 60)
    print(f"Total filas procesadas: {total_filas}")
    print(f"Ventas creadas: {ventas_creadas}")
    print(f"Ventas actualizadas: {ventas_actualizadas}")
    print(f"Errores: {errores}")
    print(f"Total ventas procesadas: {ventas_creadas + ventas_actualizadas}")
    
    if errores == 0:
        print("\n🎉 ¡Importación de ventas completada exitosamente!")
    else:
        print(f"\n⚠️  Importación de ventas completada con {errores} errores")

if __name__ == "__main__":
    # Ejecutar la importación
    archivo_csv = "presencias_import.csv"
    importar_ventas_desde_csv(archivo_csv) 