#!/usr/bin/env python
"""
Script combinado para importar lotes y presencias desde CSV a Django
Mapeo completo según la estructura de datos del usuario
Uso: python manage.py shell < importar_lotes_y_presencias.py
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
    Lote, Presencia, Cliente, Asesor, Venta, RegistroPago
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

def parse_datetime(date_str, time_str=None):
    """Convierte string de fecha y hora a objeto datetime"""
    if not date_str or date_str.strip() == '':
        return timezone.now()
    
    date_obj = parse_date(date_str)
    if not date_obj:
        return timezone.now()
    
    # Si no hay hora específica, usar 12:00 PM
    if not time_str:
        return timezone.make_aware(
            datetime.combine(date_obj, datetime.min.time().replace(hour=12))
        )
    
    return timezone.make_aware(
        datetime.combine(date_obj, datetime.min.time().replace(hour=12))
    )

def clean_string(value):
    """Limpia y valida strings"""
    if value is None:
        return ''
    return str(value).strip()

def parse_decimal(value):
    """Convierte string a Decimal - maneja formato con comas"""
    if not value or value.strip() == '':
        return Decimal('0.00')
    
    try:
        # Remover caracteres no numéricos excepto punto y coma
        clean_value = str(value).replace(',', '').replace('S/', '').replace('$', '').strip()
        return Decimal(clean_value)
    except:
        return Decimal('0.00')

def parse_area(area_str):
    """Convierte string de área a Decimal - maneja formato con comas como decimales"""
    if not area_str or area_str.strip() == '':
        return Decimal('0.00')
    
    try:
        # Manejar comas como separadores decimales
        clean_value = str(area_str).replace(' ', '').strip()
        if ',' in clean_value and '.' not in clean_value:
            # Si hay coma pero no punto, la coma es separador decimal
            clean_value = clean_value.replace(',', '.')
        else:
            # Si hay punto, remover comas
            clean_value = clean_value.replace(',', '')
        
        return Decimal(clean_value)
    except:
        return Decimal('0.00')

def find_or_create_cliente(row):
    """Busca o crea un cliente basado en los datos del CSV"""
    dni = clean_string(row.get('DNI', ''))
    invitado = clean_string(row.get('INVITADO', ''))
    celular = clean_string(row.get('CELULAR', ''))
    id_lead = clean_string(row.get('ID_LEAD', ''))
    distrito = clean_string(row.get('DISTRITO', ''))
    
    if not invitado:
        print(f"⚠️  Fila sin nombre de invitado, saltando...")
        return None
    
    # Buscar por DNI si existe
    if dni:
        try:
            cliente = Cliente.objects.get(numero_documento=dni)
            print(f"✅ Cliente encontrado por DNI: {cliente.nombres_completos_razon_social}")
            return cliente
        except ObjectDoesNotExist:
            pass
    
    # Buscar por nombre
    try:
        cliente = Cliente.objects.get(nombres_completos_razon_social__iexact=invitado)
        print(f"✅ Cliente encontrado por nombre: {cliente.nombres_completos_razon_social}")
        return cliente
    except ObjectDoesNotExist:
        pass
    
    # Buscar por teléfono
    if celular:
        try:
            cliente = Cliente.objects.get(telefono_principal=celular)
            print(f"✅ Cliente encontrado por teléfono: {cliente.nombres_completos_razon_social}")
            return cliente
        except ObjectDoesNotExist:
            pass
    
    # Crear nuevo cliente
    print(f"🆕 Creando nuevo cliente: {invitado}")
    
    # Determinar tipo de documento
    tipo_documento = 'DNI' if dni and len(dni) == 8 else 'Otro'
    
    cliente_data = {
        'tipo_documento': tipo_documento,
        'numero_documento': dni if dni else f"TEMP_{int(timezone.now().timestamp())}",
        'nombres_completos_razon_social': invitado,
        'telefono_principal': celular if celular else None,
        'distrito': distrito,
    }
    
    try:
        cliente = Cliente.objects.create(**cliente_data)
        print(f"✅ Cliente creado: {cliente.id_cliente}")
        return cliente
    except Exception as e:
        print(f"❌ Error creando cliente {invitado}: {e}")
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
            print(f"⚠️  Asesor encontrado por coincidencia parcial: {asesor.nombre_asesor}")
            return asesor
    except:
        pass
    
    print(f"⚠️  Asesor no encontrado: {nombre_clean}")
    return None

def find_or_create_lote(row):
    """Busca o crea un lote basado en los datos del CSV"""
    numero_lote = clean_string(row.get('LOTE', ''))
    manzana = clean_string(row.get('MZ', ''))
    proyecto = clean_string(row.get('PROYECTO', 'PROYECTO PRINCIPAL'))
    costo_lote = parse_decimal(row.get('COSTO LOTE', '0'))
    
    if not numero_lote:
        print(f"⚠️  Fila sin número de lote, saltando...")
        return None
    
    # Buscar lote existente
    try:
        lote = Lote.objects.get(
            numero_lote=numero_lote,
            manzana=manzana,
            ubicacion_proyecto__icontains=proyecto
        )
        print(f"✅ Lote encontrado: {lote.numero_lote} - {lote.ubicacion_proyecto}")
        return lote
    except ObjectDoesNotExist:
        pass
    
    # Crear nuevo lote
    print(f"🆕 Creando nuevo lote: {numero_lote} en manzana {manzana}")
    
    lote_data = {
        'numero_lote': numero_lote,
        'manzana': manzana,
        'ubicacion_proyecto': proyecto,
        'precio_venta_soles': costo_lote,
        'precio_venta_dolares': costo_lote / Decimal('3.7'),  # Aproximación
        'estado_lote': 'disponible',
    }
    
    try:
        lote = Lote.objects.create(**lote_data)
        print(f"✅ Lote creado: {lote.id_lote}")
        return lote
    except Exception as e:
        print(f"❌ Error creando lote {numero_lote}: {e}")
        return None

def map_medio_captacion(fuente):
    """Mapea la fuente del CSV al medio de captación del modelo"""
    fuente_clean = clean_string(fuente).upper()
    
    mapping = {
        'REDES': 'redes_facebook',
        'FACEBOOK': 'redes_facebook',
        'INSTAGRAM': 'redes_instagram',
        'TIKTOK': 'redes_tiktok',
        'CAMPO': 'campo_opc',
        'OPC': 'campo_opc',
        'REFERIDO': 'referido',
        'WEB': 'web',
        'PAGINA WEB': 'web',
    }
    
    for key, value in mapping.items():
        if key in fuente_clean:
            return value
    
    return 'otro'

def map_status_presencia(status):
    """Mapea el status del CSV al status de presencia"""
    status_clean = clean_string(status).upper()
    
    mapping = {
        'SEPARACION': 'realizada',
        'PROCESABLE': 'realizada',
        'COMPLETADA': 'realizada',
        'AGENDADA': 'agendada',
        'REPROGRAMADA': 'reprogramada',
        'CANCELADA': 'cancelada_cliente',
        'NO ASISTIO': 'no_asistio',
        'CAIDA': 'caida_proceso',
    }
    
    for key, value in mapping.items():
        if key in status_clean:
            return value
    
    return 'realizada'  # Por defecto

def map_tipo_tour(tour_value):
    """Mapea el valor TOUR a tipo_tour"""
    tour_clean = clean_string(tour_value).upper()
    
    if tour_clean == 'TOUR':
        return 'tour'
    elif tour_clean == 'NO TOUR':
        return 'no_tour'
    else:
        return 'tour'  # Por defecto

def map_modalidad_presentacion(visita):
    """Mapea el destino de visita a modalidad de presentación"""
    visita_clean = clean_string(visita).upper()
    
    if 'SALA' in visita_clean:
        return 'presencial'
    elif 'PROYECTO' in visita_clean:
        return 'presencial'
    else:
        return 'presencial'  # Por defecto

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

def map_metodo_pago(medio_pago):
    """Mapea el medio de pago"""
    medio_clean = clean_string(medio_pago).upper()
    
    mapping = {
        'TRANSFERENCIA': 'transferencia',
        'YAPE': 'yape_plin',
        'PLIN': 'yape_plin',
        'POS': 'tarjeta_credito',
        'EFECTIVO': 'efectivo',
        'TARJETA': 'tarjeta_credito',
    }
    
    for key, value in mapping.items():
        if key in medio_clean:
            return value
    
    return 'otro'

def importar_datos_completos(archivo_csv):
    """Función principal para importar lotes y presencias desde CSV"""
    
    if not os.path.exists(archivo_csv):
        print(f"❌ El archivo {archivo_csv} no existe")
        return
    
    print(f"🚀 Iniciando importación completa desde {archivo_csv}")
    print("=" * 60)
    
    # Contadores
    total_filas = 0
    lotes_creados = 0
    presencias_creadas = 0
    presencias_actualizadas = 0
    ventas_creadas = 0
    ventas_actualizadas = 0
    pagos_creados = 0
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
                
                try:
                    with transaction.atomic():
                        # 1. Buscar o crear cliente
                        cliente = find_or_create_cliente(row)
                        if not cliente:
                            print(f"❌ No se pudo procesar cliente, saltando fila {row_num}")
                            errores += 1
                            continue
                        
                        # 2. Buscar o crear lote
                        lote = find_or_create_lote(row)
                        if not lote:
                            print(f"❌ No se pudo procesar lote, saltando fila {row_num}")
                            errores += 1
                            continue
                        
                        if lote.numero_lote == row.get('LOTE', ''):
                            lotes_creados += 1
                        
                        # 3. Buscar asesores según su función
                        asesor_opc = find_asesor_by_name(row.get('OPC', ''))  # Captador OPC
                        asesor_tmk = find_asesor_by_name(row.get('TMK', ''))  # Operador llamadas
                        asesor_sup_tmk = find_asesor_by_name(row.get('SUP_TLMK', ''))  # Supervisor
                        asesor_liner = find_asesor_by_name(row.get('LINER', ''))  # Presentador
                        asesor_closer = find_asesor_by_name(row.get('CLOSER', ''))  # Negociador
                        
                        # 4. Crear presencia
                        fecha_presencia = parse_datetime(
                            row.get('FECHA.1', ''),  # FECHA.1 es la fecha de presencia
                            None
                        )
                        
                        presencia_data = {
                            'cliente': cliente,
                            'fecha_hora_presencia': fecha_presencia,
                            'proyecto_interes': clean_string(row.get('PROYECTO', 'PROYECTO PRINCIPAL')),
                            'lote_interes_inicial': lote,
                            'asesor_captacion_opc': asesor_opc,  # OPC captador
                            'medio_captacion': map_medio_captacion(row.get('FUENTE', '')),
                            'asesor_call_agenda': asesor_tmk,  # TMK operador llamadas
                            'asesor_liner': asesor_liner,  # LINER presentador
                            'asesor_closer': asesor_closer,  # CLOSER negociador
                            'modalidad': map_modalidad_presentacion(row.get('VISITA', '')),
                            'status_presencia': map_status_presencia(row.get('STATUS', '')),
                            'tipo_tour': map_tipo_tour(row.get('TOUR', '')),
                            'observaciones': clean_string(row.get('OBSERVACION', '')),
                        }
                        
                        # Verificar si ya existe una presencia similar
                        presencia_existente = Presencia.objects.filter(
                            cliente=cliente,
                            fecha_hora_presencia__date=fecha_presencia.date(),
                            proyecto_interes=presencia_data['proyecto_interes']
                        ).first()
                        
                        if presencia_existente:
                            print(f"⚠️  Presencia existente encontrada: {presencia_existente.id_presencia}")
                            # Actualizar campos importantes
                            for key, value in presencia_data.items():
                                if key != 'cliente':  # No cambiar el cliente
                                    setattr(presencia_existente, key, value)
                            presencia_existente.save()
                            presencias_actualizadas += 1
                            print(f"✅ Presencia actualizada: {presencia_existente.id_presencia}")
                        else:
                            # Crear nueva presencia
                            presencia = Presencia.objects.create(**presencia_data)
                            presencias_creadas += 1
                            print(f"✅ Presencia creada: {presencia.id_presencia}")
                        
                        # 5. Crear venta si hay información de venta
                        status = clean_string(row.get('STATUS', ''))
                        if status.upper() in ['SEPARACION', 'PROCESABLE', 'COMPLETADA']:
                            # Buscar vendedor principal
                            vendedor_principal = asesor_closer
                            if not vendedor_principal:
                                vendedor_principal = asesor_liner
                            
                            if not vendedor_principal:
                                print(f"⚠️  No hay vendedor principal para crear venta")
                            else:
                                # Preparar datos de venta
                                fecha_venta = parse_date(row.get('FECHA', ''))  # FECHA es mes de venta
                                if not fecha_venta:
                                    fecha_venta = timezone.now().date()
                                
                                valor_venta = parse_decimal(row.get('COSTO LOTE', '0'))
                                if valor_venta == Decimal('0.00'):
                                    valor_venta = parse_decimal(row.get('CUOTA', '0'))
                                
                                tipo_venta = map_tipo_venta(row.get('CONTADO/CREDITO', ''))
                                
                                venta_data = {
                                    'fecha_venta': fecha_venta,
                                    'lote': lote,
                                    'cliente': cliente,
                                    'valor_lote_venta': valor_venta,
                                    'tipo_venta': tipo_venta,
                                    'plazo_meses_credito': 0,  # Por defecto
                                    'vendedor_principal': vendedor_principal,
                                    'participacion_junior_venta': 'N/A',
                                    'id_socio_participante': asesor_liner if asesor_liner != vendedor_principal else None,
                                    'participacion_socio_venta': 'N/A',
                                    'status_venta': map_status_venta(status),
                                    'monto_pagado_actual': parse_decimal(row.get('RECAUDO', '0')),
                                    'cuota_inicial_requerida': parse_decimal(row.get('CUOTA', '0')),
                                    'cliente_firmo_contrato': status.upper() in ['PROCESABLE', 'COMPLETADA'],
                                    'notas': clean_string(row.get('OBSERVACION', '')),
                                }
                                
                                # Verificar si ya existe una venta similar
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
                                    venta = venta_existente
                                else:
                                    # Crear nueva venta
                                    venta = Venta.objects.create(**venta_data)
                                    ventas_creadas += 1
                                    print(f"✅ Venta creada: {venta.id_venta}")
                                
                                # 6. Crear registro de pago si hay recaudo
                                recaudo = parse_decimal(row.get('RECAUDO', '0'))
                                if recaudo > Decimal('0.00'):
                                    medio_pago = map_metodo_pago(row.get('MEDIO PAGO', ''))
                                    
                                    pago_data = {
                                        'venta': venta,
                                        'fecha_pago': fecha_venta,
                                        'monto_pago': recaudo,
                                        'metodo_pago': medio_pago,
                                        'referencia_pago': f"Pago inicial - {row.get('MEDIO PAGO', 'No especificado')}",
                                        'notas_pago': f"Pago inicial de venta {venta.id_venta}",
                                    }
                                    
                                    try:
                                        pago = RegistroPago.objects.create(**pago_data)
                                        pagos_creados += 1
                                        print(f"✅ Pago registrado: {pago.id_pago}")
                                    except Exception as e:
                                        print(f"⚠️  Error creando pago: {e}")
                        
                except Exception as e:
                    print(f"❌ Error procesando fila {row_num}: {e}")
                    errores += 1
                    continue
    
    except Exception as e:
        print(f"❌ Error leyendo archivo CSV: {e}")
        return
    
    # Resumen final
    print("\n" + "=" * 60)
    print("📊 RESUMEN DE IMPORTACIÓN COMPLETA")
    print("=" * 60)
    print(f"Total filas procesadas: {total_filas}")
    print(f"Lotes creados: {lotes_creados}")
    print(f"Presencias creadas: {presencias_creadas}")
    print(f"Presencias actualizadas: {presencias_actualizadas}")
    print(f"Ventas creadas: {ventas_creadas}")
    print(f"Ventas actualizadas: {ventas_actualizadas}")
    print(f"Pagos registrados: {pagos_creados}")
    print(f"Errores: {errores}")
    print(f"Total presencias procesadas: {presencias_creadas + presencias_actualizadas}")
    print(f"Total ventas procesadas: {ventas_creadas + ventas_actualizadas}")
    
    if errores == 0:
        print("\n🎉 ¡Importación completa exitosamente!")
    else:
        print(f"\n⚠️  Importación completada con {errores} errores")

if __name__ == "__main__":
    # Ejecutar la importación
    archivo_csv = "presencias_import.csv"
    importar_datos_completos(archivo_csv) 