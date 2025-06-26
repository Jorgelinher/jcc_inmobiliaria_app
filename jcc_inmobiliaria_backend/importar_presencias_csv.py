#!/usr/bin/env python
"""
Script para importar presencias desde CSV a Django
Mapeo completo según la estructura de datos del usuario
Maneja presencias duplicadas que representan separaciones que se vuelven procesables
Uso: python manage.py shell < importar_presencias_csv.py
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
    Presencia, Cliente, Asesor, Lote, Venta
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
    
    # Buscar por ID_LEAD primero (conexión con CRM)
    if id_lead:
        try:
            cliente = Cliente.objects.get(id_lead=id_lead)
            print(f"✅ Cliente encontrado por ID_LEAD: {cliente.nombres_completos_razon_social} (ID: {id_lead})")
            return cliente
        except ObjectDoesNotExist:
            pass
    
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
        'id_lead': id_lead if id_lead else None,  # Guardar ID_LEAD para conexión con CRM
    }
    
    try:
        cliente = Cliente.objects.create(**cliente_data)
        print(f"✅ Cliente creado: {cliente.id_cliente} (ID_LEAD: {id_lead})")
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

def find_lote_by_reference(lote_ref, mz_ref, proyecto):
    """Busca un lote por referencia, manzana y proyecto"""
    if not lote_ref:
        return None
    
    lote_ref_clean = clean_string(lote_ref)
    mz_ref_clean = clean_string(mz_ref)
    proyecto_clean = clean_string(proyecto)
    
    # Buscar por número de lote, manzana y proyecto
    if mz_ref_clean and proyecto_clean:
        try:
            lote = Lote.objects.filter(
                numero_lote=lote_ref_clean,
                manzana=mz_ref_clean,
                ubicacion_proyecto__icontains=proyecto_clean
            ).first()
            if lote:
                return lote
        except:
            pass
    
    # Buscar solo por número de lote y proyecto
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
    
    print(f"⚠️  Lote no encontrado: {lote_ref_clean} en manzana {mz_ref_clean} del proyecto {proyecto_clean}")
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

def find_presencia_by_id_lead_and_date(cliente, id_lead, fecha_presencia, proyecto):
    """Busca presencia existente por ID_LEAD y fecha para manejar duplicados"""
    if not id_lead:
        return None
    
    # Buscar presencia existente con el mismo ID_LEAD y proyecto
    try:
        presencia_existente = Presencia.objects.filter(
            cliente=cliente,
            proyecto_interes=proyecto
        ).filter(
            # Buscar por ID_LEAD del cliente o por fecha cercana
            cliente__id_lead=id_lead
        ).first()
        
        if presencia_existente:
            print(f"🔄 Presencia existente encontrada por ID_LEAD: {presencia_existente.id_presencia}")
            return presencia_existente
    except:
        pass
    
    # Si no se encuentra por ID_LEAD, buscar por fecha y proyecto
    try:
        presencia_existente = Presencia.objects.filter(
            cliente=cliente,
            fecha_hora_presencia__date=fecha_presencia.date(),
            proyecto_interes=proyecto
        ).first()
        
        if presencia_existente:
            print(f"🔄 Presencia existente encontrada por fecha: {presencia_existente.id_presencia}")
            return presencia_existente
    except:
        pass
    
    return None

def importar_presencias_desde_csv(archivo_csv):
    """Función principal para importar presencias desde CSV"""
    
    if not os.path.exists(archivo_csv):
        print(f"❌ El archivo {archivo_csv} no existe")
        return
    
    print(f"🚀 Iniciando importación desde {archivo_csv}")
    print("📋 Manejo especial: Presencias duplicadas representan separaciones que se vuelven procesables")
    print("=" * 60)
    
    # Contadores
    total_filas = 0
    presencias_creadas = 0
    presencias_actualizadas = 0
    presencias_duplicadas_manejadas = 0
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
                print(f"\n📋 Procesando fila {row_num}: {row.get('INVITADO', 'Sin nombre')} (ID_LEAD: {row.get('ID_LEAD', 'Sin ID')})")
                
                try:
                    with transaction.atomic():
                        # 1. Buscar o crear cliente
                        cliente = find_or_create_cliente(row)
                        if not cliente:
                            print(f"❌ No se pudo procesar cliente, saltando fila {row_num}")
                            errores += 1
                            continue
                        
                        # 2. Buscar asesores según su función
                        asesor_opc = find_asesor_by_name(row.get('OPC', ''))  # Captador OPC
                        asesor_tmk = find_asesor_by_name(row.get('TMK', ''))  # Operador llamadas
                        asesor_sup_tmk = find_asesor_by_name(row.get('SUP_TLMK', ''))  # Supervisor
                        asesor_liner = find_asesor_by_name(row.get('LINER', ''))  # Presentador
                        asesor_closer = find_asesor_by_name(row.get('CLOSER', ''))  # Negociador
                        
                        # 3. Buscar lote
                        lote = find_lote_by_reference(
                            row.get('LOTE', ''),
                            row.get('MZ', ''),
                            row.get('PROYECTO', 'PROYECTO PRINCIPAL')
                        )
                        
                        # 4. Preparar datos de presencia
                        fecha_presencia = parse_datetime(
                            row.get('FECHA.1', ''),  # FECHA.1 es la fecha de presencia
                            None
                        )
                        
                        proyecto = clean_string(row.get('PROYECTO', 'PROYECTO PRINCIPAL'))
                        id_lead = clean_string(row.get('ID_LEAD', ''))
                        
                        presencia_data = {
                            'cliente': cliente,
                            'fecha_hora_presencia': fecha_presencia,
                            'proyecto_interes': proyecto,
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
                        
                        # 5. Buscar presencia existente usando ID_LEAD (para manejar duplicados)
                        presencia_existente = find_presencia_by_id_lead_and_date(
                            cliente, id_lead, fecha_presencia, proyecto
                        )
                        
                        if presencia_existente:
                            print(f"🔄 Actualizando presencia existente: {presencia_existente.id_presencia}")
                            print(f"   Status anterior: {presencia_existente.status_presencia}")
                            print(f"   Status nuevo: {presencia_data['status_presencia']}")
                            
                            # Actualizar campos importantes, especialmente el status
                            for key, value in presencia_data.items():
                                if key != 'cliente':  # No cambiar el cliente
                                    setattr(presencia_existente, key, value)
                            
                            # Actualizar ID_LEAD si no estaba presente
                            if id_lead and not presencia_existente.cliente.id_lead:
                                presencia_existente.cliente.id_lead = id_lead
                                presencia_existente.cliente.save()
                            
                            presencia_existente.save()
                            presencias_actualizadas += 1
                            presencias_duplicadas_manejadas += 1
                            print(f"✅ Presencia actualizada: {presencia_existente.id_presencia}")
                        else:
                            # Crear nueva presencia
                            presencia = Presencia.objects.create(**presencia_data)
                            presencias_creadas += 1
                            print(f"✅ Presencia creada: {presencia.id_presencia}")
                        
                except Exception as e:
                    print(f"❌ Error procesando fila {row_num}: {e}")
                    errores += 1
                    continue
    
    except Exception as e:
        print(f"❌ Error leyendo archivo CSV: {e}")
        return
    
    # Resumen final
    print("\n" + "=" * 60)
    print("📊 RESUMEN DE IMPORTACIÓN")
    print("=" * 60)
    print(f"Total filas procesadas: {total_filas}")
    print(f"Presencias creadas: {presencias_creadas}")
    print(f"Presencias actualizadas: {presencias_actualizadas}")
    print(f"Presencias duplicadas manejadas: {presencias_duplicadas_manejadas}")
    print(f"Errores: {errores}")
    print(f"Total presencias procesadas: {presencias_creadas + presencias_actualizadas}")
    
    if errores == 0:
        print("\n🎉 ¡Importación completada exitosamente!")
        print("💡 Las presencias duplicadas han sido manejadas correctamente")
        print("   - Separaciones que se vuelven procesables se actualizan automáticamente")
        print("   - ID_LEAD se usa para conectar con el CRM externo")
    else:
        print(f"\n⚠️  Importación completada con {errores} errores")

if __name__ == "__main__":
    # Ejecutar la importación
    archivo_csv = "presencias_import.csv"
    importar_presencias_desde_csv(archivo_csv) 