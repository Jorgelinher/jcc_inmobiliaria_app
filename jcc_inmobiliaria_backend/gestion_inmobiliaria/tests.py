from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status
from .models import Lote, Asesor, Venta, Cliente, Presencia, RegistroPago, GestionCobranza
from django.utils import timezone
from decimal import Decimal
from datetime import timedelta
import json
from django.core.management import call_command
from django.test import TestCase
from io import StringIO

# Tests de integridad de datos existentes
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
        self.assertEqual(Presencia.objects.count(), 0)

# Tests de API y endpoints
class APITestCase(APITestCase):
    def setUp(self):
        # Limpiar datos previos
        Lote.objects.all().delete()
        Cliente.objects.all().delete()
        Asesor.objects.all().delete()
        Presencia.objects.all().delete()
        Venta.objects.all().delete()
        RegistroPago.objects.all().delete()
        # Crear usuario de prueba
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        # Crear datos de prueba
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
        self.cliente = Cliente.objects.create(
            id_cliente='CLI0001',
            tipo_documento='DNI',
            numero_documento='12345678',
            nombres_completos_razon_social='Cliente Prueba',
            telefono_principal='999888777',
            direccion='Dirección Test'
        )

    def test_listar_clientes(self):
        url = reverse('cliente-list')
        response = self.client.get(url)
        data = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(data), 1)

    def test_crear_cliente(self):
        url = reverse('cliente-list')
        data = {
            'id_cliente': 'CLI0002',
            'tipo_documento': 'DNI',
            'numero_documento': '87654321',
            'nombres_completos_razon_social': 'Nuevo Cliente',
            'telefono_principal': '111222333',
            'direccion': 'Nueva Dirección'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Cliente.objects.count(), 2)

    def test_crear_cliente_duplicado(self):
        url = reverse('cliente-list')
        data = {
            'id_cliente': 'CLI0003',
            'tipo_documento': 'DNI',
            'numero_documento': '12345678',  # Ya existe
            'nombres_completos_razon_social': 'Cliente Duplicado',
            'telefono_principal': '444555666',
            'direccion': 'Dirección Duplicada'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('numero_documento', response.data)

    def test_listar_lotes(self):
        url = reverse('lote-list')
        response = self.client.get(url)
        data = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(data), 1)

    def test_crear_venta(self):
        url = reverse('venta-list')
        data = {
            'id_venta': 'V0001',
            'fecha_venta': timezone.now().date().isoformat(),
            'lote': self.lote.id_lote,
            'cliente': self.cliente.id_cliente,
            # 'valor_lote_venta': '50000.00',  # El modelo lo calcula
            'tipo_venta': 'contado',
            'plazo_meses_credito': 0,
            'vendedor_principal': self.asesor.id_asesor,
            'status_venta': 'separacion',
            'monto_pagado_actual': '0.00',
            'cuota_inicial_requerida': '0.00'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Venta.objects.count(), 1)

    def test_crear_presencia(self):
        url = reverse('presencia-list')
        data = {
            'id_presencia': 'P0001',
            'fecha_hora_presencia': timezone.now().isoformat(),
            'cliente': self.cliente.id_cliente,
            'proyecto_interes': 'Proyecto Test',
            'medio_captacion': 'campo_opc',
            'modalidad': 'presencial',
            'status_presencia': 'realizada',
            'tipo_tour': 'tour'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Presencia.objects.count(), 1)

# Tests de validaciones de negocio
class ValidacionesNegocioTestCase(TestCase):
    def setUp(self):
        Lote.objects.all().delete()
        Cliente.objects.all().delete()
        Asesor.objects.all().delete()
        Presencia.objects.all().delete()
        Venta.objects.all().delete()
        RegistroPago.objects.all().delete()
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
        self.cliente = Cliente.objects.create(
            id_cliente='CLI0001',
            tipo_documento='DNI',
            numero_documento='12345678',
            nombres_completos_razon_social='Cliente Prueba',
            telefono_principal='999888777',
            direccion='Dirección Test'
        )

    def test_venta_credito_requiere_plazo(self):
        venta = Venta(
            id_venta='V0001',
            fecha_venta=timezone.now().date(),
            lote=self.lote,
            cliente=self.cliente,
            valor_lote_venta=Decimal('50000.00'),
            tipo_venta='credito',
            plazo_meses_credito=0,  # Debería ser mayor a 0
            vendedor_principal=self.asesor,
            status_venta='separacion'
        )
        with self.assertRaises(Exception):
            venta.full_clean()

    def test_lote_vendido_cambia_estado(self):
        venta = Venta.objects.create(
            id_venta='V0001',
            fecha_venta=timezone.now().date(),
            lote=self.lote,
            cliente=self.cliente,
            valor_lote_venta=Decimal('50000.00'),
            tipo_venta='contado',
            plazo_meses_credito=0,
            vendedor_principal=self.asesor,
            status_venta='completada',
            cliente_firmo_contrato=True
        )
        self.lote.refresh_from_db()
        self.assertEqual(self.lote.estado_lote, 'Vendido')

    def test_calculo_comisiones(self):
        # Crear datos de prueba para comisiones
        from .models import TablaComisionDirecta
        TablaComisionDirecta.objects.create(
            rol_asesor_en_venta='JUNIOR_VENDEDOR_PRINCIPAL',
            tipo_venta='contado',
            participacion_en_venta_aplicable='N/A',
            porcentaje_comision=Decimal('0.0500')  # 5%
        )
        
        venta = Venta.objects.create(
            id_venta='V0001',
            fecha_venta=timezone.now().date(),
            lote=self.lote,
            cliente=self.cliente,
            valor_lote_venta=Decimal('50000.00'),
            tipo_venta='contado',
            plazo_meses_credito=0,
            vendedor_principal=self.asesor,
            status_venta='completada',
            cliente_firmo_contrato=True,
            monto_pagado_actual=Decimal('50000.00')
        )
        # Verificar que se creó la comisión
        from .models import ComisionVentaAsesor
        comision = ComisionVentaAsesor.objects.filter(venta=venta).first()
        self.assertIsNotNone(comision)
        self.assertEqual(comision.asesor, self.asesor)
        self.assertEqual(comision.porcentaje_comision, Decimal('5.00'))

# Tests de integración de flujos completos
class FlujosCompletosTestCase(TestCase):
    def setUp(self):
        Lote.objects.all().delete()
        Cliente.objects.all().delete()
        Asesor.objects.all().delete()
        Presencia.objects.all().delete()
        Venta.objects.all().delete()
        RegistroPago.objects.all().delete()
        # Crear usuario de prueba
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        
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
        self.cliente = Cliente.objects.create(
            id_cliente='CLI0001',
            tipo_documento='DNI',
            numero_documento='12345678',
            nombres_completos_razon_social='Cliente Prueba',
            telefono_principal='999888777',
            direccion='Dirección Test'
        )

    def test_flujo_completo_venta_contado(self):
        # 1. Crear presencia
        presencia = Presencia.objects.create(
            id_presencia='P0001',
            fecha_hora_presencia=timezone.now(),
            cliente=self.cliente,
            proyecto_interes='Proyecto Test',
            medio_captacion='facebook',
            modalidad='presencial',
            status_presencia='realizada'
        )
        # 2. Crear venta
        venta = Venta.objects.create(
            id_venta='V0001',
            fecha_venta=timezone.now().date(),
            lote=self.lote,
            cliente=self.cliente,
            valor_lote_venta=Decimal('50000.00'),
            tipo_venta='contado',
            plazo_meses_credito=0,
            vendedor_principal=self.asesor,
            status_venta='completada',
            cliente_firmo_contrato=True
        )
        # 3. Registrar pago
        pago = RegistroPago.objects.create(
            id_pago='P0001',
            venta=venta,
            fecha_pago=timezone.now().date(),
            monto_pago=Decimal('50000.00')
        )
        # 4. Verificar estados finales
        venta.refresh_from_db()
        self.lote.refresh_from_db()
        self.assertEqual(venta.status_venta, 'completada')
        self.assertEqual(self.lote.estado_lote, 'Vendido')
        self.assertEqual(venta.monto_pagado_actual, Decimal('50000.00'))

    def test_flujo_venta_credito_con_cobranza(self):
        # 1. Crear venta a crédito
        venta = Venta.objects.create(
            id_venta='V0002',
            fecha_venta=timezone.now().date(),
            lote=self.lote,
            cliente=self.cliente,
            valor_lote_venta=Decimal('50000.00'),
            tipo_venta='credito',
            plazo_meses_credito=12,
            vendedor_principal=self.asesor,
            status_venta='separacion',
            cuota_inicial_requerida=Decimal('10000.00')
        )
        
        # 2. Pago inicial
        pago_inicial = RegistroPago.objects.create(
            id_pago='P0002',
            venta=venta,
            fecha_pago=timezone.now().date(),
            monto_pago=Decimal('10000.00')
        )
        
        # 3. Crear plan de pago (necesario para cuotas)
        from .models import PlanPagoVenta
        plan_pago = PlanPagoVenta.objects.create(
            venta=venta,
            monto_total_credito=Decimal('40000.00'),
            numero_cuotas=12,
            monto_cuota_regular_original=Decimal('3333.33'),
            fecha_inicio_pago_cuotas=timezone.now().date() + timedelta(days=30)
        )
        
        # 4. Crear cuota para poder crear gestión de cobranza
        from .models import CuotaPlanPago
        cuota = CuotaPlanPago.objects.create(
            plan_pago_venta=plan_pago,
            numero_cuota=1,
            fecha_vencimiento=timezone.now().date() + timedelta(days=30),
            monto_programado=Decimal('3333.33')
        )
        
        # 5. Crear gestión de cobranza
        from .models import GestionCobranza
        cobranza = GestionCobranza.objects.create(
            cuota=cuota,
            responsable=self.user,
            tipo_contacto='LLAMADA',
            resultado='Cliente confirma pago para mañana',
            proximo_seguimiento=timezone.now().date() + timedelta(days=1)
        )
        
        # 6. Verificar estados
        venta.refresh_from_db()
        self.assertEqual(venta.status_venta, 'procesable')
        self.assertEqual(venta.monto_pagado_actual, Decimal('10000.00'))

class ComandoIntegridadTestCase(TestCase):
    def setUp(self):
        # Crear datos de prueba para el comando
        self.cliente1 = Cliente.objects.create(
            id_cliente='CLI0001',
            tipo_documento='DNI',
            numero_documento='12345678',
            nombres_completos_razon_social='Cliente Test 1'
        )
        self.cliente2 = Cliente.objects.create(
            id_cliente='CLI0002',
            tipo_documento='DNI',
            numero_documento='12345678',  # Duplicado
            nombres_completos_razon_social='Cliente Test 2'
        )
        self.lote = Lote.objects.create(
            id_lote='L0001',
            ubicacion_proyecto='Proyecto Test',
            area_m2=100.0,
            precio_lista_soles=Decimal('50000.00'),
            estado_lote='Vendido'
        )

    def test_comando_integridad_detecta_duplicados(self):
        out = StringIO()
        call_command('check_integrity', stdout=out)
        output = out.getvalue()
        
        # Verificar que detecte clientes duplicados
        self.assertIn('Clientes duplicados con documento 12345678', output)
        self.assertIn('Integridad: 2 problema(s) detectado(s)', output)

    def test_comando_integridad_detecta_lote_vendido_sin_venta(self):
        out = StringIO()
        call_command('check_integrity', stdout=out)
        output = out.getvalue()
        
        # Verificar que detecte lote vendido sin venta completada
        self.assertIn('Lote L0001 marcado como "Vendido" pero sin venta completada', output)
