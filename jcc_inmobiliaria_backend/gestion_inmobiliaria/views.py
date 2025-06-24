# gestion_inmobiliaria/views.py
from django.contrib.auth import login as django_login, logout as django_logout, authenticate
from django.middleware.csrf import get_token as get_csrf_token_value
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from django.utils.dateparse import parse_date
from django.db.models import Sum, Count, Value, DecimalField, Q, Case, When, IntegerField, F
from django.db.models.functions import Coalesce, TruncMonth, Cast
from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from dateutil.relativedelta import relativedelta
from django.shortcuts import get_object_or_404
from django.db import transaction
import traceback
from rest_framework.decorators import action 
from django.utils import timezone
from django.db.models import Sum, Count, Value, DecimalField, Q, Case, When, IntegerField, F # Ensure DecimalField, Value are imported
from django.db.models.functions import Coalesce, TruncMonth # Ensure Coalesce is imported
from decimal import Decimal
from rest_framework.permissions import AllowAny
from rest_framework.authentication import TokenAuthentication
from rest_framework.views import APIView
from django.conf import settings

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

# --- ModelViewSets para CRUD (sin cambios aquí, se omiten por brevedad) ---
class LoteViewSet(viewsets.ModelViewSet):
    queryset = Lote.objects.all().order_by('ubicacion_proyecto', 'etapa', 'manzana', 'numero_lote')
    serializer_class = LoteSerializer; permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]; filterset_class = LoteFilter

class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all().order_by('nombres_completos_razon_social')
    serializer_class = ClienteSerializer; permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]; filterset_class = ClienteFilter
    
    @action(detail=False, methods=['get'])
    def sin_presencia(self, request):
        """
        Obtiene clientes que NO tienen presencia registrada.
        Útil para evitar duplicados en el formulario de presencias.
        """
        try:
            # Obtener IDs de clientes que ya tienen presencia
            clientes_con_presencia = Presencia.objects.values_list('cliente_id', flat=True).distinct()
            
            # Filtrar clientes que NO están en esa lista
            clientes_sin_presencia = Cliente.objects.exclude(
                id_cliente__in=clientes_con_presencia
            ).order_by('nombres_completos_razon_social')
            
            # Aplicar búsqueda si se proporciona
            search = request.query_params.get('search', '')
            if search:
                clientes_sin_presencia = clientes_sin_presencia.filter(
                    Q(nombres_completos_razon_social__icontains=search) |
                    Q(telefono_principal__icontains=search) |
                    Q(numero_documento__icontains=search)
                )
            
            # Limitar resultados para evitar desplegables muy largos
            limit = int(request.query_params.get('limit', 50))
            clientes_sin_presencia = clientes_sin_presencia[:limit]
            
            # Serializar con formato para desplegable
            data = []
            for cliente in clientes_sin_presencia:
                data.append({
                    'id_cliente': cliente.id_cliente,
                    'nombres_completos_razon_social': cliente.nombres_completos_razon_social,
                    'telefono_principal': cliente.telefono_principal or '',
                    'numero_documento': cliente.numero_documento,
                    'display_text': f"{cliente.nombres_completos_razon_social} ({cliente.telefono_principal or 'Sin teléfono'})"
                })
            
            return Response({
                'results': data,
                'count': len(data),
                'total_available': Cliente.objects.exclude(id_cliente__in=clientes_con_presencia).count()
            })
            
        except Exception as e:
            return Response(
                {'error': f'Error al obtener clientes sin presencia: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        """
        Búsqueda predictiva de clientes para desplegables.
        Retorna clientes que coincidan con el término de búsqueda.
        """
        try:
            search = request.query_params.get('q', '')
            if not search or len(search) < 2:
                return Response({'results': [], 'count': 0})
            
            # Buscar en nombre, teléfono y documento
            clientes = Cliente.objects.filter(
                Q(nombres_completos_razon_social__icontains=search) |
                Q(telefono_principal__icontains=search) |
                Q(numero_documento__icontains=search)
            ).order_by('nombres_completos_razon_social')[:20]  # Limitar a 20 resultados
            
            data = []
            for cliente in clientes:
                data.append({
                    'id_cliente': cliente.id_cliente,
                    'nombres_completos_razon_social': cliente.nombres_completos_razon_social,
                    'telefono_principal': cliente.telefono_principal or '',
                    'numero_documento': cliente.numero_documento,
                    'display_text': f"{cliente.nombres_completos_razon_social} ({cliente.telefono_principal or 'Sin teléfono'})"
                })
            
            return Response({
                'results': data,
                'count': len(data)
            })
            
        except Exception as e:
            return Response(
                {'error': f'Error en búsqueda de clientes: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def para_ventas(self, request):
        """
        Obtiene TODOS los clientes para formularios de ventas.
        Útil para permitir múltiples ventas por cliente.
        PARA VENTAS: 1 cliente puede tener múltiples ventas
        """
        try:
            # Obtener todos los clientes
            clientes = Cliente.objects.all().order_by('nombres_completos_razon_social')
            
            # Aplicar búsqueda si se proporciona
            search = request.query_params.get('search', '')
            if search:
                clientes = clientes.filter(
                    Q(nombres_completos_razon_social__icontains=search) |
                    Q(telefono_principal__icontains=search) |
                    Q(numero_documento__icontains=search)
                )
            
            # Limitar resultados para evitar desplegables muy largos
            limit = int(request.query_params.get('limit', 50))
            clientes = clientes[:limit]
            
            # Serializar con formato para desplegable
            data = []
            for cliente in clientes:
                # Verificar si el cliente tiene presencia previa
                tiene_presencia = Presencia.objects.filter(cliente=cliente).exists()
                
                data.append({
                    'id_cliente': cliente.id_cliente,
                    'nombres_completos_razon_social': cliente.nombres_completos_razon_social,
                    'telefono_principal': cliente.telefono_principal or '',
                    'numero_documento': cliente.numero_documento,
                    'tiene_presencia': tiene_presencia,
                    'display_text': f"{cliente.nombres_completos_razon_social} ({cliente.telefono_principal or 'Sin teléfono'}){' *' if tiene_presencia else ''}"
                })
            
            return Response({
                'results': data,
                'count': len(data),
                'total_available': Cliente.objects.count()
            })
            
        except Exception as e:
            return Response(
                {'error': f'Error al obtener clientes para ventas: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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
        # print(f"[VentaViewSet] Iniciando _crear_o_actualizar_plan_pago para Venta ID: {venta_instance.id_venta}") # DEBUG
        PlanPagoVenta.objects.filter(venta=venta_instance).delete() 
        # print(f"[VentaViewSet] Plan de pago existente (si lo hubo) eliminado para Venta ID: {venta_instance.id_venta}") #DEBUG

        if venta_instance.tipo_venta == Venta.TIPO_VENTA_CREDITO and venta_instance.plazo_meses_credito and venta_instance.plazo_meses_credito > 0:
            monto_a_financiar = venta_instance.valor_lote_venta - venta_instance.cuota_inicial_requerida
            if monto_a_financiar <= Decimal('0.00'):
                # print(f"[VentaViewSet] No hay monto a financiar para Venta ID: {venta_instance.id_venta} (Monto: {monto_a_financiar}). No se crea plan.") # DEBUG
                return None

            numero_cuotas = venta_instance.plazo_meses_credito
            if numero_cuotas <= 0:
                 # print(f"[VentaViewSet ERROR] Número de cuotas es {numero_cuotas} para Venta ID: {venta_instance.id_venta}") # DEBUG
                 return None

            monto_cuota_bruto = monto_a_financiar / Decimal(numero_cuotas)
            monto_cuota_regular_calculado = monto_cuota_bruto.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            
            if monto_cuota_regular_calculado < Decimal('0.00'): monto_cuota_regular_calculado = Decimal('0.00')

            monto_total_cuotas_regulares_menos_una = monto_cuota_regular_calculado * (numero_cuotas - 1)
            monto_ultima_cuota = monto_a_financiar - monto_total_cuotas_regulares_menos_una
            if monto_ultima_cuota < Decimal('0.00'): monto_ultima_cuota = Decimal('0.00')
            
            fecha_primera_cuota = venta_instance.fecha_venta + relativedelta(months=1)
            
            # print(f"[VentaViewSet] Creando PlanPago para Venta ID: {venta_instance.id_venta}. Monto: {monto_a_financiar}, Cuotas: {numero_cuotas}, Cuota Reg: {monto_cuota_regular_calculado}, Última Cuota: {monto_ultima_cuota}, Inicio: {fecha_primera_cuota}") #DEBUG

            plan_pago = PlanPagoVenta.objects.create(
                venta=venta_instance,
                monto_total_credito=monto_a_financiar,
                numero_cuotas=numero_cuotas,
                monto_cuota_regular_original=monto_cuota_regular_calculado,
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
            # print(f"[VentaViewSet] {len(cuotas_a_crear)} cuotas creadas para PlanPago ID: {plan_pago.id_plan_pago}") # DEBUG
            return plan_pago
        return None

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
                status=status.HTTP_200_OK
            )

        fecha_firma_str = request.data.get('fecha_firma_contrato')
        fecha_firma_obj = None
        if fecha_firma_str:
            try:
                fecha_firma_obj = datetime.strptime(fecha_firma_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({"error": "Formato de fecha_firma_contrato inválido. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
        
        venta.marcar_como_firmada(fecha_firma=fecha_firma_obj) # El método del modelo ahora maneja el save
        
        serializer = self.get_serializer(venta)
        return Response(serializer.data)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        # print("[VentaViewSet CREATE INICIO] Data recibida:", request.data) # DEBUG
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
                # print("[VentaViewSet CREATE ERROR] ClienteCreateSerializer inválido:", cliente_create_serializer.errors) # DEBUG
                return Response(cliente_create_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        elif cliente_id_req:
            try: cliente_instance = Cliente.objects.get(pk=cliente_id_req)
            except Cliente.DoesNotExist: 
                # print(f"[VentaViewSet CREATE ERROR] Cliente ID {cliente_id_req} no encontrado.") # DEBUG
                return Response({'cliente': ['Cliente existente no encontrado.']}, status=status.HTTP_400_BAD_REQUEST)
        else: 
            # print("[VentaViewSet CREATE ERROR] No se proveyó cliente ni datos de nuevo cliente.") # DEBUG
            return Response({'detail': 'Debe proporcionar un cliente existente o datos para uno nuevo.'}, status=status.HTTP_400_BAD_REQUEST)

        venta_data = request.data.copy()
        if cliente_instance: venta_data['cliente'] = cliente_instance.pk
        if 'nuevo_cliente_data' in venta_data: del venta_data['nuevo_cliente_data']
        
        # print("[VentaViewSet CREATE] Data para VentaSerializer:", venta_data) #DEBUG
        serializer = self.get_serializer(data=venta_data)
        
        if not serializer.is_valid():
            # print("[VentaViewSet CREATE ERROR] VentaSerializer inválido:", serializer.errors) #DEBUG
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        venta_instance = serializer.save() 
        # print(f"[VentaViewSet CREATE] Venta guardada ID: {venta_instance.id_venta}, Valor: {venta_instance.valor_lote_venta}") #DEBUG
        
        self._crear_o_actualizar_plan_pago(venta_instance)
        
        venta_instance.refresh_from_db() 
        response_serializer = self.get_serializer(venta_instance) 
        headers = self.get_success_headers(response_serializer.data)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        # print(f"[VentaViewSet UPDATE INICIO] ID: {kwargs.get('pk')}, Data recibida:", request.data) #DEBUG
        partial = kwargs.pop('partial', False)
        instance = self.get_object() 

        venta_data = request.data.copy()
        if 'nuevo_cliente_data' in venta_data: del venta_data['nuevo_cliente_data']
        if 'cliente' in venta_data and venta_data['cliente'] != str(instance.cliente_id):
            try: Cliente.objects.get(pk=venta_data['cliente'])
            except Cliente.DoesNotExist: return Response({'cliente': ['Cliente para actualización no encontrado.']}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(instance, data=venta_data, partial=partial)
        
        if not serializer.is_valid():
            # print("[VentaViewSet UPDATE ERROR] VentaSerializer inválido:", serializer.errors) #DEBUG
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        venta_instance = serializer.save()
        # print(f"[VentaViewSet UPDATE] Venta actualizada ID: {venta_instance.id_venta}, Valor: {venta_instance.valor_lote_venta}") #DEBUG

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
        # print("\n[PresenciaViewSet CREATE INICIO] ===========================================") #DEBUG
        # print("[PresenciaViewSet CREATE] Data recibida:", request.data) #DEBUG
        nuevo_cliente_data_req = request.data.get('nuevo_cliente_data')
        cliente_id_req = request.data.get('cliente')
        cliente_instance = None
        if nuevo_cliente_data_req:
            # print("[PresenciaViewSet CREATE] Intentando crear/obtener cliente desde nuevo_cliente_data.") #DEBUG
            cliente_create_serializer = ClienteCreateSerializer(data=nuevo_cliente_data_req)
            if cliente_create_serializer.is_valid():
                numero_documento = nuevo_cliente_data_req.get('numero_documento')
                # print(f"[PresenciaViewSet CREATE] Buscando cliente existente con N° Doc: {numero_documento}") #DEBUG
                cliente_existente = Cliente.objects.filter(numero_documento=numero_documento).first()
                if cliente_existente:
                    cliente_instance = cliente_existente
                    # print(f"[PresenciaViewSet CREATE] Cliente existente encontrado: ID {cliente_instance.id_cliente}") #DEBUG
                else:
                    cliente_instance = cliente_create_serializer.save()
                    # print(f"[PresenciaViewSet CREATE] Nuevo cliente creado: ID {cliente_instance.id_cliente}") #DEBUG
            else:
                # print("[PresenciaViewSet CREATE ERROR] ClienteCreateSerializer inválido:", cliente_create_serializer.errors) #DEBUG
                return Response(cliente_create_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        elif cliente_id_req:
            try:
                cliente_instance = Cliente.objects.get(pk=cliente_id_req)
                # print(f"[PresenciaViewSet CREATE] Cliente existente por ID encontrado: {cliente_instance.id_cliente}") #DEBUG
            except Cliente.DoesNotExist:
                # print(f"[PresenciaViewSet CREATE ERROR] Cliente con ID {cliente_id_req} no encontrado.") #DEBUG
                return Response({'cliente': ['Cliente existente no encontrado.']}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # print("[PresenciaViewSet CREATE ERROR] No se proporcionó cliente existente ni datos para nuevo cliente.") #DEBUG
            return Response({'detail': 'Debe proporcionar un cliente existente o datos para uno nuevo para la presencia.'}, status=status.HTTP_400_BAD_REQUEST)

        presencia_data = request.data.copy()
        if cliente_instance: presencia_data['cliente'] = cliente_instance.pk
        if 'nuevo_cliente_data' in presencia_data: del presencia_data['nuevo_cliente_data'] 
        
        # print("[PresenciaViewSet CREATE] Data para PresenciaSerializer:", presencia_data) #DEBUG
        serializer = self.get_serializer(data=presencia_data)
        
        if serializer.is_valid():
            # print("[PresenciaViewSet CREATE] PresenciaSerializer válido. Intentando guardar...") #DEBUG
            try:
                instancia_guardada = serializer.save()
                # print(f"[PresenciaViewSet CREATE ÉXITO] Presencia guardada ID: {instancia_guardada.id_presencia}, Cliente ID: {instancia_guardada.cliente.id_cliente if instancia_guardada.cliente else 'N/A'}") #DEBUG
                headers = self.get_success_headers(serializer.data)
                return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
            except Exception as e:
                # print(f"[PresenciaViewSet CREATE ERROR AL GUARDAR] Excepción durante serializer.save(): {str(e)}") #DEBUG
                # traceback.print_exc() #DEBUG
                return Response({"detail": f"Error interno al guardar la presencia: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            # print("[PresenciaViewSet CREATE ERROR] PresenciaSerializer inválido:", serializer.errors) #DEBUG
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
        # cuota_instance = serializer.instance # DEBUG
        updated_instance = serializer.save()
        updated_instance.actualizar_estado(save_instance=True)


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
            # print(f"Dashboard Request Query Params: {request.query_params}") # DEBUG

            raw_start_date = request.query_params.get('startDate')
            raw_end_date = request.query_params.get('endDate')
            parsed_start_date = parse_date(raw_start_date) if raw_start_date else None
            parsed_end_date = parse_date(raw_end_date) if raw_end_date else None

            filters = {
                'startDate': parsed_start_date,
                'endDate': parsed_end_date,
                'asesorId': request.query_params.get('asesorId'),
                'tipoVenta': request.query_params.get('tipoVenta'),
                'tipoAsesor': request.query_params.get('tipoAsesor'), 
                'medio_captacion': request.query_params.get('medio_captacion'),
                'status_venta': request.query_params.get('status_venta'),
            }

            if filters['endDate'] is not None:
                filters['endDate'] = datetime.combine(filters['endDate'], datetime.max.time()).date()

            # Inicializar QuerySets base
            pagos_filtrados = RegistroPago.objects.all()
            presencias_filtradas = Presencia.objects.all()
            ventas_filtradas = Venta.objects.all()

            # Aplicar filtros de fecha
            if filters.get('startDate'):
                pagos_filtrados = pagos_filtrados.filter(fecha_pago__gte=filters['startDate'])
                presencias_filtradas = presencias_filtradas.filter(fecha_hora_presencia__date__gte=filters['startDate'])
                ventas_filtradas = ventas_filtradas.filter(fecha_venta__gte=filters['startDate'])
            
            if filters.get('endDate'):
                pagos_filtrados = pagos_filtrados.filter(fecha_pago__lte=filters['endDate'])
                presencias_filtradas = presencias_filtradas.filter(fecha_hora_presencia__date__lte=filters['endDate'])
                ventas_filtradas = ventas_filtradas.filter(fecha_venta__lte=filters['endDate'])
            
            # --- INICIO: APLICAR OTROS FILTROS A LOS QUERYSETS PRINCIPALES ---
            if filters.get('asesorId'):
                ventas_filtradas = ventas_filtradas.filter(vendedor_principal_id=filters['asesorId'])
                presencias_filtradas = presencias_filtradas.filter(
                    Q(asesor_captacion_opc_id=filters['asesorId']) | 
                    Q(asesor_call_agenda_id=filters['asesorId']) | 
                    Q(asesor_liner_id=filters['asesorId']) | 
                    Q(asesor_closer_id=filters['asesorId'])
                ).distinct()
                pagos_filtrados = pagos_filtrados.filter(venta__vendedor_principal_id=filters['asesorId'])

            if filters.get('tipoVenta'):
                ventas_filtradas = ventas_filtradas.filter(tipo_venta=filters['tipoVenta'])
                pagos_filtrados = pagos_filtrados.filter(venta__tipo_venta=filters['tipoVenta'])

            if filters.get('medio_captacion'):
                ventas_filtradas = ventas_filtradas.filter(presencia_que_origino__medio_captacion=filters['medio_captacion'])
                presencias_filtradas = presencias_filtradas.filter(medio_captacion=filters['medio_captacion'])
                pagos_filtrados = pagos_filtrados.filter(venta__presencia_que_origino__medio_captacion=filters['medio_captacion'])
            
            if filters.get('status_venta'):
                ventas_filtradas = ventas_filtradas.filter(status_venta=filters['status_venta'])
                pagos_filtrados = pagos_filtrados.filter(venta__status_venta=filters['status_venta'])
            # --- FIN: APLICAR OTROS FILTROS ---

            # --- KPIs ---
            kpi_monto_total_recaudo = pagos_filtrados.aggregate(
                total=Coalesce(Sum('monto_pago', output_field=DecimalField()), Value(Decimal('0.0')), output_field=DecimalField())
            )['total']
            
            kpi_n_presencias_realizadas = presencias_filtradas.filter(status_presencia=Presencia.STATUS_PRESENCIA_REALIZADA).count()
            
            # Ventas para tasa de conversión: solo las que son "Procesable" o "Completada"
            kpi_n_ventas_para_conversion = ventas_filtradas.filter(
                status_venta__in=[Venta.STATUS_VENTA_PROCESABLE, Venta.STATUS_VENTA_COMPLETADA]
            ).count()
            
            kpi_tasa_conversion = (kpi_n_ventas_para_conversion / kpi_n_presencias_realizadas * 100) if kpi_n_presencias_realizadas > 0 else Decimal('0.0')
            
            kpi_n_ventas_solo_procesables = ventas_filtradas.filter(status_venta=Venta.STATUS_VENTA_PROCESABLE).count()

            kpi_lotes_disponibles = Lote.objects.filter(estado_lote='Disponible').count() # Global
            kpi_lotes_vendidos = Lote.objects.filter(estado_lote='Vendido').count() # Global

            tarjetas_data = {
                "montoTotalRecaudo": kpi_monto_total_recaudo,
                "nPresenciasRealizadas": kpi_n_presencias_realizadas,
                "tasaConversionVentas": kpi_tasa_conversion,
                "nVentasProcesables": kpi_n_ventas_solo_procesables,
                "lotesDisponibles": kpi_lotes_disponibles,
                "lotesVendidos": kpi_lotes_vendidos,
            }
            # print(f"KPIs calculados: {tarjetas_data}") # DEBUG

            # --- Gráficos ---
            # 1. Histórico Ventas vs Presencias (SIN FILTROS de dashboard)
            ventas_historico_q = Venta.objects.annotate(mes=TruncMonth('fecha_venta')).values('mes').annotate(cantidad=Count('id_venta')).order_by('mes')
            presencias_historico_q = Presencia.objects.annotate(mes=TruncMonth('fecha_hora_presencia__date')).values('mes').annotate(cantidad=Count('id_presencia')).order_by('mes')
            
            historico_combinado = {}
            for v_hist in ventas_historico_q:
                if v_hist['mes']: historico_combinado.setdefault(v_hist['mes'].strftime('%Y-%m'), {'ventas': 0, 'presencias': 0})['ventas'] = v_hist['cantidad']
            for p_hist in presencias_historico_q:
                if p_hist['mes']: historico_combinado.setdefault(p_hist['mes'].strftime('%Y-%m'), {'ventas': 0, 'presencias': 0})['presencias'] = p_hist['cantidad']
            
            grafico_historico_ventas_presencias = [['Mes', 'Ventas', 'Presencias']]
            for mes_str, data_hist in sorted(historico_combinado.items()):
                grafico_historico_ventas_presencias.append([mes_str, data_hist.get('ventas', 0), data_hist.get('presencias', 0)])
            if len(grafico_historico_ventas_presencias) == 1: grafico_historico_ventas_presencias.append(['Sin datos', 0, 0])

            # 2. Estado de Ventas (Doughnut) - USA ventas_filtradas
            ventas_por_estado_q = ventas_filtradas.values('status_venta').annotate(cantidad=Count('id_venta')).order_by('status_venta')
            grafico_estado_ventas = [['Estado', 'Cantidad']]
            status_display_map = dict(Venta.STATUS_VENTA_CHOICES)
            for item_estado in ventas_por_estado_q:
                display_name = status_display_map.get(item_estado['status_venta'], item_estado['status_venta'])
                grafico_estado_ventas.append([display_name, item_estado['cantidad']])
            if len(grafico_estado_ventas) == 1: grafico_estado_ventas.append(['Sin datos', 0])

            # 3. Embudo de Ventas - USA presencias_filtradas y ventas_filtradas
            embudo_nivel1_total_presencias = presencias_filtradas.count()
            embudo_nivel2_presencias_realizadas = presencias_filtradas.filter(status_presencia='realizada').count()
            embudo_nivel3_ventas_procesables = ventas_filtradas.filter(status_venta='procesable').count()

            grafico_embudo_ventas = [['Etapa', 'Cantidad', {'role': 'tooltip', 'type': 'string', 'p': {'html': True}}]]
            if embudo_nivel1_total_presencias >= 0: 
                perc_realizadas = (embudo_nivel2_presencias_realizadas / embudo_nivel1_total_presencias * 100) if embudo_nivel1_total_presencias > 0 else 0
                perc_ventas_procesables_sobre_total_pres = (embudo_nivel3_ventas_procesables / embudo_nivel1_total_presencias * 100) if embudo_nivel1_total_presencias > 0 else 0
                perc_ventas_procesables_sobre_realizadas = (embudo_nivel3_ventas_procesables / embudo_nivel2_presencias_realizadas * 100) if embudo_nivel2_presencias_realizadas > 0 else 0
                
                grafico_embudo_ventas.extend([
                    ['Presencias Totales', embudo_nivel1_total_presencias, f"Presencias Totales: {embudo_nivel1_total_presencias} (100%)"],
                    ['Presencias Realizadas', embudo_nivel2_presencias_realizadas, f"Presencias Realizadas: {embudo_nivel2_presencias_realizadas} ({perc_realizadas:.1f}% de Totales)"],
                    ['Ventas Procesables', embudo_nivel3_ventas_procesables, f"Ventas Procesables: {embudo_nivel3_ventas_procesables} ({perc_ventas_procesables_sobre_realizadas:.1f}% de Realizadas, {perc_ventas_procesables_sobre_total_pres:.1f}% de Totales)"]
                ])
            # No añadir explícitamente "Sin datos" para el embudo si los niveles son 0.

            # 4. Disponibilidad de Lotes por Proyecto (Tabla Detallada) - NO FILTRADO por dashboard filters
            proyectos_definidos = ["OASIS 1 (HUACHO 1)", "OASIS 2 (AUCALLAMA)", "OASIS 3 (HUACHO 2)"]
            tabla_disponibilidad_lotes_data = []

            for proyecto_nombre in proyectos_definidos:
                lotes_del_proyecto = Lote.objects.filter(ubicacion_proyecto=proyecto_nombre)
                total_lotes = lotes_del_proyecto.count()
                
                disponibles_count = lotes_del_proyecto.filter(estado_lote=Lote.ESTADO_LOTE_CHOICES[0][0]).count() # 'Disponible'
                reservados_count = lotes_del_proyecto.filter(estado_lote=Lote.ESTADO_LOTE_CHOICES[1][0]).count()  # 'Reservado'
                vendidos_count = lotes_del_proyecto.filter(estado_lote=Lote.ESTADO_LOTE_CHOICES[2][0]).count()    # 'Vendido'
                
                tabla_disponibilidad_lotes_data.append({
                    "proyecto": proyecto_nombre,
                    "total_lotes": total_lotes,
                    "disponibles_cantidad": disponibles_count,
                    "reservados_cantidad": reservados_count,
                    "vendidos_cantidad": vendidos_count,
                })

            # 5. Ranking Asesores (Matriz/Tabla) - USA ventas_filtradas y filtro tipoAsesor
            ranking_asesores_q_base = ventas_filtradas
            if filters.get('tipoAsesor'):
                ranking_asesores_q_base = ranking_asesores_q_base.filter(vendedor_principal__tipo_asesor_actual=filters['tipoAsesor'])
            
            ranking_data_raw = ranking_asesores_q_base.values(
                'vendedor_principal__nombre_asesor', 
                'vendedor_principal__tipo_asesor_actual', 
                'status_venta'
            ).annotate(cantidad=Count('id_venta')).order_by(
                'vendedor_principal__tipo_asesor_actual', 
                'vendedor_principal__nombre_asesor'
            )

            grafico_ranking_asesores_pivot = {}
            estados_venta_orden_claves = [Venta.STATUS_VENTA_SEPARACION, Venta.STATUS_VENTA_PROCESABLE, Venta.STATUS_VENTA_ANULADO, Venta.STATUS_VENTA_COMPLETADA]
            estados_venta_orden_display = [dict(Venta.STATUS_VENTA_CHOICES).get(s,s).capitalize() for s in estados_venta_orden_claves]

            for item_rank in ranking_data_raw:
                asesor_nombre = item_rank['vendedor_principal__nombre_asesor']
                asesor_tipo = item_rank['vendedor_principal__tipo_asesor_actual']
                if asesor_nombre not in grafico_ranking_asesores_pivot:
                    grafico_ranking_asesores_pivot[asesor_nombre] = {'tipo': asesor_tipo}
                    for estado_clave in estados_venta_orden_claves:
                        grafico_ranking_asesores_pivot[asesor_nombre][estado_clave] = 0
                
                if item_rank['status_venta'] in estados_venta_orden_claves:
                     grafico_ranking_asesores_pivot[asesor_nombre][item_rank['status_venta']] = item_rank['cantidad']
            
            grafico_ranking_asesores = [['Asesor', 'Tipo'] + estados_venta_orden_display]
            for asesor_nombre_rank, data_rank in sorted(grafico_ranking_asesores_pivot.items(), key=lambda x: (x[1].get('tipo', ''), x[0])):
                 fila = [asesor_nombre_rank, data_rank.get('tipo','N/A')]
                 for estado_clave_rank in estados_venta_orden_claves:
                     fila.append(data_rank.get(estado_clave_rank,0))
                 grafico_ranking_asesores.append(fila)
            if len(grafico_ranking_asesores) == 1: grafico_ranking_asesores.append(['Sin datos', '-', 0, 0, 0, 0])

            # 6. Recaudo por Medio de Captación (Bar) - USA pagos_filtrados
            recaudo_por_medio_q = pagos_filtrados.filter(venta__presencia_que_origino__isnull=False).values(
                'venta__presencia_que_origino__medio_captacion'
            ).annotate(
                total_recaudado=Coalesce(Sum('monto_pago', output_field=DecimalField()), Value(Decimal('0.0')), output_field=DecimalField())
            ).order_by('-total_recaudado')

            grafico_recaudo_medio_captacion = [['Medio de Captación', 'Recaudo Total (S/.)']]
            medio_display_map = dict(Presencia.MEDIO_CAPTACION_CHOICES)
            for item_medio in recaudo_por_medio_q:
                medio_clave = item_medio['venta__presencia_que_origino__medio_captacion']
                display_name_medio = medio_display_map.get(medio_clave, medio_clave if medio_clave else "Desconocido")
                grafico_recaudo_medio_captacion.append([display_name_medio, float(item_medio['total_recaudado'])])
            if len(grafico_recaudo_medio_captacion) == 1: grafico_recaudo_medio_captacion.append(['Sin datos', 0.0])
            # --- FIN LÓGICA DE GRÁFICOS ---
            
            response_data = {
                "success": True, 
                "message": "Datos del dashboard cargados correctamente.", 
                "tarjetas": tarjetas_data,
                "graficos": {
                    "historicoVentasPresencias": grafico_historico_ventas_presencias,
                    "estadoVentas": grafico_estado_ventas,
                    "embudoVentas": grafico_embudo_ventas,
                    "tablaDisponibilidadLotes": tabla_disponibilidad_lotes_data, # Cambio de clave
                    "rankingAsesores": grafico_ranking_asesores,
                    "recaudoPorMedioCaptacion": grafico_recaudo_medio_captacion,
                }
            }
            return Response(response_data)
        except Exception as e:
            # import traceback 
            # traceback.print_exc() 
            print(f"ERROR en GetDashboardDataAPIView: {str(e)}") 
            
            fallback_grafico_simple = [['Error', 'Valor'], ['Error', 0]]
            fallback_grafico_historico = [['Mes', 'Ventas', 'Presencias'], ['Error', 0, 0]]
            fallback_grafico_ranking = [['Asesor', 'Tipo', 'Separación', 'Procesable', 'Anulada', 'Completada'], ['Error', '-', 0,0,0,0]]
            fallback_grafico_embudo = [['Etapa', 'Cantidad', {'role': 'tooltip', 'type': 'string', 'p': {'html': True}}], ['Error', 0, 'Error al cargar']]
            fallback_tabla_disponibilidad = [] # Para la tabla, un array vacío es un buen fallback


            return Response({
                "success": False, 
                "message": f"Error al procesar los datos del dashboard: Ocurrió un error inesperado. Detalle: {str(e)}", 
                "tarjetas": { "montoTotalRecaudo": 0, "nPresenciasRealizadas": 0, "tasaConversionVentas": 0, "nVentasProcesables": 0, "lotesDisponibles": 0, "lotesVendidos": 0,},
                "graficos": { 
                    "historicoVentasPresencias": fallback_grafico_historico,
                    "estadoVentas": fallback_grafico_simple,
                    "embudoVentas": fallback_grafico_embudo,
                    "tablaDisponibilidadLotes": fallback_tabla_disponibilidad, # Cambio de clave
                    "rankingAsesores": fallback_grafico_ranking,
                    "recaudoPorMedioCaptacion": fallback_grafico_simple,
                }
            }, status=500)


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
            # print(f"Error en GetCommissionSummaryDataAPIView: {str(e)}"); import traceback; traceback.print_exc() # DEBUG
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
                "porcentaje_comision_default": None 
            }, status=status.HTTP_404_NOT_FOUND)


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

class WebhookPresenciaCRMAPIView(APIView):
    """
    Endpoint para recibir notificaciones de presencias realizadas desde el CRM.
    Seguridad: requiere header 'X-CRM-Webhook-Token'.
    Formato esperado (JSON):
    {
        "id_presencia_crm": "string", // ID único de la presencia en el CRM
        "cliente": { ... }, // datos mínimos del cliente (ver ClienteCreateSerializer)
        "fecha_hora_presencia": "YYYY-MM-DDTHH:MM:SS",
        "proyecto_interes": "string",
        "lote_interes_inicial": "id_lote" (opcional),
        "asesor_captacion_opc": "id_asesor" (opcional),
        "medio_captacion": "string",
        "modalidad": "presencial|virtual",
        "status_presencia": "realizada",
        "resultado_interaccion": "string" (opcional),
        "observaciones": "string" (opcional),
        "venta": { // si hubo venta directa tras la presencia
            "fecha_venta": "YYYY-MM-DD",
            "lote": "id_lote",
            "tipo_venta": "contado|credito",
            "plazo_meses_credito": 0|12|24|36,
            "vendedor_principal": "id_asesor",
            "valor_lote_venta": "decimal",
            "cuota_inicial_requerida": "decimal",
            "participacion_junior_venta": "string" (opcional),
            "id_socio_participante": "id_asesor" (opcional),
            "participacion_socio_venta": "string" (opcional),
            "modalidad_presentacion": "string" (opcional),
            "notas": "string" (opcional)
        }
    }
    """
    permission_classes = [AllowAny]  # El control es por token, no por usuario autenticado

    def post(self, request, *args, **kwargs):
        from .serializers import PresenciaSerializer, VentaSerializer, ClienteCreateSerializer
        from .models import Presencia, Venta, Cliente, Lote, Asesor
        import datetime
        import pytz

        # --- Seguridad básica por token ---
        expected_token = getattr(settings, 'CRM_WEBHOOK_TOKEN', None)
        received_token = request.headers.get('X-CRM-Webhook-Token')
        if not expected_token or received_token != expected_token:
            return Response({'detail': 'Token de autenticación inválido.'}, status=401)

        data = request.data
        # --- Cliente ---
        cliente_data = data.get('cliente')
        if not cliente_data:
            return Response({'detail': 'Falta información de cliente.'}, status=400)
        cliente_serializer = ClienteCreateSerializer(data=cliente_data)
        if not cliente_serializer.is_valid():
            return Response({'detail': 'Datos de cliente inválidos.', 'errors': cliente_serializer.errors}, status=400)
        numero_documento = cliente_data.get('numero_documento')
        cliente_obj = Cliente.objects.filter(numero_documento=numero_documento).first()
        if not cliente_obj:
            cliente_obj = cliente_serializer.save()

        # --- Buscar o crear Presencia ---
        id_presencia_crm = data.get('id_presencia_crm')
        presencia_obj = None
        if id_presencia_crm:
            presencia_obj = Presencia.objects.filter(observaciones__icontains=f"CRM:{id_presencia_crm}").first()
        if not presencia_obj:
            presencia_fields = {
                'cliente': cliente_obj,
                'fecha_hora_presencia': data.get('fecha_hora_presencia', datetime.datetime.now(pytz.UTC)),
                'proyecto_interes': data.get('proyecto_interes', ''),
                'modalidad': data.get('modalidad', 'presencial'),
                'status_presencia': data.get('status_presencia', 'realizada'),
                'medio_captacion': data.get('medio_captacion', ''),
                'observaciones': (data.get('observaciones', '') or '') + (f" [CRM:{id_presencia_crm}]" if id_presencia_crm else ''),
            }
            # Relacionales opcionales
            lote_id = data.get('lote_interes_inicial')
            if lote_id:
                lote_obj = Lote.objects.filter(id_lote=lote_id).first()
                if lote_obj:
                    presencia_fields['lote_interes_inicial'] = lote_obj
            for asesor_field in ['asesor_captacion_opc']:
                asesor_id = data.get(asesor_field)
                if asesor_id:
                    asesor_obj = Asesor.objects.filter(id_asesor=asesor_id).first()
                    if asesor_obj:
                        presencia_fields[asesor_field] = asesor_obj
            resultado_interaccion = data.get('resultado_interaccion')
            if resultado_interaccion:
                presencia_fields['resultado_interaccion'] = resultado_interaccion
            presencia_obj = Presencia.objects.create(**presencia_fields)

        # --- Si hay venta, crear y vincular ---
        venta_data = data.get('venta')
        venta_obj = None
        if venta_data:
            venta_data['cliente'] = cliente_obj.pk
            venta_data['presencia_que_origino'] = presencia_obj.pk
            venta_serializer = VentaSerializer(data=venta_data)
            if venta_serializer.is_valid():
                venta_obj = venta_serializer.save()
                presencia_obj.venta_asociada = venta_obj
                presencia_obj.save()
            else:
                return Response({'detail': 'Datos de venta inválidos.', 'errors': venta_serializer.errors}, status=400)
        return Response({'detail': 'Presencia y vinculación procesadas correctamente.', 'id_presencia': presencia_obj.id_presencia, 'id_venta': venta_obj.id_venta if venta_obj else None})