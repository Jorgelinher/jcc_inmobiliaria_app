# gestion_inmobiliaria/filters.py
import django_filters
from django.db.models import Q 
from .models import Lote, Cliente, Asesor, Venta, ActividadDiaria, Presencia # <--- Asegúrate de importar Presencia

class LoteFilter(django_filters.FilterSet):
    # Filtro general 'q' se mantiene, pero se puede complementar con filtros específicos
    q = django_filters.CharFilter(
        method='general_search_filter',
        label="Búsqueda General (ID Lote, Proyecto, Manzana, N° Lote, Etapa)"
    )
    
    # Filtros específicos para cada campo solicitado
    ubicacion_proyecto = django_filters.CharFilter(
        field_name='ubicacion_proyecto', 
        lookup_expr='icontains', # Búsqueda flexible (contiene, insensible a mayúsculas)
        label="Proyecto"
    )
    etapa = django_filters.NumberFilter( # Ya existía, lo mantenemos
        field_name='etapa', 
        lookup_expr='exact', 
        label="Etapa del Lote (Número exacto)"
    )
    manzana = django_filters.CharFilter(
        field_name='manzana', 
        lookup_expr='icontains',
        label="Manzana"
    )
    numero_lote = django_filters.CharFilter(
        field_name='numero_lote', 
        lookup_expr='icontains',
        label="Número de Lote"
    )
    estado_lote = django_filters.BaseInFilter(
    field_name='estado_lote', 
    lookup_expr='in',
    label="Estado del Lote (separar múltiples valores con coma para OR)"
)

    # Para búsqueda predictiva/autocompletado, a menudo se usa un endpoint dedicado
    # o se combina con la búsqueda general. Aquí 'q' puede servir para eso.
    # Si se necesita un campo específico para autocompletado, se podría añadir otro CharFilter.

    class Meta:
        model = Lote
        fields = [
            'q', 
            'ubicacion_proyecto', 
            'etapa', 
            'manzana', 
            'numero_lote', 
            'estado_lote'
        ]

    def general_search_filter(self, queryset, name, value):
        if value:
            # Buscar por ID de Lote también puede ser útil
            # Si 'etapa' es numérico, icontains no funcionará bien, pero ya tenemos filtro exacto para etapa.
            return queryset.filter(
                Q(id_lote__icontains=value) | # Añadido búsqueda por ID Lote
                Q(ubicacion_proyecto__icontains=value) |
                Q(manzana__icontains=value) |
                Q(numero_lote__icontains=value) |
                Q(etapa__icontains=value) # Búsqueda en etapa como texto, si es útil
            ).distinct() # distinct() por si los Q generan duplicados
        return queryset

class ClienteFilter(django_filters.FilterSet):
    q = django_filters.CharFilter(method='general_search_filter', label="Búsqueda (Nombre/Razón Social, N° Documento)")
    tipo_documento = django_filters.ChoiceFilter(choices=Cliente.TIPO_DOCUMENTO_CHOICES, label="Tipo de Documento")

    class Meta:
        model = Cliente
        fields = ['q', 'tipo_documento']

    def general_search_filter(self, queryset, name, value):
        if value:
            return queryset.filter(
                Q(nombres_completos_razon_social__icontains=value) | 
                Q(numero_documento__icontains=value)
            )
        return queryset

class AsesorFilter(django_filters.FilterSet):
    nombre_asesor = django_filters.CharFilter(lookup_expr='icontains', label="Nombre del Asesor")
    tipo_asesor_actual = django_filters.ChoiceFilter(choices=Asesor.TIPO_ASESOR_CHOICES, label="Tipo de Asesor Actual")

    class Meta:
        model = Asesor
        fields = ['nombre_asesor', 'tipo_asesor_actual']

class VentaFilter(django_filters.FilterSet):
    fecha_venta_after = django_filters.DateFilter(field_name='fecha_venta', lookup_expr='gte', label="Fecha Venta Desde (YYYY-MM-DD)")
    fecha_venta_before = django_filters.DateFilter(field_name='fecha_venta', lookup_expr='lte', label="Fecha Venta Hasta (YYYY-MM-DD)")
    lote_id = django_filters.CharFilter(field_name='lote__id_lote', lookup_expr='exact', label="ID del Lote (Ej: L0001)")
    cliente_q = django_filters.CharFilter(method='cliente_search_filter', label="Cliente (Nombre o N° Documento)")
    vendedor_q = django_filters.CharFilter(method='vendedor_search_filter', label="Vendedor (Nombre)")
    tipo_venta = django_filters.ChoiceFilter(choices=Venta.TIPO_VENTA_CHOICES, label="Tipo de Venta")
    status_venta = django_filters.ChoiceFilter(field_name='status_venta', choices=Venta.STATUS_VENTA_CHOICES, label="Status de Venta")

    class Meta:
        model = Venta
        fields = ['tipo_venta', 'status_venta', 'fecha_venta_after', 'fecha_venta_before', 'lote_id', 'cliente_q', 'vendedor_q']

    def cliente_search_filter(self, queryset, name, value):
        if value:
            return queryset.filter(
                Q(cliente__nombres_completos_razon_social__icontains=value) | 
                Q(cliente__numero_documento__icontains=value)
            )
        return queryset

    def vendedor_search_filter(self, queryset, name, value):
        if value:
            return queryset.filter(vendedor_principal__nombre_asesor__icontains=value)
        return queryset

class ActividadDiariaFilter(django_filters.FilterSet):
    fecha_actividad_after = django_filters.DateFilter(field_name='fecha_actividad', lookup_expr='gte', label="Fecha Actividad Desde (YYYY-MM-DD)")
    fecha_actividad_before = django_filters.DateFilter(field_name='fecha_actividad', lookup_expr='lte', label="Fecha Actividad Hasta (YYYY-MM-DD)")
    asesor_nombre = django_filters.CharFilter(field_name='asesor__nombre_asesor', lookup_expr='icontains', label="Nombre del Asesor")

    class Meta:
        model = ActividadDiaria
        fields = ['fecha_actividad_after', 'fecha_actividad_before', 'asesor_nombre']

# --- NUEVO FILTRO PARA PRESENCIA ---
class PresenciaFilter(django_filters.FilterSet):
    fecha_presencia_after = django_filters.DateTimeFilter(field_name='fecha_hora_presencia', lookup_expr='gte', label="Fecha Presencia Desde (YYYY-MM-DD HH:MM)")
    fecha_presencia_before = django_filters.DateTimeFilter(field_name='fecha_hora_presencia', lookup_expr='lte', label="Fecha Presencia Hasta (YYYY-MM-DD HH:MM)")
    cliente_nombre = django_filters.CharFilter(field_name='cliente__nombres_completos_razon_social', lookup_expr='icontains', label="Nombre del Cliente")
    proyecto_interes = django_filters.CharFilter(field_name='proyecto_interes', lookup_expr='icontains', label="Proyecto de Interés")
    modalidad = django_filters.ChoiceFilter(choices=Presencia.MODALIDAD_PRESENCIA_CHOICES, label="Modalidad")
    status_presencia = django_filters.ChoiceFilter(choices=Presencia.STATUS_PRESENCIA_CHOICES, label="Estado de la Presencia")
    resultado_interaccion = django_filters.ChoiceFilter(choices=Presencia.RESULTADO_INTERACCION_CHOICES, label="Resultado de la Interacción")
    
    # Filtros para los diferentes asesores involucrados (por nombre)
    asesor_captacion_opc_nombre = django_filters.CharFilter(field_name='asesor_captacion_opc__nombre_asesor', lookup_expr='icontains', label="Nombre Asesor Captación")
    asesor_call_agenda_nombre = django_filters.CharFilter(field_name='asesor_call_agenda__nombre_asesor', lookup_expr='icontains', label="Nombre Asesor Call")
    asesor_liner_nombre = django_filters.CharFilter(field_name='asesor_liner__nombre_asesor', lookup_expr='icontains', label="Nombre Asesor Liner")
    asesor_closer_nombre = django_filters.CharFilter(field_name='asesor_closer__nombre_asesor', lookup_expr='icontains', label="Nombre Asesor Closer")


    class Meta:
        model = Presencia
        fields = [
            'fecha_presencia_after', 'fecha_presencia_before', 
            'cliente_nombre', 'proyecto_interes', 'modalidad', 
            'status_presencia', 'resultado_interaccion',
            'asesor_captacion_opc_nombre', 'asesor_call_agenda_nombre',
            'asesor_liner_nombre', 'asesor_closer_nombre'
        ]
