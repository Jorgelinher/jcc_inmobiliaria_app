#!/usr/bin/env python
"""
Script para importar lotes desde el formato de CSV proporcionado a Django
Mapeo:
- PROYECTO → ubicacion_proyecto
- ETAPA → etapa
- MANZANA → manzana
- LOTE → numero_lote
- AREA_m2 → area_m2
- PRECIO_CONTADO_SOLES → precio_lista_soles
- PRECIO_CONTADO_DOLARES → precio_lista_dolares
- 12_MESES_SOLES → precio_credito_12_meses_soles
- 24_MESES_SOLES → precio_credito_24_meses_soles
- 12_MESES_DOLARES → precio_credito_12_meses_dolares
- 24_MESES_DOLARES → precio_credito_24_meses_dolares

Reglas:
- Para OASIS 2 (AUCALLAMA): solo se usan los valores en dólares, los de soles se ponen en 0.
- Para OASIS 1 (HUACHO 1) y OASIS 3 (HUACHO 2): solo se usan los valores en soles, los de dólares se ponen en 0.
- PRECIO_CONTADO_DSCTO se ignora completamente.

Uso: python manage.py shell < importar_lotes_csv.py
"""

import csv
import os
from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist

from gestion_inmobiliaria.models import Lote

def clean_string(value):
    if value is None:
        return ''
    return str(value).strip()

def parse_decimal(value):
    if not value or value.strip() == '':
        return Decimal('0.00')
    try:
        # Quitar S/, puntos de miles y cambiar coma decimal a punto
        clean_value = (
            str(value)
            .replace('S/', '')
            .replace('s/', '')
            .replace('.', '')
            .replace(',', '.')
            .replace(' ', '')
        )
        return Decimal(clean_value)
    except Exception:
        return Decimal('0.00')

def importar_lotes_desde_csv(archivo_csv):
    if not os.path.exists(archivo_csv):
        print(f"❌ El archivo {archivo_csv} no existe")
        return
    print(f"🚀 Iniciando importación de lotes desde {archivo_csv}")
    print("=" * 60)
    total = 0
    creados = 0
    actualizados = 0
    errores = 0
    try:
        with open(archivo_csv, 'r', encoding='utf-8') as file:
            sample = file.read(1024)
            file.seek(0)
            delimiter = ';' if ';' in sample else ','
            reader = csv.DictReader(file, delimiter=delimiter)
            for row_num, row in enumerate(reader, start=2):
                total += 1
                try:
                    with transaction.atomic():
                        proyecto = clean_string(row.get('PROYECTO', ''))
                        etapa = clean_string(row.get('ETAPA', ''))
                        manzana = clean_string(row.get('MANZANA', ''))
                        numero_lote = clean_string(row.get('LOTE', ''))
                        area_m2 = parse_decimal(row.get('AREA_m2', ''))
                        precio_lista_soles = parse_decimal(row.get('PRECIO_CONTADO_SOLES', ''))
                        precio_lista_dolares = parse_decimal(row.get('PRECIO_CONTADO_DOLARES', ''))
                        precio_credito_12_meses_soles = parse_decimal(row.get('12_MESES_SOLES', ''))
                        precio_credito_24_meses_soles = parse_decimal(row.get('24_MESES_SOLES', ''))
                        precio_credito_12_meses_dolares = parse_decimal(row.get('12_MESES_DOLARES', ''))
                        precio_credito_24_meses_dolares = parse_decimal(row.get('24_MESES_DOLARES', ''))

                        # Lógica de proyecto para soles/dólares
                        proyecto_lower = proyecto.lower()
                        if 'aucallama' in proyecto_lower or 'oasis 2' in proyecto_lower:
                            # Solo dólares
                            precio_lista_soles = Decimal('0.00')
                            precio_credito_12_meses_soles = Decimal('0.00')
                            precio_credito_24_meses_soles = Decimal('0.00')
                        else:
                            # Solo soles
                            precio_lista_dolares = Decimal('0.00')
                            precio_credito_12_meses_dolares = Decimal('0.00')
                            precio_credito_24_meses_dolares = Decimal('0.00')

                        # Buscar lote existente por proyecto, manzana, número de lote y etapa
                        lote = Lote.objects.filter(
                            ubicacion_proyecto__iexact=proyecto,
                            manzana=manzana,
                            numero_lote=numero_lote,
                            etapa=etapa
                        ).first()
                        lote_data = {
                            'ubicacion_proyecto': proyecto,
                            'manzana': manzana,
                            'numero_lote': numero_lote,
                            'etapa': etapa,
                            'area_m2': area_m2,
                            'precio_lista_soles': precio_lista_soles,
                            'precio_lista_dolares': precio_lista_dolares,
                            'precio_credito_12_meses_soles': precio_credito_12_meses_soles,
                            'precio_credito_24_meses_soles': precio_credito_24_meses_soles,
                            'precio_credito_12_meses_dolares': precio_credito_12_meses_dolares,
                            'precio_credito_24_meses_dolares': precio_credito_24_meses_dolares,
                            'estado_lote': 'Disponible',
                        }
                        if lote:
                            for key, value in lote_data.items():
                                setattr(lote, key, value)
                            lote.save()
                            actualizados += 1
                            print(f"🔄 Lote actualizado: {proyecto} MZ {manzana} LT {numero_lote} ETAPA {etapa}")
                        else:
                            Lote.objects.create(**lote_data)
                            creados += 1
                            print(f"✅ Lote creado: {proyecto} MZ {manzana} LT {numero_lote} ETAPA {etapa}")
                except Exception as e:
                    print(f"❌ Error en fila {row_num}: {e}")
                    errores += 1
                    continue
    except Exception as e:
        print(f"❌ Error leyendo archivo CSV: {e}")
        return
    print("\n" + "=" * 60)
    print(f"Total filas procesadas: {total}")
    print(f"Lotes creados: {creados}")
    print(f"Lotes actualizados: {actualizados}")
    print(f"Errores: {errores}")
    print(f"Total lotes procesados: {creados + actualizados}")
    if errores == 0:
        print("\n🎉 ¡Importación de lotes completada exitosamente!")
    else:
        print(f"\n⚠️  Importación completada con {errores} errores")

if __name__ == "__main__":
    archivo_csv = "lotes_import.csv"
    importar_lotes_desde_csv(archivo_csv) 