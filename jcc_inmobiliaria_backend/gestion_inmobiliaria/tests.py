from django.test import TestCase
from .models import Lote, Asesor, Venta
from django.utils import timezone
from decimal import Decimal

# Create your tests here.

class IntegridadDatosTestCase(TestCase):
    def setUp(self):
        self.lote = Lote.objects.create(
            id_lote='L0001',
            ubicacion_proyecto='Proyecto Test',
            manzana='A',
            numero_lote='1',
            etapa=1,
            area_m2=100.0,
            precio_lista_soles=Decimal('50000.00'),
            estado_lote='Disponible',
        )
        self.asesor = Asesor.objects.create(
            id_asesor='A0001',
            nombre_asesor='Asesor Prueba',
            fecha_ingreso=timezone.now().date(),
            tipo_asesor_actual='Junior',
        )

    def test_lote_creado_correctamente(self):
        lote = Lote.objects.get(id_lote='L0001')
        self.assertEqual(lote.ubicacion_proyecto, 'Proyecto Test')
        self.assertEqual(lote.estado_lote, 'Disponible')

    def test_asesor_creado_correctamente(self):
        asesor = Asesor.objects.get(id_asesor='A0001')
        self.assertEqual(asesor.nombre_asesor, 'Asesor Prueba')
        self.assertEqual(asesor.tipo_asesor_actual, 'Junior')

    def test_creacion_venta_y_logica_status(self):
        from .models import Cliente, RegistroPago
        cliente = Cliente.objects.create(
            id_cliente='CLI0001',
            tipo_documento='DNI',
            numero_documento='12345678',
            nombres_completos_razon_social='Cliente Prueba',
        )
        venta = Venta.objects.create(
            id_venta='V0001',
            fecha_venta=timezone.now().date(),
            lote=self.lote,
            cliente=cliente,
            valor_lote_venta=Decimal('50000.00'),
            tipo_venta=Venta.TIPO_VENTA_CONTADO,
            plazo_meses_credito=0,
            vendedor_principal=self.asesor,
            status_venta=Venta.STATUS_VENTA_SEPARACION,
            monto_pagado_actual=Decimal('0.00'),
            cuota_inicial_requerida=Decimal('0.00'),
        )
        self.assertEqual(venta.status_venta, Venta.STATUS_VENTA_SEPARACION)
        # Simular pago total creando un registro de pago
        RegistroPago.objects.create(
            id_pago='P0001',
            venta=venta,
            fecha_pago=timezone.now().date(),
            monto_pago=Decimal('50000.00')
        )
        venta.refresh_from_db()
        venta.actualizar_status_y_monto_pagado()
        self.assertEqual(venta.status_venta, Venta.STATUS_VENTA_COMPLETADA)

    def test_no_hay_presencias_importadas(self):
        from .models import Presencia
        self.assertEqual(Presencia.objects.count(), 0)
