import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from gestion_inmobiliaria.models import Venta

v = Venta.objects.first()
if not v:
    print('No hay ventas registradas.')
    exit(0)
plan = v.plan_pago_venta
print('Venta:', v.id_venta, 'Pagado:', v.monto_pagado_actual)
print('Monto financiado:', plan.monto_total_credito)
print('N° Cuotas:', plan.numero_cuotas)
print('Cuota regular:', plan.monto_cuota_regular_original)
print('Inicio pagos:', plan.fecha_inicio_pago_cuotas)
print('Pagado:', v.monto_pagado_actual)
print('Cuotas:')
for c in plan.cuotas.all().order_by('numero_cuota'):
    print(f'  N°{c.numero_cuota} Estado:{c.estado_cuota} Monto:{c.monto_programado} Pagado:{c.monto_pagado} Vencimiento:{c.fecha_vencimiento}')
saldo = sum([float(c.saldo_cuota) for c in plan.cuotas.all()])
print('Saldo:', saldo) 