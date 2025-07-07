import csv
from decimal import Decimal
from gestion_inmobiliaria.models import Lote

print("=== SCRIPT importar_lotes_temp.py INICIADO ===")
import csv
print("Import csv OK")
from decimal import Decimal
print("Import decimal OK")
from gestion_inmobiliaria.models import Lote
print("Import modelo Lote OK")

def parse_decimal(value):
    if not value or value.strip() == '':
        return Decimal('0.00')
    try:
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

def importar_lotes():
    print("=== INICIANDO IMPORTACIÓN DE LOTES ===")
    try:
        print("Intentando abrir lotes_import.csv...")
        with open('lotes_import.csv', encoding='utf-8') as f:
            print("Archivo lotes_import.csv abierto OK")
            r = csv.DictReader(f, delimiter=';')
            creados = 0
            actualizados = 0
            for row in r:
                try:
                    proyecto = row['\ufeffPROYECTO'].strip()
                    etapa = int(row['ETAPA'].strip()) if row['ETAPA'].strip().isdigit() else None
                    manzana = row['MANZANA'].strip()
                    numero_lote = row['LOTE'].strip()
                    area_m2 = parse_decimal(row['AREA_m2'])
                    precio_lista_soles = parse_decimal(row['PRECIO_CONTADO_SOLES'])
                    precio_lista_dolares = parse_decimal(row['PRECIO_CONTADO_DOLARES'])
                    precio_credito_12_meses_soles = parse_decimal(row['12_MESES_SOLES'])
                    precio_credito_24_meses_soles = parse_decimal(row['24_MESES_SOLES'])
                    precio_credito_12_meses_dolares = parse_decimal(row['12_MESES_DOLARES'])
                    precio_credito_24_meses_dolares = parse_decimal(row['24_MESES_DOLARES'])

                    proyecto_lower = proyecto.lower()
                    if 'aucallama' in proyecto_lower or 'oasis 2' in proyecto_lower:
                        precio_lista_soles = Decimal('0.00')
                        precio_credito_12_meses_soles = Decimal('0.00')
                        precio_credito_24_meses_soles = Decimal('0.00')
                    else:
                        precio_lista_dolares = Decimal('0.00')
                        precio_credito_12_meses_dolares = Decimal('0.00')
                        precio_credito_24_meses_dolares = Decimal('0.00')

                    # Buscar si ya existe el lote (comparación más robusta)
                    lote_existente = Lote.objects.filter(
                        ubicacion_proyecto__iexact=proyecto.strip(),
                        manzana__iexact=manzana.strip() if manzana else '',
                        numero_lote__iexact=numero_lote.strip() if numero_lote else '',
                        etapa=etapa
                    ).first()
                    
                    if lote_existente:
                        # Actualizar datos
                        lote_existente.area_m2 = area_m2
                        lote_existente.precio_lista_soles = precio_lista_soles
                        lote_existente.precio_lista_dolares = precio_lista_dolares
                        lote_existente.precio_credito_12_meses_soles = precio_credito_12_meses_soles
                        lote_existente.precio_credito_24_meses_soles = precio_credito_24_meses_soles
                        lote_existente.precio_credito_12_meses_dolares = precio_credito_12_meses_dolares
                        lote_existente.precio_credito_24_meses_dolares = precio_credito_24_meses_dolares
                        lote_existente.estado_lote = 'Disponible'
                        lote_existente.save()
                        actualizados += 1
                        print(f"Actualizado lote existente: {proyecto} Mz:{manzana} Lt:{numero_lote} Etapa:{etapa}")
                    else:
                        Lote.objects.create(
                            ubicacion_proyecto=proyecto,
                            manzana=manzana,
                            numero_lote=numero_lote,
                            etapa=etapa,
                            area_m2=area_m2,
                            precio_lista_soles=precio_lista_soles,
                            precio_lista_dolares=precio_lista_dolares,
                            precio_credito_12_meses_soles=precio_credito_12_meses_soles,
                            precio_credito_24_meses_soles=precio_credito_24_meses_soles,
                            precio_credito_12_meses_dolares=precio_credito_12_meses_dolares,
                            precio_credito_24_meses_dolares=precio_credito_24_meses_dolares,
                            estado_lote='Disponible'
                        )
                        creados += 1
                        print(f"Creado nuevo lote: {proyecto} Mz:{manzana} Lt:{numero_lote} Etapa:{etapa}")
                except Exception as e:
                    print(f'Error en fila: {row} -> {e}')
            print(f'Lotes creados: {creados}')
            print(f'Lotes actualizados: {actualizados}')
    except Exception as e:
        print(f'Error general en la importación: {e}')
        import traceback
        traceback.print_exc()
    print("=== FINALIZÓ IMPORTACIÓN DE LOTES ===")

importar_lotes() 