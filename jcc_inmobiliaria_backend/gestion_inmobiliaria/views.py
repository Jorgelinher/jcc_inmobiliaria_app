# gestion_inmobiliaria/views.py
from django.contrib.auth import login as django_login, logout as django_logout, authenticate
from django.middleware.csrf import get_token as get_csrf_token_value
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from django.utils.dateparse import parse_date
from django.db.models import Sum, Count, Value, DecimalField, Q
from django.db.models.functions import Coalesce, TruncMonth
from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from dateutil.relativedelta import relativedelta
from django.shortcuts import get_object_or_404
from django.db import transaction
import traceback
from rest_framework.decorators import action # <--- AÑADIR ESTA IMPORTACIÓN
from django.utils import timezone # Asegúrate que timezone esté importado

from .models import (
    Lote, Cliente, Asesor, Venta, ActividadDiaria,
    DefinicionMetaComision, TablaComisionDirecta, RegistroPago,
    Presencia, PlanPagoVenta, CuotaPlanPago
)

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions, viewsets
from django_filters.rest_framework import DjangoFilterBackend

from .serializers import (
    LoteSerializer, ClienteSerializer, AsesorSerializer, VentaSerializer, ActividadDiariaSerializer,
    RegistroPagoSerializer, PresenciaSerializer, TablaComisionDirectaSerializer,
    ClienteCreateSerializer,
    PlanPagoVentaSerializer, CuotaPlanPagoSerializer
)
from .filters import (
    LoteFilter, ClienteFilter, AsesorFilter, VentaFilter, ActividadDiariaFilter,
    PresenciaFilter
)

# --- Vistas de Autenticación ---
@method_decorator(ensure_csrf_cookie, name='dispatch')
class GetCSRFToken(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request, format=None):
        token = get_csrf_token_value(request)
        return Response({'detail': 'CSRF cookie set.', 'csrfToken': token})

@method_decorator(csrf_protect, name='dispatch')
class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    def post(self, request, format=None):
        username = request.data.get('username'); password = request.data.get('password')
        user = authenticate(request, username=username, password=password)
        if user is not None:
            django_login(request, user)
            return Response({'success': True, 'user': {'id': user.id, 'username': user.username, 'email': user.email}})
        return Response({'success': False, 'error': 'Credenciales inválidas.'}, status=status.HTTP_400_BAD_REQUEST)

class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, format=None):
        django_logout(request); return Response({'success': True, 'detail': 'Logout exitoso.'})

class AuthStatusView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request, format=None):
        if request.user.is_authenticated:
            return Response({'isAuthenticated': True, 'user': {'id': request.user.id, 'username': request.user.username, 'email': request.user.email}})
        return Response({'isAuthenticated': False, 'user': None})

# --- ModelViewSets para CRUD ---
class LoteViewSet(viewsets.ModelViewSet):
    queryset = Lote.objects.all().order_by('ubicacion_proyecto', 'etapa', 'manzana', 'numero_lote')
    serializer_class = LoteSerializer; permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]; filterset_class = LoteFilter

class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all().order_by('nombres_completos_razon_social')
    serializer_class = ClienteSerializer; permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]; filterset_class = ClienteFilter

class AsesorViewSet(viewsets.ModelViewSet):
    queryset = Asesor.objects.all().order_by('nombre_asesor')
    serializer_class = AsesorSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_class = AsesorFilter

class ActividadDiariaViewSet(viewsets.ModelViewSet):
    queryset = ActividadDiaria.objects.all().order_by('-fecha_actividad', 'asesor')
    serializer_class = ActividadDiariaSerializer; permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]; filterset_class = ActividadDiariaFilter

class RegistroPagoViewSet(viewsets.ModelViewSet):
    queryset = RegistroPago.objects.all().select_related('venta', 'cuota_plan_pago_cubierta').order_by('-fecha_pago')
    serializer_class = RegistroPagoSerializer; permission_classes = [permissions.IsAuthenticated]
    # La lógica de actualización de Venta y Cuota está en las señales de RegistroPago.

class VentaViewSet(viewsets.ModelViewSet):
    queryset = Venta.objects.all().select_related(
        'lote', 'cliente', 'vendedor_principal', 'id_socio_participante', 
        'plan_pago_venta'
    ).prefetch_related(
        'registros_pago', 
        'plan_pago_venta__cuotas'
    ).order_by('-fecha_venta')
    serializer_class = VentaSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_class = VentaFilter

    def _crear_o_actualizar_plan_pago(self, venta_instance):
        print(f"[VentaViewSet] Iniciando _crear_o_actualizar_plan_pago para Venta ID: {venta_instance.id_venta}")
        PlanPagoVenta.objects.filter(venta=venta_instance).delete() # Eliminar plan existente y sus cuotas
        print(f"[VentaViewSet] Plan de pago existente (si lo hubo) eliminado para Venta ID: {venta_instance.id_venta}")

        if venta_instance.tipo_venta == Venta.TIPO_VENTA_CREDITO and venta_instance.plazo_meses_credito and venta_instance.plazo_meses_credito > 0:
            monto_a_financiar = venta_instance.valor_lote_venta - venta_instance.cuota_inicial_requerida
            if monto_a_financiar <= Decimal('0.00'):
                print(f"[VentaViewSet] No hay monto a financiar para Venta ID: {venta_instance.id_venta} (Monto: {monto_a_financiar}). No se crea plan.")
                return None

            numero_cuotas = venta_instance.plazo_meses_credito
            if numero_cuotas <= 0:
                 print(f"[VentaViewSet ERROR] Número de cuotas es {numero_cuotas} para Venta ID: {venta_instance.id_venta}")
                 return None

            monto_cuota_bruto = monto_a_financiar / Decimal(numero_cuotas)
            monto_cuota_regular_calculado = monto_cuota_bruto.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            
            if monto_cuota_regular_calculado < Decimal('0.00'): monto_cuota_regular_calculado = Decimal('0.00')

            monto_total_cuotas_regulares_menos_una = monto_cuota_regular_calculado * (numero_cuotas - 1)
            monto_ultima_cuota = monto_a_financiar - monto_total_cuotas_regulares_menos_una
            if monto_ultima_cuota < Decimal('0.00'): monto_ultima_cuota = Decimal('0.00')
            
            fecha_primera_cuota = venta_instance.fecha_venta + relativedelta(months=1)
            
            print(f"[VentaViewSet] Creando PlanPago para Venta ID: {venta_instance.id_venta}. Monto: {monto_a_financiar}, Cuotas: {numero_cuotas}, Cuota Reg: {monto_cuota_regular_calculado}, Última Cuota: {monto_ultima_cuota}, Inicio: {fecha_primera_cuota}")

            plan_pago = PlanPagoVenta.objects.create(
                venta=venta_instance,
                monto_total_credito=monto_a_financiar,
                numero_cuotas=numero_cuotas,
                monto_cuota_regular_original=monto_cuota_regular_calculado, # <--- CORRECCIÓN AQUÍ
                fecha_inicio_pago_cuotas=fecha_primera_cuota
            )

            cuotas_a_crear = []
            for i in range(1, numero_cuotas + 1):
                fecha_vencimiento_cuota = fecha_primera_cuota + relativedelta(months=i-1)
                monto_esta_cuota = monto_ultima_cuota if i == numero_cuotas else monto_cuota_regular_calculado
                
                cuotas_a_crear.append(
                    CuotaPlanPago(
                        plan_pago_venta=plan_pago,
                        numero_cuota=i,
                        fecha_vencimiento=fecha_vencimiento_cuota,
                        monto_programado=monto_esta_cuota
                    )
                )
            CuotaPlanPago.objects.bulk_create(cuotas_a_crear)
            print(f"[VentaViewSet] {len(cuotas_a_crear)} cuotas creadas para PlanPago ID: {plan_pago.id_plan_pago}")
            return plan_pago
        return None
    # --- INICIO: NUEVA ACCIÓN PARA MARCAR FIRMA DE CONTRATO ---
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def marcar_firma_contrato(self, request, pk=None):
        venta = self.get_object()
        
        if venta.status_venta != Venta.STATUS_VENTA_PROCESABLE:
            return Response(
                {"error": "Solo se puede marcar la firma en ventas que estén en estado 'Procesable'."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if venta.cliente_firmo_contrato:
            return Response(
                {"message": "El contrato ya fue marcado como firmado previamente.", 
                 "fecha_firma": venta.fecha_firma_contrato},
                status=status.HTTP_200_OK # O 400 si se considera un error intentar marcar de nuevo
            )

        # Obtener fecha de firma del request (opcional, si no se pasa, se usa la actual)
        fecha_firma_str = request.data.get('fecha_firma_contrato')
        fecha_firma = None
        if fecha_firma_str:
            try:
                fecha_firma = datetime.strptime(fecha_firma_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({"error": "Formato de fecha_firma_contrato inválido. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Llamar al método del modelo
        venta.marcar_como_firmada(fecha_firma=fecha_firma, save_instance=True)
        
        serializer = self.get_serializer(venta)
        return Response(serializer.data)
    # --- FIN: NUEVA ACCIÓN ---

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        print("[VentaViewSet CREATE INICIO] Data recibida:", request.data)
        nuevo_cliente_data_req = request.data.get('nuevo_cliente_data')
        cliente_id_req = request.data.get('cliente')
        cliente_instance = None
        if nuevo_cliente_data_req:
            cliente_create_serializer = ClienteCreateSerializer(data=nuevo_cliente_data_req)
            if cliente_create_serializer.is_valid():
                numero_documento = nuevo_cliente_data_req.get('numero_documento')
                cliente_existente = Cliente.objects.filter(numero_documento=numero_documento).first()
                if cliente_existente: cliente_instance = cliente_existente
                else: cliente_instance = cliente_create_serializer.save()
            else: 
                print("[VentaViewSet CREATE ERROR] ClienteCreateSerializer inválido:", cliente_create_serializer.errors)
                return Response(cliente_create_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        elif cliente_id_req:
            try: cliente_instance = Cliente.objects.get(pk=cliente_id_req)
            except Cliente.DoesNotExist: 
                print(f"[VentaViewSet CREATE ERROR] Cliente ID {cliente_id_req} no encontrado.")
                return Response({'cliente': ['Cliente existente no encontrado.']}, status=status.HTTP_400_BAD_REQUEST)
        else: 
            print("[VentaViewSet CREATE ERROR] No se proveyó cliente ni datos de nuevo cliente.")
            return Response({'detail': 'Debe proporcionar un cliente existente o datos para uno nuevo.'}, status=status.HTTP_400_BAD_REQUEST)

        venta_data = request.data.copy()
        if cliente_instance: venta_data['cliente'] = cliente_instance.pk
        if 'nuevo_cliente_data' in venta_data: del venta_data['nuevo_cliente_data']
        
        print("[VentaViewSet CREATE] Data para VentaSerializer:", venta_data)
        serializer = self.get_serializer(data=venta_data)
        
        if not serializer.is_valid():
            print("[VentaViewSet CREATE ERROR] VentaSerializer inválido:", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        venta_instance = serializer.save() 
        print(f"[VentaViewSet CREATE] Venta guardada ID: {venta_instance.id_venta}, Valor: {venta_instance.valor_lote_venta}")


        
        self._crear_o_actualizar_plan_pago(venta_instance)
        
        venta_instance.refresh_from_db() # Asegurar que la instancia refleje el plan de pago creado
        response_serializer = self.get_serializer(venta_instance) 
        headers = self.get_success_headers(response_serializer.data)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        print(f"[VentaViewSet UPDATE INICIO] ID: {kwargs.get('pk')}, Data recibida:", request.data)
        partial = kwargs.pop('partial', False)
        instance = self.get_object() 

        venta_data = request.data.copy()
        if 'nuevo_cliente_data' in venta_data: del venta_data['nuevo_cliente_data']
        if 'cliente' in venta_data and venta_data['cliente'] != str(instance.cliente_id):
            try: Cliente.objects.get(pk=venta_data['cliente'])
            except Cliente.DoesNotExist: return Response({'cliente': ['Cliente para actualización no encontrado.']}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(instance, data=venta_data, partial=partial)
        
        if not serializer.is_valid():
            print("[VentaViewSet UPDATE ERROR] VentaSerializer inválido:", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        venta_instance = serializer.save()
        print(f"[VentaViewSet UPDATE] Venta actualizada ID: {venta_instance.id_venta}, Valor: {venta_instance.valor_lote_venta}")

        self._crear_o_actualizar_plan_pago(venta_instance)
        
        venta_instance.refresh_from_db()
        response_serializer = self.get_serializer(venta_instance)
        return Response(response_serializer.data)

class PresenciaViewSet(viewsets.ModelViewSet):
    queryset = Presencia.objects.all().select_related('cliente', 'lote_interes_inicial', 'asesor_captacion_opc', 'asesor_call_agenda', 'asesor_liner', 'asesor_closer', 'venta_asociada').order_by('-fecha_hora_presencia')
    serializer_class = PresenciaSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_class = PresenciaFilter
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        # ... (lógica de creación de Presencia como estaba) ...
        print("\n[PresenciaViewSet CREATE INICIO] ===========================================")
        print("[PresenciaViewSet CREATE] Data recibida:", request.data)
        nuevo_cliente_data_req = request.data.get('nuevo_cliente_data')
        cliente_id_req = request.data.get('cliente')
        cliente_instance = None
        if nuevo_cliente_data_req:
            print("[PresenciaViewSet CREATE] Intentando crear/obtener cliente desde nuevo_cliente_data.")
            cliente_create_serializer = ClienteCreateSerializer(data=nuevo_cliente_data_req)
            if cliente_create_serializer.is_valid():
                numero_documento = nuevo_cliente_data_req.get('numero_documento')
                print(f"[PresenciaViewSet CREATE] Buscando cliente existente con N° Doc: {numero_documento}")
                cliente_existente = Cliente.objects.filter(numero_documento=numero_documento).first()
                if cliente_existente:
                    cliente_instance = cliente_existente
                    print(f"[PresenciaViewSet CREATE] Cliente existente encontrado: ID {cliente_instance.id_cliente}")
                else:
                    cliente_instance = cliente_create_serializer.save()
                    print(f"[PresenciaViewSet CREATE] Nuevo cliente creado: ID {cliente_instance.id_cliente}")
            else:
                print("[PresenciaViewSet CREATE ERROR] ClienteCreateSerializer inválido:", cliente_create_serializer.errors)
                return Response(cliente_create_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        elif cliente_id_req:
            try:
                cliente_instance = Cliente.objects.get(pk=cliente_id_req)
                print(f"[PresenciaViewSet CREATE] Cliente existente por ID encontrado: {cliente_instance.id_cliente}")
            except Cliente.DoesNotExist:
                print(f"[PresenciaViewSet CREATE ERROR] Cliente con ID {cliente_id_req} no encontrado.")
                return Response({'cliente': ['Cliente existente no encontrado.']}, status=status.HTTP_400_BAD_REQUEST)
        else:
            print("[PresenciaViewSet CREATE ERROR] No se proporcionó cliente existente ni datos para nuevo cliente.")
            return Response({'detail': 'Debe proporcionar un cliente existente o datos para uno nuevo para la presencia.'}, status=status.HTTP_400_BAD_REQUEST)

        presencia_data = request.data.copy()
        if cliente_instance: presencia_data['cliente'] = cliente_instance.pk
        if 'nuevo_cliente_data' in presencia_data: del presencia_data['nuevo_cliente_data'] 
        
        print("[PresenciaViewSet CREATE] Data para PresenciaSerializer:", presencia_data)
        serializer = self.get_serializer(data=presencia_data)
        
        if serializer.is_valid():
            print("[PresenciaViewSet CREATE] PresenciaSerializer válido. Intentando guardar...")
            try:
                instancia_guardada = serializer.save()
                print(f"[PresenciaViewSet CREATE ÉXITO] Presencia guardada ID: {instancia_guardada.id_presencia}, Cliente ID: {instancia_guardada.cliente.id_cliente if instancia_guardada.cliente else 'N/A'}")
                headers = self.get_success_headers(serializer.data)
                return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
            except Exception as e:
                print(f"[PresenciaViewSet CREATE ERROR AL GUARDAR] Excepción durante serializer.save(): {str(e)}")
                traceback.print_exc()
                return Response({"detail": f"Error interno al guardar la presencia: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            print("[PresenciaViewSet CREATE ERROR] PresenciaSerializer inválido:", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PlanPagoVentaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PlanPagoVenta.objects.all().select_related(
        'venta__cliente', 'venta__lote'
    ).prefetch_related('cuotas').order_by('-fecha_creacion')
    serializer_class = PlanPagoVentaSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = {
        'venta__id_venta': ['exact'],
        'venta__cliente__nombres_completos_razon_social': ['icontains'],
        'venta__lote__id_lote': ['exact'],
        'fecha_creacion': ['gte', 'lte'],
    }

class CuotaPlanPagoViewSet(viewsets.ModelViewSet):
    queryset = CuotaPlanPago.objects.all().select_related(
        'plan_pago_venta__venta__cliente', 
        'plan_pago_venta__venta__lote'
    ).order_by('plan_pago_venta__venta__id_venta', 'numero_cuota')
    serializer_class = CuotaPlanPagoSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = {
        'plan_pago_venta__venta__id_venta': ['exact'],
        'estado_cuota': ['exact'],
        'fecha_vencimiento': ['gte', 'lte', 'exact'],
        'plan_pago_venta__id_plan_pago': ['exact']
    }
    
    def destroy(self, request, *args, **kwargs):
        return Response({"detail": "La eliminación de cuotas individuales no está permitida."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def perform_update(self, serializer):
        cuota_instance = serializer.instance 
        # Guardar los campos que vinieron en el request y que el serializer permite actualizar
        updated_instance = serializer.save()
        
        # Volver a llamar a actualizar_estado para asegurar la consistencia del estado
        # después de que los campos (ej. monto_pagado) hayan sido actualizados por el serializer.
        updated_instance.actualizar_estado(save_instance=True)


# --- Vistas personalizadas (GetAdvisorsForFilterAPIView, GetDashboardDataAPIView, GetCommissionSummaryDataAPIView, GetDefaultCommissionRateAPIView, etc.) ...
# ... (El resto de las vistas como estaban) ...


# --- Vistas personalizadas (sin cambios significativos para esta funcionalidad) ---
# ... (GetAdvisorsForFilterAPIView, GetDashboardDataAPIView, GetCommissionSummaryDataAPIView, GetDefaultCommissionRateAPIView, etc.) ...


# --- Vistas personalizadas APIView ---
# ... (GetAdvisorsForFilterAPIView, GetDashboardDataAPIView, GetCommissionSummaryDataAPIView, GetDefaultCommissionRateAPIView sin cambios)
# ... (CalculateCommissionAPIView, GetCommissionStructureAPIView, GetGeneralConfigsAPIView sin cambios)
# Se omite el resto de vistas por brevedad
class GetAdvisorsForFilterAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, format=None):
        asesores = Asesor.objects.all().values('id_asesor', 'nombre_asesor', 'tipo_asesor_actual')
        formatted_asesores = [{'id': a['id_asesor'], 'name': a['nombre_asesor'], 'tipo_asesor_actual': a['tipo_asesor_actual']} for a in asesores]
        return Response(formatted_asesores)

class GetDashboardDataAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, format=None):
        try:
            start_date_str = request.query_params.get('startDate'); end_date_str = request.query_params.get('endDate')
            asesor_id_filter = request.query_params.get('asesorId'); tipo_venta_filter = request.query_params.get('tipoVenta')
            tipo_asesor_ranking_filter = request.query_params.get('tipoAsesor')
            medio_captacion_filter = request.query_params.get('medio_captacion')
            status_venta_filter = request.query_params.get('status_venta')

            start_date = parse_date(start_date_str) if start_date_str else None
            end_date = parse_date(end_date_str) if end_date_str else None
            if end_date: end_date = datetime.combine(end_date, datetime.max.time()).date()

            queryset_ventas = Venta.objects.all()
            if start_date: queryset_ventas = queryset_ventas.filter(fecha_venta__gte=start_date)
            if end_date: queryset_ventas = queryset_ventas.filter(fecha_venta__lte=end_date)
            if asesor_id_filter: queryset_ventas = queryset_ventas.filter(vendedor_principal_id=asesor_id_filter)
            if tipo_venta_filter: queryset_ventas = queryset_ventas.filter(tipo_venta=tipo_venta_filter)
            if status_venta_filter: queryset_ventas = queryset_ventas.filter(status_venta=status_venta_filter)
            if medio_captacion_filter: queryset_ventas = queryset_ventas.filter(presencia_que_origino__medio_captacion=medio_captacion_filter)

            kpis_ventas = queryset_ventas.aggregate(total_monto=Coalesce(Sum('valor_lote_venta', output_field=DecimalField()), Value(Decimal('0.0')), output_field=DecimalField()), total_numero=Coalesce(Count('id_venta'), Value(0)))
            total_ventas_monto = kpis_ventas['total_monto']; total_ventas_numero = kpis_ventas['total_numero']
            asesores_activos = Asesor.objects.count()
            lotes_disponibles = Lote.objects.filter(estado_lote='Disponible').count()
            lotes_reservados = Lote.objects.filter(estado_lote='Reservado').count()
            lotes_vendidos = Lote.objects.filter(estado_lote='Vendido').count()
            ventas_por_tipo_q = queryset_ventas.values('tipo_venta').annotate(cantidad=Count('id_venta')).order_by('tipo_venta')
            ventas_por_tipo_data = [['Tipo de Venta', 'Cantidad']]; tipo_venta_display_map = dict(Venta.TIPO_VENTA_CHOICES)
            for item in ventas_por_tipo_q: display_name = tipo_venta_display_map.get(item['tipo_venta'], item['tipo_venta']); ventas_por_tipo_data.append([display_name, item['cantidad']])
            if len(ventas_por_tipo_data) == 1: ventas_por_tipo_data.append(['Sin datos', 0])
            ventas_mensuales_q = queryset_ventas.annotate(mes_agg=TruncMonth('fecha_venta')).values('mes_agg').annotate(total_monto_mes=Coalesce(Sum('valor_lote_venta', output_field=DecimalField()), Value(Decimal('0.0')), output_field=DecimalField())).order_by('mes_agg')
            ventas_mensuales_data = [['Mes', 'Monto Total Ventas']]
            for item in ventas_mensuales_q:
                if item['mes_agg']: ventas_mensuales_data.append([item['mes_agg'].strftime('%Y-%m'), float(item['total_monto_mes'])])
            if len(ventas_mensuales_data) == 1: ventas_mensuales_data.append(['Sin datos', 0.0])
            def get_ranking_data(asesor_tipo_actual_val, base_queryset):
                ranking_q = base_queryset.filter(vendedor_principal__tipo_asesor_actual=asesor_tipo_actual_val).values('vendedor_principal__nombre_asesor').annotate(num_ventas=Count('id_venta')).order_by('-num_ventas')[:5]
                data_ranking = [[f'Asesor {asesor_tipo_actual_val}', 'N° Ventas']]
                for item_rank in ranking_q: data_ranking.append([item_rank['vendedor_principal__nombre_asesor'], item_rank['num_ventas']])
                if len(data_ranking) == 1: data_ranking.append(['Sin datos', 0])
                return data_ranking
            ranking_juniors_data = get_ranking_data('Junior', queryset_ventas) if not tipo_asesor_ranking_filter or tipo_asesor_ranking_filter == 'Junior' else [['Asesor Junior', 'N° Ventas'],['Filtrado',0]]
            ranking_socios_data = get_ranking_data('Socio', queryset_ventas) if not tipo_asesor_ranking_filter or tipo_asesor_ranking_filter == 'Socio' else [['Asesor Socio', 'N° Ventas'],['Filtrado',0]]

            queryset_pagos = RegistroPago.objects.all()
            if start_date: queryset_pagos = queryset_pagos.filter(fecha_pago__gte=start_date)
            if end_date: queryset_pagos = queryset_pagos.filter(fecha_pago__lte=end_date)
            if asesor_id_filter: queryset_pagos = queryset_pagos.filter(venta__vendedor_principal_id=asesor_id_filter)
            if tipo_venta_filter: queryset_pagos = queryset_pagos.filter(venta__tipo_venta=tipo_venta_filter)
            if status_venta_filter: queryset_pagos = queryset_pagos.filter(venta__status_venta=status_venta_filter)
            if medio_captacion_filter: queryset_pagos = queryset_pagos.filter(venta__presencia_que_origino__medio_captacion=medio_captacion_filter)
            recaudo_mensual_q = queryset_pagos.annotate(mes_pago=TruncMonth('fecha_pago')).values('mes_pago').annotate(total_recaudado=Coalesce(Sum('monto_pago', output_field=DecimalField()), Value(Decimal('0.00')))).order_by('mes_pago')
            recaudo_mensual_data = [['Mes', 'Recaudo Total (S/.)']]
            for item in recaudo_mensual_q:
                if item['mes_pago']: recaudo_mensual_data.append([item['mes_pago'].strftime('%Y-%m'), float(item['total_recaudado'])])
            if len(recaudo_mensual_data) == 1: recaudo_mensual_data.append(['Sin datos', 0.0])

            queryset_presencias = Presencia.objects.all()
            if start_date: queryset_presencias = queryset_presencias.filter(fecha_hora_presencia__date__gte=start_date)
            if end_date: queryset_presencias = queryset_presencias.filter(fecha_hora_presencia__date__lte=end_date)
            if asesor_id_filter: queryset_presencias = queryset_presencias.filter(Q(asesor_captacion_opc_id=asesor_id_filter) | Q(asesor_call_agenda_id=asesor_id_filter) | Q(asesor_liner_id=asesor_id_filter) | Q(asesor_closer_id=asesor_id_filter)).distinct()
            if medio_captacion_filter: queryset_presencias = queryset_presencias.filter(medio_captacion=medio_captacion_filter)

            trunc_kind = TruncMonth('fecha_hora_presencia'); date_format = '%Y-%m'

            historico_presencias_q = queryset_presencias.annotate(periodo=trunc_kind).values('periodo').annotate(cantidad=Count('id_presencia')).order_by('periodo')
            historico_presencias_data = [['Periodo', 'Cantidad de Presencias']]
            for item in historico_presencias_q:
                if item['periodo']: periodo_str = item['periodo'].strftime(date_format); historico_presencias_data.append([periodo_str, item['cantidad']])
            if len(historico_presencias_data) == 1: historico_presencias_data.append(['Sin datos', 0])

            response_data = {"success": True, "message": "Datos del dashboard cargados correctamente.", "tarjetas": {"totalVentasMonto": total_ventas_monto, "totalVentasNumero": total_ventas_numero, "asesoresActivos": asesores_activos, "lotesDisponibles": lotes_disponibles, "lotesReservados": lotes_reservados, "lotesVendidos": lotes_vendidos,}, "graficos": {"ventasPorTipo": ventas_por_tipo_data, "ventasMensuales": ventas_mensuales_data, "rankingJuniors": ranking_juniors_data, "rankingSocios": ranking_socios_data, "recaudoMensual": recaudo_mensual_data, "historicoPresencias": historico_presencias_data,}}
            return Response(response_data)
        except Exception as e:
            print(f"Error en GetDashboardDataAPIView: {str(e)}"); import traceback; traceback.print_exc(); empty_chart_data = [['Error', 0]]
            return Response({"success": False, "message": f"Error al procesar los datos del dashboard: Ocurrió un error inesperado. Detalle: {str(e)}", "tarjetas": {"totalVentasMonto": 0, "totalVentasNumero": 0, "asesoresActivos": 0, "lotesDisponibles": 0, "lotesReservados": 0, "lotesVendidos": 0,}, "graficos": {"ventasPorTipo": [['Tipo de Venta', 'Cantidad']] + empty_chart_data, "ventasMensuales": [['Mes', 'Monto Total Ventas']] + empty_chart_data, "rankingJuniors": [['Asesor Junior', 'N° Ventas']] + empty_chart_data, "rankingSocios": [['Asesor Socio', 'N° Ventas']] + empty_chart_data, "recaudoMensual": [['Mes', 'Recaudo Total (S/.)']] + empty_chart_data, "historicoPresencias": [['Periodo', 'Cantidad de Presencias']] + empty_chart_data,}}, status=500)

class GetCommissionSummaryDataAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def _get_mes_en_rol(self, asesor, fecha_calculo):
        if not asesor.fecha_ingreso: return 0
        fecha_inicio_rol = asesor.fecha_ingreso
        if asesor.tipo_asesor_actual == 'Socio' and asesor.fecha_cambio_socio:
            fecha_inicio_rol = asesor.fecha_cambio_socio
        if isinstance(fecha_calculo, datetime): fecha_calculo_date = fecha_calculo.date()
        else: fecha_calculo_date = fecha_calculo
        diff = relativedelta(fecha_calculo_date, fecha_inicio_rol)
        meses_en_rol = diff.years * 12 + diff.months + 1
        return meses_en_rol if meses_en_rol > 0 else 1

    def get(self, request, format=None):
        try:
            asesor_id_filter = request.query_params.get('asesor_id')
            mes_filter_str = request.query_params.get('mes'); anio_filter_str = request.query_params.get('anio')
            if not mes_filter_str or not anio_filter_str: return Response({"success": False, "message": "Los parámetros 'mes' y 'anio' son requeridos."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                mes = int(mes_filter_str); anio = int(anio_filter_str)
                fecha_inicio_periodo = date(anio, mes, 1)
                next_month = mes + 1 if mes < 12 else 1; next_year = anio if mes < 12 else anio + 1
                fecha_fin_periodo = date(next_year, next_month, 1) - timedelta(days=1)
            except ValueError: return Response({"success": False, "message": "Formato de 'mes' o 'anio' inválido."}, status=status.HTTP_400_BAD_REQUEST)

            asesores_a_procesar = Asesor.objects.all()
            if asesor_id_filter: asesores_a_procesar = asesores_a_procesar.filter(id_asesor=asesor_id_filter)
            if not asesores_a_procesar.exists(): return Response({"success": True, "summary": [], "message": "No se encontraron asesores con los filtros aplicados."})

            summary_list = []
            for asesor in asesores_a_procesar:
                asesor_summary = {"asesor_id": asesor.id_asesor, "nombre_asesor": asesor.nombre_asesor, "tipo_asesor": asesor.tipo_asesor_actual, "periodo": fecha_inicio_periodo.strftime("%B %Y"), "metas": {},"comisiones": {"comision_directa_total_soles": Decimal('0.00'), "comision_residual_total_soles": Decimal('0.00'), "comision_total_calculada_soles": Decimal('0.00'), "detalle_comisiones_ventas": []}}
                mes_en_rol_actual = self._get_mes_en_rol(asesor, fecha_fin_periodo)
                definicion_meta = DefinicionMetaComision.objects.filter(tipo_asesor=asesor.tipo_asesor_actual, mes_en_rol=mes_en_rol_actual).first()
                if not definicion_meta: asesor_summary["metas"]["aviso"] = f"No se encontró definición de metas para {asesor.tipo_asesor_actual} en el mes {mes_en_rol_actual} de rol."
                else:
                    actividades_periodo = ActividadDiaria.objects.filter(asesor=asesor, fecha_actividad__gte=fecha_inicio_periodo, fecha_actividad__lte=fecha_fin_periodo)
                    ventas_directas_del_periodo = Venta.objects.filter(vendedor_principal=asesor, fecha_venta__gte=fecha_inicio_periodo, fecha_venta__lte=fecha_fin_periodo)
                    logrado_opc = actividades_periodo.aggregate(total=Coalesce(Sum('datos_captados_opc'), Value(0)))['total']
                    logrado_presencias = actividades_periodo.aggregate(total=Coalesce(Sum('presencias_generadas'), Value(0)))['total']
                    logrado_ventas_directas_num = ventas_directas_del_periodo.count()
                    asesor_summary["metas"]["datos_opc"] = {"meta": definicion_meta.meta_datos_opc, "logrado": logrado_opc, "porcentaje": round((logrado_opc / definicion_meta.meta_datos_opc * 100) if definicion_meta.meta_datos_opc > 0 else 0, 2)}
                    asesor_summary["metas"]["presencias"] = {"meta": definicion_meta.meta_presencias, "logrado": logrado_presencias, "porcentaje": round((logrado_presencias / definicion_meta.meta_presencias * 100) if definicion_meta.meta_presencias > 0 else 0, 2)}
                    asesor_summary["metas"]["ventas_directas_numero"] = {"meta": definicion_meta.meta_ventas_directas, "logrado": logrado_ventas_directas_num, "porcentaje": round((logrado_ventas_directas_num / definicion_meta.meta_ventas_directas * 100) if definicion_meta.meta_ventas_directas > 0 else 0, 2)}

                ventas_comisionables_directas = Venta.objects.filter(vendedor_principal=asesor, fecha_venta__gte=fecha_inicio_periodo, fecha_venta__lte=fecha_fin_periodo, status_venta=Venta.STATUS_VENTA_PROCESABLE)
                for venta in ventas_comisionables_directas:
                    comision_venta_actual = Decimal('0.00')
                    porcentaje_aplicado_str = "Tabla"

                    if venta.porcentaje_comision_vendedor_principal_personalizado is not None:
                        comision_venta_actual = venta.valor_lote_venta * (venta.porcentaje_comision_vendedor_principal_personalizado / Decimal('100.00'))
                        porcentaje_aplicado_str = f"{venta.porcentaje_comision_vendedor_principal_personalizado}% (Pers.)"
                    else:
                        rol_busqueda = None; participacion_busqueda = 'N/A'
                        if asesor.tipo_asesor_actual == 'Junior':
                            rol_busqueda = TablaComisionDirecta.ROL_ASESOR_EN_VENTA_JUNIOR_VP
                            participacion_busqueda = venta.participacion_junior_venta if venta.participacion_junior_venta else 'N/A'
                        elif asesor.tipo_asesor_actual == 'Socio':
                            rol_busqueda = TablaComisionDirecta.ROL_ASESOR_EN_VENTA_SOCIO_VP
                            participacion_busqueda = 'N/A'

                        if rol_busqueda:
                            tabla_comision_regla = TablaComisionDirecta.objects.filter(
                                rol_asesor_en_venta=rol_busqueda,
                                tipo_venta=venta.tipo_venta,
                                participacion_en_venta_aplicable=participacion_busqueda
                            ).first()
                            if tabla_comision_regla:
                                comision_venta_actual = venta.valor_lote_venta * tabla_comision_regla.porcentaje_comision
                                porcentaje_aplicado_str = f"{tabla_comision_regla.porcentaje_comision*100:.2f}% (Tabla)"

                    asesor_summary["comisiones"]["comision_directa_total_soles"] += comision_venta_actual
                    asesor_summary["comisiones"]["detalle_comisiones_ventas"].append({
                        "venta_id": venta.id_venta,
                        "fecha_venta": venta.fecha_venta.strftime("%Y-%m-%d"),
                        "lote_id": venta.lote.id_lote,
                        "valor_venta_soles": venta.valor_lote_venta,
                        "tipo_venta": venta.get_tipo_venta_display(),
                        "comision_calculada_soles": comision_venta_actual,
                        "porcentaje_aplicado": porcentaje_aplicado_str,
                        "nota_comision": "Comisión Vendedor Principal"
                    })

                if asesor.tipo_asesor_actual == 'Socio':
                    ventas_donde_socio_participa = Venta.objects.filter(
                        id_socio_participante=asesor,
                        fecha_venta__gte=fecha_inicio_periodo,
                        fecha_venta__lte=fecha_fin_periodo,
                        status_venta=Venta.STATUS_VENTA_PROCESABLE
                    ).exclude(vendedor_principal=asesor)

                    for venta_participada in ventas_donde_socio_participa:
                        comision_participacion = Decimal('0.00')
                        porcentaje_aplicado_str_socio = "Tabla"

                        if venta_participada.porcentaje_comision_socio_personalizado is not None:
                            comision_participacion = venta_participada.valor_lote_venta * (venta_participada.porcentaje_comision_socio_personalizado / Decimal('100.00'))
                            porcentaje_aplicado_str_socio = f"{venta_participada.porcentaje_comision_socio_personalizado}% (Pers.)"
                        else:
                            participacion_socio_en_venta = venta_participada.participacion_socio_venta if venta_participada.participacion_socio_venta else 'N/A'
                            regla_participacion = TablaComisionDirecta.objects.filter(
                                rol_asesor_en_venta=TablaComisionDirecta.ROL_ASESOR_EN_VENTA_SOCIO_PARTICIPANTE,
                                tipo_venta=venta_participada.tipo_venta,
                                participacion_en_venta_aplicable=participacion_socio_en_venta
                            ).first()
                            if regla_participacion:
                                comision_participacion = venta_participada.valor_lote_venta * regla_participacion.porcentaje_comision
                                porcentaje_aplicado_str_socio = f"{regla_participacion.porcentaje_comision*100:.2f}% (Tabla)"

                        asesor_summary["comisiones"]["comision_directa_total_soles"] += comision_participacion
                        asesor_summary["comisiones"]["detalle_comisiones_ventas"].append({
                            "venta_id": venta_participada.id_venta,
                            "fecha_venta": venta_participada.fecha_venta.strftime("%Y-%m-%d"),
                            "lote_id": venta_participada.lote.id_lote,
                            "valor_venta_soles": venta_participada.valor_lote_venta,
                            "tipo_venta": venta_participada.get_tipo_venta_display(),
                            "comision_calculada_soles": comision_participacion,
                            "porcentaje_aplicado": porcentaje_aplicado_str_socio,
                            "nota_comision": "Por participación como socio"
                        })

                if asesor.tipo_asesor_actual == 'Socio' and definicion_meta and definicion_meta.comision_residual_venta_equipo_porc > 0:
                    ventas_equipo_procesables = Venta.objects.filter(vendedor_principal__id_referidor=asesor, fecha_venta__gte=fecha_inicio_periodo, fecha_venta__lte=fecha_fin_periodo, status_venta=Venta.STATUS_VENTA_PROCESABLE)
                    monto_ventas_equipo = ventas_equipo_procesables.aggregate(total=Coalesce(Sum('valor_lote_venta', output_field=DecimalField()), Value(Decimal('0.00')), output_field=DecimalField()))['total']
                    asesor_summary["comisiones"]["comision_residual_total_soles"] = monto_ventas_equipo * definicion_meta.comision_residual_venta_equipo_porc

                asesor_summary["comisiones"]["comision_total_calculada_soles"] = asesor_summary["comisiones"]["comision_directa_total_soles"] + asesor_summary["comisiones"]["comision_residual_total_soles"]
                summary_list.append(asesor_summary)
            return Response({"success": True, "summary": summary_list})
        except Exception as e:
            print(f"Error en GetCommissionSummaryDataAPIView: {str(e)}"); import traceback; traceback.print_exc()
            return Response({"success": False, "message": f"Error al procesar el resumen de comisiones: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GetDefaultCommissionRateAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, format=None):
        asesor_id = request.query_params.get('asesor_id')
        tipo_venta = request.query_params.get('tipo_venta')
        participacion_aplicable = request.query_params.get('participacion_en_venta_aplicable', 'N/A')
        rol_asesor_en_venta = request.query_params.get('rol_asesor_en_venta')

        if not all([asesor_id, tipo_venta, rol_asesor_en_venta]):
            return Response(
                {"success": False, "message": "Parámetros incompletos: se requiere asesor_id, tipo_venta y rol_asesor_en_venta."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            asesor = Asesor.objects.get(id_asesor=asesor_id)
        except Asesor.DoesNotExist:
            return Response(
                {"success": False, "message": "Asesor no encontrado."},
                status=status.HTTP_404_NOT_FOUND
            )

        regla_comision = TablaComisionDirecta.objects.filter(
            rol_asesor_en_venta=rol_asesor_en_venta,
            tipo_venta=tipo_venta,
            participacion_en_venta_aplicable=participacion_aplicable
        ).first()

        if regla_comision:
            return Response({
                "success": True,
                "porcentaje_comision_default": regla_comision.porcentaje_comision * 100,
                "detalle_regla": str(regla_comision)
            })
        else:
            return Response({
                "success": False,
                "message": f"No se encontró una regla de comisión directa para los parámetros: Rol '{rol_asesor_en_venta}', Tipo Venta '{tipo_venta}', Participación '{participacion_aplicable}'.",
                "porcentaje_comision_default": None # En frontend, si es null, no mostrar sugerencia.
            }, status=status.HTTP_404_NOT_FOUND) # Devolver 404 es semánticamente correcto si la regla no se encuentra


class CalculateCommissionAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, format=None):
        return Response({'message': 'Cálculo de comisión (TODO)'})

class GetCommissionStructureAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, format=None):
        return Response({'message': 'Estructura de comisiones (TODO)'})

class GetGeneralConfigsAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, format=None):
        return Response({'message': 'Configuraciones generales (TODO)'})