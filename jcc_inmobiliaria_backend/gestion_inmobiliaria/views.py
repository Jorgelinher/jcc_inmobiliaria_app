# gestion_inmobiliaria/views.py
from django.contrib.auth import login as django_login, logout as django_logout, authenticate
from django.middleware.csrf import get_token as get_csrf_token_value
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from django.utils.dateparse import parse_date
from django.db.models import Sum, Count, Value, DecimalField, Q, Case, When, IntegerField, F, ExpressionWrapper
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
from django.shortcuts import render
from rest_framework import viewsets, status, filters
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import fields
from django.db.models.deletion import ProtectedError

from .models import (
    Lote, Cliente, Asesor, Venta, ActividadDiaria,
    DefinicionMetaComision, TablaComisionDirecta, RegistroPago,
    Presencia, PlanPagoVenta, CuotaPlanPago, ComisionVentaAsesor, GestionCobranza,
    CierreComisionMensual, DetalleComisionCerrada
)
from collections import defaultdict

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions, viewsets
from django_filters.rest_framework import DjangoFilterBackend

from .serializers import (
    LoteSerializer, ClienteSerializer, AsesorSerializer, VentaSerializer, ActividadDiariaSerializer,
    RegistroPagoSerializer, PresenciaSerializer, TablaComisionDirectaSerializer,
    ClienteCreateSerializer,
    PlanPagoVentaSerializer, CuotaPlanPagoSerializer, ComisionVentaAsesorSerializer,
    GestionCobranzaSerializer, CierreComisionMensualSerializer
)
from .filters import (
    LoteFilter, ClienteFilter, AsesorFilter, VentaFilter, ActividadDiariaFilter,
    PresenciaFilter
)

# Clase de paginación personalizada que permite cambiar el tamaño de página
class CustomPageNumberPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

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
        return Response({'success': False, 'error': 'Credenciales inválidas.'}, status=status.HTTP_401_UNAUTHORIZED)

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
    serializer_class = LoteSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_class = LoteFilter
    pagination_class = CustomPageNumberPagination

    @action(detail=False, methods=['get'], url_path='ubicaciones_proyecto')
    def ubicaciones_proyecto(self, request):
        """
        Devuelve la lista única de ubicaciones de proyecto (para el filtro de lotes).
        """
        ubicaciones = Lote.objects.values_list('ubicacion_proyecto', flat=True).distinct().order_by('ubicacion_proyecto')
        return Response({
            'ubicaciones_proyecto': list(ubicaciones)
        })

    @action(detail=False, methods=['post'], url_path='limpiar-duplicados')
    def limpiar_duplicados(self, request):
        """
        Limpia lotes duplicados desde el ViewSet de Lotes (ya autenticado).
        """
        from django.views.decorators.csrf import csrf_exempt
        from django.utils.decorators import method_decorator
        
        # Eximir de CSRF para esta acción específica
        @method_decorator(csrf_exempt, name='dispatch')
        class TempView:
            pass
        try:
            print('=== INICIANDO LIMPIEZA DE LOTES DUPLICADOS ===')
            
            # Agrupar lotes por combinación única
            lotes_por_clave = defaultdict(list)
            for lote in Lote.objects.all():
                clave = (lote.ubicacion_proyecto.strip().lower(), lote.manzana.strip() if lote.manzana else '', lote.numero_lote.strip() if lote.numero_lote else '', lote.etapa)
                lotes_por_clave[clave].append(lote)
            
            total_duplicados = 0
            eliminados = 0
            detalles_eliminados = []
            
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
                            detalles_eliminados.append(f"No se eliminó {lote.id_lote} porque tiene ventas asociadas.")
                            continue
                        
                        detalles_eliminados.append(f"Eliminado: {lote.id_lote} ({lote.ubicacion_proyecto} Mz:{lote.manzana} Lt:{lote.numero_lote} Etapa:{lote.etapa})")
                        lote.delete()
                        eliminados += 1
            
            total_lotes_final = Lote.objects.count()
            
            return Response({
                'success': True,
                'message': 'Limpieza de lotes duplicados completada',
                'total_duplicados_detectados': total_duplicados,
                'total_eliminados': eliminados,
                'total_lotes_final': total_lotes_final,
                'detalles': detalles_eliminados[:50]  # Limitar a 50 detalles para no sobrecargar la respuesta
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': f'Error durante la limpieza: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
    pagination_class = CustomPageNumberPagination

    @action(detail=False, methods=['get'])
    def search(self, request):
        """
        Búsqueda de asesores para autocompletado sin paginación.
        Permite buscar por nombre, ID o tipo de asesor.
        """
        try:
            search = request.query_params.get('search', '')
            if not search or len(search) < 2:
                return Response({'results': [], 'count': 0})
            
            # Buscar en nombre, ID y tipo de asesor
            asesores = Asesor.objects.filter(
                Q(nombre_asesor__icontains=search) |
                Q(id_asesor__icontains=search) |
                Q(tipo_asesor_actual__icontains=search)
            ).order_by('nombre_asesor')
            
            # Limitar a 50 resultados para evitar sobrecarga
            asesores = asesores[:50]
            
            # Serializar con formato para autocompletado
            data = []
            for asesor in asesores:
                data.append({
                    'id_asesor': asesor.id_asesor,
                    'nombre_asesor': asesor.nombre_asesor,
                    'tipo_asesor_actual': asesor.tipo_asesor_actual,
                    'display_text': f"{asesor.nombre_asesor} ({asesor.id_asesor}) - {asesor.tipo_asesor_actual}"
                })
            
            return Response({
                'results': data,
                'count': len(data)
            })
            
        except Exception as e:
            return Response(
                {'error': f'Error en búsqueda de asesores: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class ActividadDiariaViewSet(viewsets.ModelViewSet):
    queryset = ActividadDiaria.objects.all().order_by('-fecha_actividad', 'asesor')
    serializer_class = ActividadDiariaSerializer; permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]; filterset_class = ActividadDiariaFilter

class RegistroPagoViewSet(viewsets.ModelViewSet):
    queryset = RegistroPago.objects.all().select_related('venta', 'cuota_plan_pago_cubierta').order_by('-fecha_pago')
    serializer_class = RegistroPagoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

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
    pagination_class = CustomPageNumberPagination
    
    def _crear_o_actualizar_plan_pago(self, venta_instance):
        # print(f"[VentaViewSet] Iniciando _crear_o_actualizar_plan_pago para Venta ID: {venta_instance.id_venta}") # DEBUG
        PlanPagoVenta.objects.filter(venta=venta_instance).delete() 
        # print(f"[VentaViewSet] Plan de pago existente (si lo hubo) eliminado para Venta ID: {venta_instance.id_venta}") #DEBUG

        if venta_instance.tipo_venta == Venta.TIPO_VENTA_CREDITO and venta_instance.plazo_meses_credito and venta_instance.plazo_meses_credito > 0:
            proyecto = venta_instance.lote.ubicacion_proyecto.strip().lower() if venta_instance.lote and venta_instance.lote.ubicacion_proyecto else ''
            es_dolares = ('aucallama' in proyecto) or ('oasis 2' in proyecto)
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
                if es_dolares:
                    cuotas_a_crear.append(
                        CuotaPlanPago(
                            plan_pago_venta=plan_pago,
                            numero_cuota=i,
                            fecha_vencimiento=fecha_vencimiento_cuota,
                            monto_programado=Decimal('0.00'),
                            monto_programado_dolares=monto_esta_cuota
                        )
                    )
                else:
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

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def revertir_firma_contrato(self, request, pk=None):
        venta = self.get_object()
        
        if venta.status_venta != Venta.STATUS_VENTA_PROCESABLE:
            return Response(
                {"error": "Solo se puede revertir la firma en ventas que estén en estado 'Procesable'."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not venta.cliente_firmo_contrato:
            return Response(
                {"message": "El contrato no está marcado como firmado."},
                status=status.HTTP_200_OK
            )

        # Revertir la firma del contrato
        venta.cliente_firmo_contrato = False
        venta.fecha_firma_contrato = None
        venta.save(update_fields=['cliente_firmo_contrato', 'fecha_firma_contrato'])
        
        serializer = self.get_serializer(venta)
        return Response(serializer.data)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        print("[VentaViewSet CREATE INICIO] Data recibida:", request.data) # DEBUG
        try:
            nuevo_cliente_data_req = request.data.get('nuevo_cliente_data')
            cliente_id_req = request.data.get('cliente')
            cliente_instance = None
            
            if nuevo_cliente_data_req:
                cliente_create_serializer = ClienteCreateSerializer(data=nuevo_cliente_data_req)
                if cliente_create_serializer.is_valid():
                    numero_documento = nuevo_cliente_data_req.get('numero_documento')
                    cliente_existente = Cliente.objects.filter(numero_documento=numero_documento).first()
                    if cliente_existente: 
                        cliente_instance = cliente_existente
                    else: 
                        cliente_instance = cliente_create_serializer.save()
                else: 
                    print("[VentaViewSet CREATE ERROR] ClienteCreateSerializer inválido:", cliente_create_serializer.errors) # DEBUG
                    return Response(cliente_create_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            elif cliente_id_req:
                try: 
                    cliente_instance = Cliente.objects.get(pk=cliente_id_req)
                except Cliente.DoesNotExist: 
                    print(f"[VentaViewSet CREATE ERROR] Cliente ID {cliente_id_req} no encontrado.") # DEBUG
                    return Response({'cliente': ['Cliente existente no encontrado.']}, status=status.HTTP_400_BAD_REQUEST)
            else: 
                print("[VentaViewSet CREATE ERROR] No se proveyó cliente ni datos de nuevo cliente.") # DEBUG
                return Response({'detail': 'Debe proporcionar un cliente existente o datos para uno nuevo.'}, status=status.HTTP_400_BAD_REQUEST)

            venta_data = request.data.copy()
            if cliente_instance: 
                venta_data['cliente'] = cliente_instance.pk
            if 'nuevo_cliente_data' in venta_data: 
                del venta_data['nuevo_cliente_data']
            if 'comisiones_asesores' in venta_data:
                del venta_data['comisiones_asesores']
            
            print("[VentaViewSet CREATE] Data para VentaSerializer:", venta_data) #DEBUG
            serializer = self.get_serializer(data=venta_data)
            
            if not serializer.is_valid():
                print("[VentaViewSet CREATE ERROR] VentaSerializer inválido:", serializer.errors) #DEBUG
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            venta_instance = serializer.save() 
            print(f"[VentaViewSet CREATE] Venta guardada ID: {venta_instance.id_venta}, Valor: {venta_instance.valor_lote_venta}") #DEBUG
            
            self._crear_o_actualizar_plan_pago(venta_instance)
            
            # --- GESTIÓN DE COMISIONES RELACIONALES ---
            ComisionVentaAsesor.objects.filter(venta=venta_instance).delete()
            comisiones_asesores = request.data.get('comisiones_asesores', [])
            for c in comisiones_asesores:
                if not c.get('asesor') or not c.get('rol'):
                    continue
                porcentaje = c.get('porcentaje_comision')
                if porcentaje in [None, '']:
                    porcentaje = 0
                try:
                    asesor_obj = Asesor.objects.get(pk=c['asesor'])
                except Asesor.DoesNotExist:
                    continue
                monto = venta_instance.valor_lote_venta * (Decimal(str(porcentaje)) / Decimal('100.00'))
                ComisionVentaAsesor.objects.create(
                    venta=venta_instance,
                    asesor=asesor_obj,
                    rol=c['rol'],
                    porcentaje_comision=Decimal(str(porcentaje)),
                    monto_comision_calculado=monto,
                    notas=c.get('notas', '')
                )
            
            venta_instance.refresh_from_db() 
            response_serializer = self.get_serializer(venta_instance) 
            headers = self.get_success_headers(response_serializer.data)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED, headers=headers)
            
        except Exception as e:
            print(f"[VentaViewSet CREATE ERROR] Excepción no manejada: {str(e)}")
            print(f"[VentaViewSet CREATE ERROR] Traceback: {traceback.format_exc()}")
            return Response({"detail": f"Error interno al crear la venta: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        # print(f"[VentaViewSet UPDATE INICIO] ID: {kwargs.get('pk')}, Data recibida:", request.data) #DEBUG
        partial = kwargs.pop('partial', False)
        instance = self.get_object() 

        venta_data = request.data.copy()
        if 'nuevo_cliente_data' in venta_data: 
            del venta_data['nuevo_cliente_data']
        if 'comisiones_asesores' in venta_data:
            del venta_data['comisiones_asesores']
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
        
        # --- GESTIÓN DE COMISIONES RELACIONALES ---
        ComisionVentaAsesor.objects.filter(venta=venta_instance).delete()
        comisiones_asesores = request.data.get('comisiones_asesores', [])
        for c in comisiones_asesores:
            if not c.get('asesor') or not c.get('rol'):
                continue
            porcentaje = c.get('porcentaje_comision')
            if porcentaje in [None, '']:
                porcentaje = 0
            try:
                asesor_obj = Asesor.objects.get(pk=c['asesor'])
            except Asesor.DoesNotExist:
                continue
            monto = venta_instance.valor_lote_venta * (Decimal(str(porcentaje)) / Decimal('100.00'))
            ComisionVentaAsesor.objects.create(
                venta=venta_instance,
                asesor=asesor_obj,
                rol=c['rol'],
                porcentaje_comision=Decimal(str(porcentaje)),
                monto_comision_calculado=monto,
                notas=c.get('notas', '')
            )
        
        venta_instance.refresh_from_db()
        response_serializer = self.get_serializer(venta_instance)
        return Response(response_serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
        except ProtectedError:
            return Response(
                {"detail": "No es posible eliminar la venta porque tiene comisiones cerradas asociadas. Consulte con el administrador si necesita realizar esta acción."},
                status=status.HTTP_409_CONFLICT
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class PresenciaViewSet(viewsets.ModelViewSet):
    queryset = Presencia.objects.all().select_related('cliente', 'lote_interes_inicial', 'asesor_captacion_opc', 'asesor_call_agenda', 'asesor_liner', 'asesor_closer', 'venta_asociada').order_by('-fecha_hora_presencia')
    serializer_class = PresenciaSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_class = PresenciaFilter
    pagination_class = CustomPageNumberPagination
    
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
            # print(f"Dashboard Request Query Params: {request.GET}") # DEBUG

            raw_start_date = request.GET.get('startDate')
            raw_end_date = request.GET.get('endDate')
            parsed_start_date = parse_date(raw_start_date) if raw_start_date else None
            parsed_end_date = parse_date(raw_end_date) if raw_end_date else None

            filters = {
                'startDate': parsed_start_date,
                'endDate': parsed_end_date,
                'asesorId': request.GET.get('asesorId'),
                'tipoVenta': request.GET.get('tipoVenta'),
                'tipoAsesor': request.GET.get('tipoAsesor'), 
                'medio_captacion': request.GET.get('medio_captacion'),
                'status_venta': request.GET.get('status_venta'),
            }

            if filters['endDate'] is not None:
                filters['endDate'] = datetime.combine(filters['endDate'], datetime.max.time()).date()

            # Inicializar QuerySets base
            pagos_filtrados = RegistroPago.objects.all()
            presencias_filtradas = Presencia.objects.all()
            ventas_filtradas = Venta.objects.all()
            # --- AJUSTE: Solo ventas existentes (no eliminadas) ---
            ventas_filtradas = ventas_filtradas.filter(id_venta__in=Venta.objects.values_list('id_venta', flat=True))

            # --- CORRECCIÓN: APLICAR FILTROS DE FECHA CORRECTAMENTE ---
            # Para recaudos: usar fecha_pago (fecha_transaccion del CSV)
            if filters.get('startDate'):
                pagos_filtrados = pagos_filtrados.filter(fecha_pago__gte=filters['startDate'])
            
            if filters.get('endDate'):
                pagos_filtrados = pagos_filtrados.filter(fecha_pago__lte=filters['endDate'])
            
            # Para presencias: usar fecha_hora_presencia y considerar solo TOUR realizadas
            if filters.get('startDate'):
                presencias_filtradas = presencias_filtradas.filter(
                    fecha_hora_presencia__date__gte=filters['startDate'],
                    tipo_tour='tour',  # Solo presencias TOUR
                    status_presencia='realizada'  # Solo realizadas
                )
            
            if filters.get('endDate'):
                presencias_filtradas = presencias_filtradas.filter(
                    fecha_hora_presencia__date__lte=filters['endDate']
                )
            
            # Para ventas: usar fecha_venta pero considerar la relación con presencias
            if filters.get('startDate'):
                ventas_filtradas = ventas_filtradas.filter(fecha_venta__gte=filters['startDate'])
            
            if filters.get('endDate'):
                ventas_filtradas = ventas_filtradas.filter(fecha_venta__lte=filters['endDate'])
            
            # --- APLICAR OTROS FILTROS A LOS QUERYSETS PRINCIPALES ---
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

            # --- KPIs CORREGIDOS ---
            # MONTO TOTAL RECAUDADO: suma de todos los recaudos según fecha_pago
            kpi_monto_total_recaudo = pagos_filtrados.aggregate(
                total=Coalesce(Sum('monto_pago', output_field=DecimalField()), Value(Decimal('0.0')), output_field=DecimalField())
            )['total']
            
            # NRO PRESENCIAS REALIZADAS: cantidad de presencias "TOUR" realizadas
            kpi_n_presencias_realizadas = presencias_filtradas.count()
            
            # VENTAS PARA TASA DE CONVERSIÓN: solo las que son "Procesable", "Anulado" y "Separación"
            kpi_n_ventas_para_conversion = ventas_filtradas.filter(
                status_venta__in=[Venta.STATUS_VENTA_PROCESABLE, Venta.STATUS_VENTA_ANULADO, Venta.STATUS_VENTA_SEPARACION]
            ).count()
            
            # TASA CONVERSIÓN VENTAS: división entre ventas y presencias TOUR realizadas
            kpi_tasa_conversion = (kpi_n_ventas_para_conversion / kpi_n_presencias_realizadas * 100) if kpi_n_presencias_realizadas > 0 else Decimal('0.0')
            
            # VENTAS PROCESABLES: cantidad de ventas en status "PROCESABLE"
            kpi_n_ventas_solo_procesables = ventas_filtradas.filter(status_venta=Venta.STATUS_VENTA_PROCESABLE).count()

            # LOTES DISPONIBLES Y VENDIDOS (global, no filtrado)
            kpi_lotes_disponibles = Lote.objects.filter(estado_lote='Disponible').count()
            kpi_lotes_vendidos = Lote.objects.filter(estado_lote='Vendido').count()

            # Debug: Imprimir información sobre los filtros aplicados
            print(f"[Dashboard Debug] Filtros aplicados: {filters}")
            print(f"[Dashboard Debug] Ventas filtradas: {ventas_filtradas.count()}")
            print(f"[Dashboard Debug] Presencias TOUR realizadas filtradas: {kpi_n_presencias_realizadas}")
            print(f"[Dashboard Debug] Pagos filtrados: {pagos_filtrados.count()}")
            print(f"[Dashboard Debug] KPIs - Recaudo: {kpi_monto_total_recaudo}, Presencias TOUR: {kpi_n_presencias_realizadas}, Ventas: {kpi_n_ventas_para_conversion}")

            tarjetas_data = {
                "montoTotalRecaudo": kpi_monto_total_recaudo,
                "nPresenciasRealizadas": kpi_n_presencias_realizadas,
                "tasaConversionVentas": kpi_tasa_conversion,
                "nVentasProcesables": kpi_n_ventas_solo_procesables,
                "lotesDisponibles": kpi_lotes_disponibles,
                "lotesVendidos": kpi_lotes_vendidos,
            }

            # --- Gráficos CORREGIDOS ---
            # 1. Histórico Ventas vs Presencias (CORREGIDO)
            # Para ventas: usar fecha_venta
            ventas_historico_q = ventas_filtradas.annotate(mes=TruncMonth('fecha_venta')).values('mes').annotate(cantidad=Count('id_venta')).order_by('mes')
            
            # Para presencias: usar fecha_hora_presencia y considerar solo TOUR realizadas
            presencias_historico_q = presencias_filtradas.annotate(mes=TruncMonth('fecha_hora_presencia__date')).values('mes').annotate(cantidad=Count('id_presencia')).order_by('mes')
            
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

            # 3. Embudo de Ventas - CORREGIDO para usar presencias TOUR realizadas
            # Nivel 1: Total de presencias TOUR realizadas (ya filtradas)
            embudo_nivel1_total_presencias = kpi_n_presencias_realizadas
            
            # Nivel 2: Presencias TOUR realizadas (mismo valor que nivel 1)
            embudo_nivel2_presencias_realizadas = kpi_n_presencias_realizadas
            
            # Nivel 3: Ventas procesables
            embudo_nivel3_ventas_procesables = kpi_n_ventas_solo_procesables

            grafico_embudo_ventas = [['Etapa', 'Cantidad', {'role': 'tooltip', 'type': 'string', 'p': {'html': True}}]]
            if embudo_nivel1_total_presencias >= 0: 
                perc_realizadas = (embudo_nivel2_presencias_realizadas / embudo_nivel1_total_presencias * 100) if embudo_nivel1_total_presencias > 0 else 0
                perc_ventas_procesables_sobre_total_pres = (embudo_nivel3_ventas_procesables / embudo_nivel1_total_presencias * 100) if embudo_nivel1_total_presencias > 0 else 0
                perc_ventas_procesables_sobre_realizadas = (embudo_nivel3_ventas_procesables / embudo_nivel2_presencias_realizadas * 100) if embudo_nivel2_presencias_realizadas > 0 else 0
                
                grafico_embudo_ventas.extend([
                    ['Presencias TOUR Realizadas', embudo_nivel1_total_presencias, f"Presencias TOUR Realizadas: {embudo_nivel1_total_presencias} (100%)"],
                    ['Presencias TOUR Realizadas', embudo_nivel2_presencias_realizadas, f"Presencias TOUR Realizadas: {embudo_nivel2_presencias_realizadas} ({perc_realizadas:.1f}% de Totales)"],
                    ['Ventas Procesables', embudo_nivel3_ventas_procesables, f"Ventas Procesables: {embudo_nivel3_ventas_procesables} ({perc_ventas_procesables_sobre_realizadas:.1f}% de Realizadas, {perc_ventas_procesables_sobre_total_pres:.1f}% de Totales)"]
                ])

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

            # 5. Ranking de Asesores por Estado de Venta (Tabla) - MEJORADA
            # Nueva lógica que considera todos los roles de asesores en el proceso de venta
            ranking_asesores_pivot = {}
            estados_venta_orden_claves = [Venta.STATUS_VENTA_SEPARACION, Venta.STATUS_VENTA_PROCESABLE, Venta.STATUS_VENTA_ANULADO, Venta.STATUS_VENTA_COMPLETADA]
            estados_venta_orden_display = [dict(Venta.STATUS_VENTA_CHOICES).get(s,s).capitalize() for s in estados_venta_orden_claves]

            # Obtener todas las ventas con sus presencias asociadas y asesores involucrados
            ventas_con_presencias = ventas_filtradas.select_related(
                'presencia_que_origino__asesor_captacion_opc',
                'presencia_que_origino__asesor_call_agenda', 
                'presencia_que_origino__asesor_liner',
                'presencia_que_origino__asesor_closer',
                'vendedor_principal'
            ).prefetch_related('comisiones_asesores__asesor')

            for venta in ventas_con_presencias:
                status_venta = venta.status_venta
                if status_venta not in estados_venta_orden_claves:
                    continue

                # Recolectar todos los asesores involucrados en esta venta
                asesores_venta = set()
                
                # 1. Asesores de la presencia (roles específicos)
                if venta.presencia_que_origino:
                    presencia = venta.presencia_que_origino
                    if presencia.asesor_captacion_opc:
                        asesores_venta.add(('captación', presencia.asesor_captacion_opc))
                    if presencia.asesor_call_agenda:
                        asesores_venta.add(('llamada', presencia.asesor_call_agenda))
                    if presencia.asesor_liner:
                        asesores_venta.add(('liner', presencia.asesor_liner))
                    if presencia.asesor_closer:
                        asesores_venta.add(('closer', presencia.asesor_closer))

                # 2. Vendedor principal (liner de la presencia)
                if venta.vendedor_principal:
                    asesores_venta.add(('vendedor_principal', venta.vendedor_principal))

                # 3. Asesores con comisiones (roles adicionales)
                for comision in venta.comisiones_asesores.all():
                    if comision.asesor:
                        asesores_venta.add((comision.rol, comision.asesor))

                # Agregar cada asesor al ranking
                for rol, asesor in asesores_venta:
                    if not asesor:
                        continue
                        
                    asesor_key = f"{asesor.nombre_asesor} ({asesor.id_asesor})"
                    rol_display = rol.replace('_', ' ').title()
                    
                    if asesor_key not in ranking_asesores_pivot:
                        ranking_asesores_pivot[asesor_key] = {
                            'tipo': asesor.tipo_asesor_actual or 'N/A',
                            'roles': set(),
                            'total_ventas': 0,
                            'ventas_detalle': set()
                        }
                        for estado_clave in estados_venta_orden_claves:
                            ranking_asesores_pivot[asesor_key][estado_clave] = 0
                    
                    # Agregar el rol a la lista de roles del asesor
                    ranking_asesores_pivot[asesor_key]['roles'].add(rol_display)
                    ranking_asesores_pivot[asesor_key]['total_ventas'] += 1
                    ranking_asesores_pivot[asesor_key][status_venta] += 1
                    # Agregar detalle de la venta
                    venta_id = venta.id_venta
                    lote_str = str(venta.lote) if venta.lote else ''
                    proyecto_str = venta.lote.ubicacion_proyecto if venta.lote and hasattr(venta.lote, 'ubicacion_proyecto') else ''
                    ranking_asesores_pivot[asesor_key]['ventas_detalle'].add(f"{venta_id} - {lote_str} ({proyecto_str})")

            # Crear la tabla final ordenada por total de ventas y luego por nombre
            grafico_ranking_asesores = [['Asesor', 'Tipo', 'Roles', 'Total Ventas', 'Ventas'] + estados_venta_orden_display]
            
            # Ordenar por total de ventas (descendente) y luego por nombre
            asesores_ordenados = sorted(
                ranking_asesores_pivot.items(), 
                key=lambda x: (-x[1]['total_ventas'], x[0])
            )
            
            for asesor_nombre_rank, data_rank in asesores_ordenados:
                roles_str = ', '.join(sorted(data_rank['roles']))
                fila = [
                    asesor_nombre_rank, 
                    data_rank.get('tipo', 'N/A'),
                    roles_str,
                    data_rank.get('total_ventas', 0),
                    '\n'.join(sorted(data_rank['ventas_detalle'])),
                ]
                for estado_clave_rank in estados_venta_orden_claves:
                    fila.append(data_rank.get(estado_clave_rank, 0))
                grafico_ranking_asesores.append(fila)
            
            if len(grafico_ranking_asesores) == 1:
                grafico_ranking_asesores.append(['Sin datos', '-', '-', 0, 0, 0, 0, 0])

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
            # --- FIN LÓGICA DE GRÁFICOS CORREGIDA ---
            
            response_data = {
                "success": True, 
                "message": "Datos del dashboard cargados correctamente.", 
                "tarjetas": tarjetas_data,
                "graficos": {
                    "historicoVentasPresencias": grafico_historico_ventas_presencias,
                    "estadoVentas": grafico_estado_ventas,
                    "embudoVentas": grafico_embudo_ventas,
                    "tablaDisponibilidadLotes": tabla_disponibilidad_lotes_data,
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
            fallback_grafico_ranking = [['Asesor', 'Tipo', 'Roles', 'Total Ventas', 'Separación', 'Procesable', 'Anulada', 'Completada'], ['Error', '-', '-', 0, 0,0,0,0]]
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
                    "tablaDisponibilidadLotes": fallback_tabla_disponibilidad,
                    "rankingAsesores": fallback_grafico_ranking,
                    "recaudoPorMedioCaptacion": fallback_grafico_simple,
                }
            }, status=500)


class GetCommissionSummaryDataAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, format=None):
        try:
            asesor_id_filter = request.query_params.get('asesor_id')
            mes_filter_str = request.query_params.get('mes'); anio_filter_str = request.query_params.get('anio')
            if not mes_filter_str or not anio_filter_str:
                return Response({"success": False, "message": "Los parámetros 'mes' y 'anio' son requeridos."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                mes = int(mes_filter_str); anio = int(anio_filter_str)
                fecha_inicio_periodo = date(anio, mes, 1)
                next_month = mes + 1 if mes < 12 else 1; next_year = anio if mes < 12 else anio + 1
                fecha_fin_periodo = date(next_year, next_month, 1) - timedelta(days=1)
            except ValueError:
                return Response({"success": False, "message": "Formato de 'mes' o 'anio' inválido."}, status=status.HTTP_400_BAD_REQUEST)

            from .models import ComisionVentaAsesor, Venta
            comisiones_qs = ComisionVentaAsesor.objects.filter(
                venta__fecha_venta__gte=fecha_inicio_periodo,
                venta__fecha_venta__lte=fecha_fin_periodo,
                venta__status_venta=Venta.STATUS_VENTA_PROCESABLE
            )
            if asesor_id_filter:
                comisiones_qs = comisiones_qs.filter(asesor__id_asesor=asesor_id_filter)

            resumen = {}
            for com in comisiones_qs.select_related('asesor', 'venta'):
                aid = com.asesor.id_asesor
                if aid not in resumen:
                    resumen[aid] = {
                        "asesor_id": aid,
                        "nombre_asesor": com.asesor.nombre_asesor,
                        "tipo_asesor": com.asesor.tipo_asesor_actual,
                        "periodo": fecha_inicio_periodo.strftime("%B %Y"),
                        "comision_total": Decimal('0.00'),
                        "detalle": []
                    }
                resumen[aid]["comision_total"] += com.monto_comision_calculado or Decimal('0.00')
                resumen[aid]["detalle"].append({
                    "venta_id": com.venta.id_venta,
                    "fecha_venta": com.venta.fecha_venta,
                    "rol": com.rol,
                    "porcentaje": com.porcentaje_comision,
                    "monto": com.monto_comision_calculado,
                    "notas": com.notas,
                })

            return Response({"success": True, "summary": list(resumen.values())})
        except Exception as e:
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

class GestionCobranzaViewSet(viewsets.ModelViewSet):
    queryset = GestionCobranza.objects.select_related('cuota', 'responsable').all()
    serializer_class = GestionCobranzaSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.OrderingFilter, filters.SearchFilter]
    search_fields = ['resultado', 'responsable__username', 'cuota__plan_pago_venta__venta__cliente__nombres_completos_razon_social']
    ordering_fields = ['fecha_gestion', 'proximo_seguimiento']
    ordering = ['-fecha_gestion']

    def get_queryset(self):
        qs = super().get_queryset()
        cuota_id = self.request.query_params.get('cuota')
        if cuota_id:
            qs = qs.filter(cuota__id_cuota=cuota_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(responsable=self.request.user)

class CuotasPendientesCobranzaViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = None  # Se define en get_serializer_class
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.OrderingFilter, filters.SearchFilter]
    ordering_fields = ['fecha_vencimiento', 'numero_cuota']
    ordering = ['fecha_vencimiento']
    # No usar paginación para obtener todas las cuotas y agrupar por venta en el frontend

    def get_queryset(self):
        hoy = timezone.now().date()
        qs = CuotaPlanPago.objects.filter(estado_cuota__in=['pendiente', 'atrasada', 'vencida_no_pagada'])
        # Filtros avanzados
        proyecto = self.request.query_params.get('proyecto')
        cliente = self.request.query_params.get('cliente')
        fecha_desde = self.request.query_params.get('fecha_desde')
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        if proyecto:
            qs = qs.filter(plan_pago_venta__venta__lote__ubicacion_proyecto__icontains=proyecto)
        if cliente:
            qs = qs.filter(plan_pago_venta__venta__cliente__nombres_completos_razon_social__icontains=cliente)
        if fecha_desde:
            qs = qs.filter(fecha_vencimiento__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha_vencimiento__lte=fecha_hasta)
        # Annotar días vencidos
        qs = qs.annotate(
            dias_vencidos=ExpressionWrapper(F('fecha_vencimiento') - hoy, output_field=fields.DurationField())
        )
        return qs

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        data = []
        print("[LOG] Iniciando procesamiento de cuotas pendientes para cobranza. Total cuotas en queryset:", qs.count())
        
        for cuota in qs:
            try:
                print(f"[LOG] Procesando cuota ID {cuota.id_cuota} | Estado: {cuota.estado_cuota}")
                gestiones = cuota.gestiones_cobranza.order_by('-fecha_gestion')
                ultima_gestion = gestiones.first()
                cliente_str = str(cuota.plan_pago_venta.venta.cliente)
                lote_str = str(cuota.plan_pago_venta.venta.lote)
                data.append({
                    'id_cuota': cuota.id_cuota,
                    'cliente': cliente_str,
                    'lote': lote_str,
                    'numero_cuota': cuota.numero_cuota,
                    'fecha_vencimiento': cuota.fecha_vencimiento,
                    'monto_programado': cuota.monto_programado,
                    'dias_vencidos': (timezone.now().date() - cuota.fecha_vencimiento).days if cuota.fecha_vencimiento < timezone.now().date() else 0,
                    'estado_cuota': cuota.estado_cuota,
                    'ultima_gestion': {
                        'fecha_gestion': ultima_gestion.fecha_gestion if ultima_gestion else None,
                        'tipo_contacto': ultima_gestion.tipo_contacto if ultima_gestion else None,
                        'resultado': ultima_gestion.resultado if ultima_gestion else None,
                    } if ultima_gestion else None,
                    'num_gestiones': gestiones.count(),
                })
            except Exception as e:
                print(f"[ERROR] Fallo procesando cuota ID {cuota.id_cuota}: {e}")
        print(f"[LOG] Total cuotas procesadas correctamente: {len(data)}")
        return Response(data)

# --- VIEWS DE CIERRE DE COMISIONES ---
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from .models import CierreComisionMensual, DetalleComisionCerrada, ComisionVentaAsesor
from .serializers import CierreComisionMensualSerializer

class CierreComisionViewSet(viewsets.ModelViewSet):
    queryset = CierreComisionMensual.objects.all()
    serializer_class = CierreComisionMensualSerializer

    def list(self, request, *args, **kwargs):
        mes = request.query_params.get('mes')
        año = request.query_params.get('año')
        qs = self.get_queryset()
        if mes and año:
            qs = qs.filter(mes=mes, año=año)
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='ejecutar-cierre')
    @transaction.atomic
    def ejecutar_cierre(self, request):
        mes = request.data.get('mes')
        año = request.data.get('año')

        if not mes or not año:
            return Response({"error": "Mes y año son requeridos."}, status=status.HTTP_400_BAD_REQUEST)

        # Validar que el período no esté ya cerrado
        if CierreComisionMensual.objects.filter(mes=mes, año=año, status__in=['CERRADO', 'PAGADO']).exists():
            return Response({"error": f"El período {mes}/{año} ya ha sido cerrado."}, status=status.HTTP_400_BAD_REQUEST)

        # Comisiones del período que no han sido cerradas
        comisiones_a_cerrar = ComisionVentaAsesor.objects.filter(
            venta__fecha_venta__month=mes,
            venta__fecha_venta__year=año,
            venta__status_venta=Venta.STATUS_VENTA_PROCESABLE,  # Solo ventas procesables
            detallecomisioncerrada__isnull=True
        )

        if not comisiones_a_cerrar.exists():
            return Response({"error": "No hay nuevas comisiones para cerrar en este período."}, status=status.HTTP_400_BAD_REQUEST)

        # Crear el registro de cierre
        cierre, created = CierreComisionMensual.objects.update_or_create(
            mes=mes, año=año,
            defaults={
                'status': 'CERRADO',
                'cerrado_por': request.user,
                'fecha_cierre': timezone.now()
            }
        )

        total_comisiones_periodo = Decimal('0.0')

        # Crear los detalles inmutables (snapshots)
        for comision in comisiones_a_cerrar:
            monto_final = comision.monto_comision_calculado
            DetalleComisionCerrada.objects.create(
                cierre=cierre,
                comision_original=comision,
                asesor_nombre=comision.asesor.nombre_asesor,
                asesor_dni=comision.asesor.dni,
                venta_id=comision.venta.id_venta,
                lote_str=str(comision.venta.lote),
                fecha_venta=comision.venta.fecha_venta,
                rol_en_venta=comision.rol,
                monto_base_calculo=comision.venta.valor_lote_venta,
                porcentaje_comision_aplicado=comision.porcentaje_comision,
                monto_comision_final=monto_final
            )
            total_comisiones_periodo += monto_final

        cierre.monto_total_comisiones = total_comisiones_periodo
        cierre.save()

        return Response(CierreComisionMensualSerializer(cierre).data, status=status.HTTP_201_CREATED)


class LimpiarLotesDuplicadosAPIView(APIView):
    """
    Endpoint para limpiar lotes duplicados en producción.
    Solo se puede ejecutar desde el navegador para evitar ejecución accidental.
    """
    permission_classes = [permissions.AllowAny]  # Permitir acceso sin autenticación temporalmente
    authentication_classes = []  # No requerir autenticación
    
    def get(self, request, format=None):
        """Endpoint de prueba para verificar que funciona"""
        return Response({
            'message': 'Endpoint funcionando correctamente',
            'method': 'GET - Solo para pruebas',
            'total_lotes': Lote.objects.count()
        })
    
    def post(self, request, format=None):
        try:
            print('=== INICIANDO LIMPIEZA DE LOTES DUPLICADOS ===')
            
            # Agrupar lotes por combinación única
            lotes_por_clave = defaultdict(list)
            for lote in Lote.objects.all():
                clave = (lote.ubicacion_proyecto.strip().lower(), lote.manzana.strip() if lote.manzana else '', lote.numero_lote.strip() if lote.numero_lote else '', lote.etapa)
                lotes_por_clave[clave].append(lote)
            
            total_duplicados = 0
            eliminados = 0
            detalles_eliminados = []
            
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
                            detalles_eliminados.append(f"No se eliminó {lote.id_lote} porque tiene ventas asociadas.")
                            continue
                        
                        detalles_eliminados.append(f"Eliminado: {lote.id_lote} ({lote.ubicacion_proyecto} Mz:{lote.manzana} Lt:{lote.numero_lote} Etapa:{lote.etapa})")
                        lote.delete()
                        eliminados += 1
            
            total_lotes_final = Lote.objects.count()
            
            return Response({
                'success': True,
                'message': 'Limpieza de lotes duplicados completada',
                'total_duplicados_detectados': total_duplicados,
                'total_eliminados': eliminados,
                'total_lotes_final': total_lotes_final,
                'detalles': detalles_eliminados[:50]  # Limitar a 50 detalles para no sobrecargar la respuesta
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': f'Error durante la limpieza: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)