import django
import os
import sys
from collections import defaultdict

# Ajustar el path y settings si es necesario
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from gestion_inmobiliaria.models import Lote, Venta

print('=== INICIANDO LIMPIEZA DE LOTES DUPLICADOS ===')

# Agrupar lotes por combinación única
lotes_por_clave = defaultdict(list)
for lote in Lote.objects.all():
    clave = (lote.ubicacion_proyecto.strip().lower(), lote.manzana.strip() if lote.manzana else '', lote.numero_lote.strip() if lote.numero_lote else '', lote.etapa)
    lotes_por_clave[clave].append(lote)

total_duplicados = 0
eliminados = 0
for clave, lotes in lotes_por_clave.items():
    if len(lotes) > 1:
        total_duplicados += len(lotes) - 1
        # Mantener el primero que NO esté asociado a ventas, si todos tienen ventas, mantener el primero
        lotes_ordenados = sorted(lotes, key=lambda l: l.ventas_lote.count())
        lote_a_mantener = lotes_ordenados[0]
        for lote in lotes:
            if lote == lote_a_mantener:
                continue
            if lote.ventas_lote.exists():
                print(f"No se elimina {lote.id_lote} porque tiene ventas asociadas.")
                continue
            print(f"Eliminando lote duplicado: {lote.id_lote} ({lote.ubicacion_proyecto} Mz:{lote.manzana} Lt:{lote.numero_lote} Etapa:{lote.etapa})")
            lote.delete()
            eliminados += 1

print(f"Total de lotes duplicados detectados: {total_duplicados}")
print(f"Total de lotes eliminados: {eliminados}")
print("=== FINALIZÓ LIMPIEZA DE LOTES DUPLICADOS ===") 