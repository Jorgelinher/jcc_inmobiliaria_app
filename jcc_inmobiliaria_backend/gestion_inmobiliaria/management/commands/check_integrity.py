from django.core.management.base import BaseCommand
from gestion_inmobiliaria.models import Lote, Venta, ComisionVentaAsesor, Cliente, Presencia
from collections import Counter

class Command(BaseCommand):
    help = 'Chequea integridad de datos críticos del sistema.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Chequeando integridad de datos...'))
        errores = 0

        # 1. Lotes vendidos sin venta completada
        lotes_vendidos = Lote.objects.filter(estado_lote='Vendido')
        for lote in lotes_vendidos:
            ventas_completadas = Venta.objects.filter(lote=lote, status_venta='completada')
            if not ventas_completadas.exists():
                errores += 1
                self.stdout.write(self.style.ERROR(f'Lote {lote.id_lote} marcado como "Vendido" pero sin venta completada.'))

        # 2. Ventas completadas sin comisión
        ventas_completadas = Venta.objects.filter(status_venta='completada', cliente_firmo_contrato=True)
        for venta in ventas_completadas:
            if not venta.comisiones_asesores.exists():
                errores += 1
                self.stdout.write(self.style.ERROR(f'Venta {venta.id_venta} completada y firmada sin comisión registrada.'))

        # 3. Clientes duplicados por documento
        docs = list(Cliente.objects.exclude(numero_documento__isnull=True).exclude(numero_documento='').values_list('numero_documento', flat=True))
        duplicados = [doc for doc, count in Counter(docs).items() if count > 1]
        for doc in duplicados:
            clientes = Cliente.objects.filter(numero_documento=doc)
            errores += 1
            self.stdout.write(self.style.ERROR(f'Clientes duplicados con documento {doc}: {[c.id_cliente for c in clientes]}'))

        # 4. Presencias sin status válida
        presencias_invalidas = Presencia.objects.exclude(status_presencia__in=[c[0] for c in Presencia.STATUS_PRESENCIA_CHOICES])
        for p in presencias_invalidas:
            errores += 1
            self.stdout.write(self.style.ERROR(f'Presencia {p.id_presencia} con status inválido: {p.status_presencia}'))

        if errores == 0:
            self.stdout.write(self.style.SUCCESS('Integridad OK: No se detectaron problemas.'))
        else:
            self.stdout.write(self.style.WARNING(f'Integridad: {errores} problema(s) detectado(s).')) 