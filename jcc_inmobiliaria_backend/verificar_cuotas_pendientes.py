import os
import django
from datetime import date

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from gestion_inmobiliaria.models import Venta, CuotaPlanPago

ESTADOS_PENDIENTES = ['pendiente', 'atrasada', 'vencida_no_pagada']

print("\n--- Diagnóstico de Cuotas de Todas las Ventas ---\n")
ventas = Venta.objects.all().select_related('cliente', 'lote').order_by('-fecha_venta')
if not ventas:
    print("No hay ventas registradas.")
    exit()

for venta in ventas:
    print(f"Venta: {venta.id_venta} | Cliente: {venta.cliente.nombres_completos_razon_social} | Lote: {venta.lote}")
    cuotas = CuotaPlanPago.objects.filter(plan_pago_venta__venta=venta).order_by('numero_cuota')
    if not cuotas:
        print("  [!] No hay cuotas asociadas a esta venta.")
        continue
    for cuota in cuotas:
        estado = cuota.estado_cuota
        pendiente_flag = ' <-- PENDIENTE' if estado in ESTADOS_PENDIENTES else ''
        print(f"    Cuota #{cuota.numero_cuota} | Vence: {cuota.fecha_vencimiento} | Monto: S/. {cuota.monto_programado} | Estado: {estado}{pendiente_flag}")
    print("")
print("--- Fin del diagnóstico ---\n") 