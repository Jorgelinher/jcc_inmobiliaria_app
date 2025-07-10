import django
import os
import sys
from collections import defaultdict

# Ajustar el path y settings si es necesario
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from gestion_inmobiliaria.models import Lote

print('=== VERIFICACIÓN DE LOTES ===')

# Contar total de lotes
total_lotes = Lote.objects.count()
print(f'Total de lotes en la base de datos: {total_lotes}')

# Mostrar algunos ejemplos
print('\n--- Primeros 10 lotes ---')
for lote in Lote.objects.all()[:10]:
    print(f'ID: {lote.id_lote} | Proyecto: {lote.ubicacion_proyecto} | Mz: {lote.manzana} | Lt: {lote.numero_lote} | Etapa: {lote.etapa}')

# Verificar duplicados por combinación
print('\n--- Verificando duplicados ---')
lotes_por_clave = defaultdict(list)
for lote in Lote.objects.all():
    clave = (lote.ubicacion_proyecto.strip().lower(), lote.manzana.strip() if lote.manzana else '', lote.numero_lote.strip() if lote.numero_lote else '', lote.etapa)
    lotes_por_clave[clave].append(lote)

duplicados_encontrados = 0
for clave, lotes in lotes_por_clave.items():
    if len(lotes) > 1:
        duplicados_encontrados += 1
        print(f'\nDuplicados encontrados para: {clave}')
        for lote in lotes:
            print(f'  - ID: {lote.id_lote} | Proyecto: {lote.ubicacion_proyecto} | Mz: {lote.manzana} | Lt: {lote.numero_lote} | Etapa: {lote.etapa}')

print(f'\nTotal de combinaciones con duplicados: {duplicados_encontrados}')

# Mostrar estadísticas por proyecto
print('\n--- Estadísticas por proyecto ---')
proyectos = defaultdict(int)
for lote in Lote.objects.all():
    proyectos[lote.ubicacion_proyecto] += 1

for proyecto, cantidad in sorted(proyectos.items()):
    print(f'{proyecto}: {cantidad} lotes')

print('=== FINALIZÓ VERIFICACIÓN ===') 