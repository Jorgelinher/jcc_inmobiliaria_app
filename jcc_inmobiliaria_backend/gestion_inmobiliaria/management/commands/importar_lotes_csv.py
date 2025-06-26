from django.core.management.base import BaseCommand
from gestion_inmobiliaria.models import Lote
from decimal import Decimal
import csv
import os
from django.db import transaction

class Command(BaseCommand):
    help = 'Importa lotes desde el archivo lotes_import.csv con el formato especificado.'

    def handle(self, *args, **options):
        archivo_csv = 'lotes_import.csv'
        if not os.path.exists(archivo_csv):
            self.stdout.write(self.style.ERROR(f'❌ El archivo {archivo_csv} no existe en el directorio actual.'))
            return
        self.stdout.write(self.style.NOTICE(f'🚀 Iniciando importación de lotes desde {archivo_csv}'))
        self.stdout.write('=' * 60)
        total = 0
        creados = 0
        actualizados = 0
        errores = 0
        
        def clean_string(value):
            if value is None:
                return ''
            return str(value).strip()
        
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
        
        try:
            # Usar encoding='utf-8-sig' para manejar automáticamente el BOM
            with open(archivo_csv, 'r', encoding='utf-8-sig') as file:
                sample = file.read(1024)
                file.seek(0)
                delimiter = ';' if ';' in sample else ','
                reader = csv.DictReader(file, delimiter=delimiter)
                
                # Limpiar los nombres de columnas para remover BOM y espacios
                cleaned_fieldnames = []
                for fieldname in reader.fieldnames:
                    cleaned_fieldname = fieldname.strip().replace('\ufeff', '')
                    cleaned_fieldnames.append(cleaned_fieldname)
                
                self.stdout.write(self.style.NOTICE(f"Columnas detectadas: {cleaned_fieldnames}"))

                def get_col(row, colname):
                    # Buscar la columna ignorando BOM y espacios
                    for key in row.keys():
                        cleaned_key = key.strip().replace('\ufeff', '')
                        if cleaned_key.lower() == colname.strip().lower():
                            return row[key]
                    return ''

                for row_num, row in enumerate(reader, start=2):
                    total += 1
                    try:
                        with transaction.atomic():
                            proyecto = clean_string(get_col(row, 'PROYECTO')).strip()
                            etapa = clean_string(get_col(row, 'ETAPA')).strip()
                            manzana = clean_string(get_col(row, 'MANZANA')).strip()
                            numero_lote = clean_string(get_col(row, 'LOTE')).strip()
                            area_m2 = parse_decimal(get_col(row, 'AREA_m2'))
                            precio_lista_soles = parse_decimal(get_col(row, 'PRECIO_CONTADO_SOLES'))
                            precio_lista_dolares = parse_decimal(get_col(row, 'PRECIO_CONTADO_DOLARES'))
                            precio_credito_12_meses_soles = parse_decimal(get_col(row, '12_MESES_SOLES'))
                            precio_credito_24_meses_soles = parse_decimal(get_col(row, '24_MESES_SOLES'))
                            precio_credito_12_meses_dolares = parse_decimal(get_col(row, '12_MESES_DOLARES'))
                            precio_credito_24_meses_dolares = parse_decimal(get_col(row, '24_MESES_DOLARES'))

                            # Validar que el campo proyecto no esté vacío
                            if not proyecto:
                                self.stdout.write(self.style.ERROR(f'❌ Error en fila {row_num}: El campo PROYECTO está vacío. Fila omitida.'))
                                errores += 1
                                continue

                            # Lógica de proyecto para soles/dólares (más robusta)
                            proyecto_lower = proyecto.lower().replace('(', '').replace(')', '').replace(' ', '')
                            if any(x in proyecto_lower for x in ['aucallama', 'oasis2']):
                                # Solo dólares
                                precio_lista_soles = Decimal('0.00')
                                precio_credito_12_meses_soles = Decimal('0.00')
                                precio_credito_24_meses_soles = Decimal('0.00')
                            else:
                                # Solo soles
                                precio_lista_dolares = Decimal('0.00')
                                precio_credito_12_meses_dolares = Decimal('0.00')
                                precio_credito_24_meses_dolares = Decimal('0.00')

                            # Buscar lote existente por las 4 variables clave
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
                                self.stdout.write(self.style.WARNING(f'🔄 Lote actualizado: {proyecto} MZ {manzana} LT {numero_lote} ETAPA {etapa}'))
                            else:
                                Lote.objects.create(**lote_data)
                                creados += 1
                                self.stdout.write(self.style.SUCCESS(f'✅ Lote creado: {proyecto} MZ {manzana} LT {numero_lote} ETAPA {etapa}'))
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f'❌ Error en fila {row_num}: {e}'))
                        errores += 1
                        continue
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Error leyendo archivo CSV: {e}'))
            return
        
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(f'Total filas procesadas: {total}')
        self.stdout.write(f'Lotes creados: {creados}')
        self.stdout.write(f'Lotes actualizados: {actualizados}')
        self.stdout.write(f'Errores: {errores}')
        self.stdout.write(f'Total lotes procesados: {creados + actualizados}')
        if errores == 0:
            self.stdout.write(self.style.SUCCESS('\n🎉 ¡Importación de lotes completada exitosamente!'))
        else:
            self.stdout.write(self.style.WARNING(f'\n⚠️  Importación completada con {errores} errores')) 