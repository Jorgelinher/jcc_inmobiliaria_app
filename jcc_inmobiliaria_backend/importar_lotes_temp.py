import csv
from decimal import Decimal
from gestion_inmobiliaria.models import Lote

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
        with open('lotes_import.csv', encoding='utf-8') as f:
            r = csv.DictReader(f, delimiter=';')
            creados = 0
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
                except Exception as e:
                    print(f'Error en fila: {row} -> {e}')
            print(f'Lotes creados: {creados}')
    except Exception as e:
        print(f'Error general en la importación: {e}')
    print("=== FINALIZÓ IMPORTACIÓN DE LOTES ===")

if __name__ == '__main__':
    importar_lotes() 