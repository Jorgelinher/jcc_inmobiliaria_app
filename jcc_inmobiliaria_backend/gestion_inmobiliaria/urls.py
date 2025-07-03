# gestion_inmobiliaria/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .views import (
    GestionCobranzaViewSet, CuotasPendientesCobranzaViewSet, CierreComisionViewSet,
)

router = DefaultRouter()
router.register(r'lotes', views.LoteViewSet, basename='lote')
router.register(r'clientes', views.ClienteViewSet, basename='cliente')
router.register(r'asesores', views.AsesorViewSet, basename='asesor')
router.register(r'ventas', views.VentaViewSet, basename='venta')
router.register(r'actividades', views.ActividadDiariaViewSet, basename='actividaddiaria')
router.register(r'registropagos', views.RegistroPagoViewSet, basename='registropago')
router.register(r'presencias', views.PresenciaViewSet, basename='presencia')

# --- INICIO: RUTAS PARA NUEVOS VIEWSETS DE PLANES DE PAGO Y CUOTAS ---
router.register(r'planespago', views.PlanPagoVentaViewSet, basename='planpagoventa')
router.register(r'cuotasplanpago', views.CuotaPlanPagoViewSet, basename='cuotaplanpago')
# --- FIN: RUTAS ---

router.register(r'cobranzas/gestiones', GestionCobranzaViewSet, basename='gestioncobranza')
router.register(r'cobranzas/cuotas-pendientes', CuotasPendientesCobranzaViewSet, basename='cuotapendientecobranza')
router.register(r'cierres-comisiones', CierreComisionViewSet, basename='cierres-comisiones')

urlpatterns = [
    path('', include(router.urls)),
    path('get-advisors-list/', views.GetAdvisorsForFilterAPIView.as_view(), name='get_advisors_for_filter_api'),
    path('dashboard-data/', views.GetDashboardDataAPIView.as_view(), name='get_dashboard_data_api'),
    path('commission-summary/', views.GetCommissionSummaryDataAPIView.as_view(), name='get_commission_summary_data_api'),
    path('get-default-commission-rate/', views.GetDefaultCommissionRateAPIView.as_view(), name='get_default_commission_rate_api'),
    path('calculate-commission/', views.CalculateCommissionAPIView.as_view(), name='calculate_commission_api'),
    path('commission-structure/', views.GetCommissionStructureAPIView.as_view(), name='get_commission_structure_api'),
    path('general-configs/', views.GetGeneralConfigsAPIView.as_view(), name='get_general_configs_api'),
    path('webhook-presencia-crm/', views.WebhookPresenciaCRMAPIView.as_view(), name='webhook_presencia_crm'),
]