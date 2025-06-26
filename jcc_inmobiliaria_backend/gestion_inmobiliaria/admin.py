# gestion_inmobiliaria/admin.py
from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html
from .models import (
    Lote, Cliente, Asesor, Venta, ActividadDiaria, 
    DefinicionMetaComision, TablaComisionDirecta, ConfigGeneral, LogAuditoriaCambio,
    RegistroPago, Presencia,
    PlanPagoVenta, CuotaPlanPago
)

@admin.register(Lote)
class LoteAdmin(admin.ModelAdmin):
    list_display = ('id_lote', 'ubicacion_proyecto', 'manzana', 'etapa', 'numero_lote', 'estado_lote', 'area_m2', 'precio_lista_soles', 'precio_credito_12_meses_soles', 'precio_credito_24_meses_soles', 'precio_credito_36_meses_soles', 'precio_lista_dolares', 'precio_credito_12_meses_dolares', 'precio_credito_24_meses_dolares', 'precio_credito_36_meses_dolares', 'ultima_modificacion')
    list_filter = ('estado_lote', 'etapa', 'ubicacion_proyecto', 'manzana')
    search_fields = ('id_lote', 'ubicacion_proyecto', 'manzana', 'numero_lote', 'partida_registral')
    list_per_page = 25
    fieldsets = (
        (None, {
            'fields': ('id_lote', 'ubicacion_proyecto', 'manzana', 'numero_lote', 'estado_lote', 'etapa')
        }),
        ('Detalles del Lote', {
            'fields': ('area_m2', 'colindancias', 'partida_registral')
        }),
        ('Precios (S/.)', {
            'fields': ('precio_lista_soles', 'precio_credito_12_meses_soles', 'precio_credito_24_meses_soles', 'precio_credito_36_meses_soles')
        }),
        ('Precios ($)', {
            'fields': ('precio_lista_dolares', 'precio_credito_12_meses_dolares', 'precio_credito_24_meses_dolares', 'precio_credito_36_meses_dolares')
        }),
        ('Observaciones', {
            'fields': ('observaciones_lote',),
            'classes': ('collapse',), 
        }),
         ('Auditoría', {
            'fields': ('fecha_creacion', 'ultima_modificacion'),
            'classes': ('collapse',)
        })
    )
    readonly_fields = ('id_lote','fecha_creacion', 'ultima_modificacion')

@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ('nombres_completos_razon_social', 'tipo_documento', 'numero_documento', 'email_principal', 'telefono_principal', 'ultima_modificacion')
    list_filter = ('tipo_documento', 'distrito', 'provincia')
    search_fields = ('id_cliente', 'nombres_completos_razon_social', 'numero_documento', 'email_principal')
    list_per_page = 25
    readonly_fields = ('id_cliente','fecha_registro', 'ultima_modificacion')
    fieldsets = (
        ('Información Principal', {
            'fields': ('id_cliente', 'nombres_completos_razon_social', 'tipo_documento', 'numero_documento')
        }),
        ('Contacto', {
            'fields': ('email_principal', 'email_secundario', 'telefono_principal', 'telefono_secundario')
        }),
        ('Ubicación', {
            'fields': ('direccion', 'distrito', 'provincia', 'departamento'),
            'classes': ('collapse',)
        }),
        ('Otros Datos', {
            'fields': ('fecha_nacimiento_constitucion', 'estado_civil', 'profesion_ocupacion'),
            'classes': ('collapse',)
        }),
         ('Auditoría', {
            'fields': ('fecha_registro', 'ultima_modificacion'),
            'classes': ('collapse',)
        })
    )

@admin.register(Asesor)
class AsesorAdmin(admin.ModelAdmin):
    list_display = ('id_asesor', 'nombre_asesor', 'tipo_asesor_actual', 'dni', 'telefono_personal', 'email_personal', 'fecha_ingreso', 'id_referidor')
    list_filter = ('tipo_asesor_actual', 'estado_civil')
    search_fields = ('id_asesor', 'nombre_asesor', 'dni', 'email_personal')
    autocomplete_fields = ['id_referidor'] 
    list_per_page = 25
    readonly_fields = ('id_asesor', 'fecha_registro_sistema', 'ultima_modificacion_sistema')
    fieldsets = (
        ('Información Principal del Asesor', {
            'fields': ('id_asesor', 'nombre_asesor', 'dni', 'tipo_asesor_actual', 'fecha_ingreso')
        }),
        ('Datos Personales', {
            'fields': ('fecha_nacimiento', 'estado_civil', 'numero_hijos', 'direccion_domicilio', 'telefono_personal', 'email_personal')
        }),
        ('Información Bancaria', {
            'fields': ('banco_preferido', 'numero_cuenta_bancaria', 'cci_cuenta_bancaria'),
            'classes': ('collapse',) 
        }),
        ('Relaciones y Jerarquía', {
            'fields': ('id_referidor', 'fecha_cambio_socio')
        }),
        ('Auditoría y Observaciones', {
            'fields': ('observaciones_asesor', 'fecha_registro_sistema', 'ultima_modificacion_sistema'),
            'classes': ('collapse',)
        }),
    )

class RegistroPagoInline(admin.TabularInline): 
    model = RegistroPago
    extra = 0 
    fields = ('fecha_pago', 'monto_pago', 'metodo_pago', 'referencia_pago', 'cuota_plan_pago_cubierta', 'notas_pago')
    readonly_fields = ('fecha_registro_pago',)
    autocomplete_fields = ['cuota_plan_pago_cubierta'] 
    fk_name = 'venta'

@admin.register(Venta)
class VentaAdmin(admin.ModelAdmin):
    list_display = ('id_venta', 'fecha_venta', 'lote_link', 'cliente_link', 'vendedor_principal', 'tipo_venta', 'plazo_meses_credito', 'valor_lote_venta', 'precio_dolares', 'tipo_cambio', 'monto_pagado_actual', 'status_venta')
    list_filter = ('status_venta', 'tipo_venta', 'fecha_venta', 'vendedor_principal', 'plazo_meses_credito')
    search_fields = ('id_venta', 'lote__id_lote', 'cliente__nombres_completos_razon_social', 'vendedor_principal__nombre_asesor')
    autocomplete_fields = ['lote', 'cliente', 'vendedor_principal', 'id_socio_participante'] 
    date_hierarchy = 'fecha_venta' 
    readonly_fields = ('id_venta', 'fecha_registro_venta', 'monto_pagado_actual', 'saldo_pendiente', 'valor_lote_venta')
    fieldsets = (
        ("Información General", {
            'fields': ('id_venta', 'fecha_venta', 'lote', 'cliente', 'vendedor_principal', 'id_socio_participante')
        }),
        ("Tipo y Plan de Venta", {
            'fields': ('tipo_venta', 'plazo_meses_credito', 'cuota_inicial_requerida', 'valor_lote_venta', 'precio_dolares', 'tipo_cambio')
        }),
        ("Detalles Económicos (Pagos Generales)", {
            'fields': ('monto_pagado_actual', 'saldo_pendiente')
        }),
        ("Clasificación y Estado", {
            'fields': ('status_venta', 'participacion_junior_venta', 'participacion_socio_venta', 'modalidad_presentacion')
        }),
        ("Comisiones Personalizadas", {
            'fields': ('porcentaje_comision_vendedor_principal_personalizado', 'porcentaje_comision_socio_personalizado'),
            'classes': ('collapse',)
        }),
        ("Otros", {
            'fields': ('notas', 'fecha_registro_venta')
        })
    )
    inlines = [RegistroPagoInline] 

    def lote_link(self, obj):
        if obj.lote:
            link = reverse("admin:gestion_inmobiliaria_lote_change", args=[obj.lote.pk])
            return format_html('<a href="{}">{}</a>', link, obj.lote)
        return "-"
    lote_link.short_description = 'Lote'

    def cliente_link(self, obj):
        if obj.cliente:
            link = reverse("admin:gestion_inmobiliaria_cliente_change", args=[obj.cliente.pk])
            return format_html('<a href="{}">{}</a>', link, obj.cliente)
        return "-"
    cliente_link.short_description = 'Cliente'

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        obj.actualizar_status_y_monto_pagado(save_instance=True) # Llamar explícitamente con save_instance

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        form.instance.actualizar_status_y_monto_pagado(save_instance=True) # Llamar explícitamente con save_instance

class CuotaPlanPagoInline(admin.TabularInline):
    model = CuotaPlanPago
    extra = 0
    fields = ('numero_cuota', 'fecha_vencimiento', 'monto_programado', 'monto_pagado', 'estado_cuota', 'fecha_pago_efectivo', 'saldo_cuota')
    readonly_fields = ('numero_cuota', 'fecha_vencimiento', 'monto_programado', 'saldo_cuota', 'monto_pagado', 'estado_cuota', 'fecha_pago_efectivo') # Hacer todos readonly aquí
    can_delete = False
    
    def has_add_permission(self, request, obj=None):
        return False

@admin.register(PlanPagoVenta)
class PlanPagoVentaAdmin(admin.ModelAdmin):
    list_display = ('id_plan_pago', 'venta_link', 'monto_total_credito', 'numero_cuotas', 'monto_cuota_regular_original', 'fecha_inicio_pago_cuotas', 'fecha_creacion') # CORREGIDO AQUÍ
    list_filter = ('venta__fecha_venta', 'numero_cuotas')
    search_fields = ('venta__id_venta', 'venta__cliente__nombres_completos_razon_social')
    readonly_fields = ('id_plan_pago', 'venta', 'monto_total_credito', 'numero_cuotas', 'monto_cuota_regular_original', 'fecha_inicio_pago_cuotas', 'fecha_creacion', 'ultima_modificacion') # CORREGIDO AQUÍ
    inlines = [CuotaPlanPagoInline]
    autocomplete_fields = ['venta']

    def venta_link(self, obj):
        if obj.venta:
            link = reverse("admin:gestion_inmobiliaria_venta_change", args=[obj.venta.pk])
            return format_html('<a href="{}">Venta {}</a>', link, obj.venta.id_venta)
        return "-"
    venta_link.short_description = 'Venta'
    
    def has_add_permission(self, request): return False
    def has_delete_permission(self, request, obj=None): return False

@admin.register(CuotaPlanPago)
class CuotaPlanPagoAdmin(admin.ModelAdmin):
    list_display = ('id_cuota', 'plan_pago_venta_link', 'numero_cuota', 'fecha_vencimiento', 'monto_programado', 'monto_pagado', 'estado_cuota', 'fecha_pago_efectivo')
    list_filter = ('estado_cuota', 'fecha_vencimiento', 'plan_pago_venta__venta__vendedor_principal__nombre_asesor')
    search_fields = ('plan_pago_venta__venta__id_venta', 'plan_pago_venta__venta__cliente__nombres_completos_razon_social', 'numero_cuota')
    readonly_fields = ('id_cuota', 'plan_pago_venta', 'numero_cuota', 'fecha_vencimiento', 'monto_programado', 'saldo_cuota')
    list_editable = ('monto_pagado', 'estado_cuota', 'fecha_pago_efectivo')
    autocomplete_fields = ['plan_pago_venta']
    
    def plan_pago_venta_link(self, obj):
        if obj.plan_pago_venta:
            link = reverse("admin:gestion_inmobiliaria_planpagoventa_change", args=[obj.plan_pago_venta.pk])
            return format_html('<a href="{}">Plan Venta {}</a>', link, obj.plan_pago_venta.venta.id_venta)
        return "-"
    plan_pago_venta_link.short_description = 'Plan de Pago Venta'
    
    def has_add_permission(self, request): return False

@admin.register(ActividadDiaria)
class ActividadDiariaAdmin(admin.ModelAdmin):
    list_display = ('fecha_actividad', 'asesor', 'datos_captados_opc', 'llamadas_realizadas', 'presencias_generadas')
    list_filter = ('fecha_actividad', 'asesor__nombre_asesor') 
    search_fields = ('asesor__nombre_asesor',)
    date_hierarchy = 'fecha_actividad'
    ordering = ('-fecha_actividad', 'asesor')
    readonly_fields = ('presencias_generadas',)

admin.site.register(DefinicionMetaComision)
admin.site.register(ConfigGeneral)

@admin.register(TablaComisionDirecta)
class TablaComisionDirectaAdmin(admin.ModelAdmin):
    list_display = ('rol_asesor_en_venta', 'tipo_venta', 'participacion_en_venta_aplicable', 'porcentaje_comision')
    list_filter = ('rol_asesor_en_venta', 'tipo_venta', 'participacion_en_venta_aplicable')
    search_fields = ('rol_asesor_en_venta', 'participacion_en_venta_aplicable')
    fields = ('rol_asesor_en_venta', 'tipo_venta', 'participacion_en_venta_aplicable', 'porcentaje_comision')
    list_editable = ('porcentaje_comision',) 

@admin.register(LogAuditoriaCambio)
class LogAuditoriaCambioAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'usuario_email', 'accion', 'modulo', 'id_registro_afectado', 'campo_modificado')
    list_filter = ('accion', 'modulo', 'usuario_email', 'timestamp')
    search_fields = ('usuario_email', 'id_registro_afectado', 'detalles_adicionales')
    readonly_fields = [f.name for f in LogAuditoriaCambio._meta.fields] 
    def has_add_permission(self, request): return False
    def has_change_permission(self, request, obj=None): return False

@admin.register(RegistroPago)
class RegistroPagoAdmin(admin.ModelAdmin):
    list_display = ('id_pago', 'venta_link', 'fecha_pago', 'monto_pago', 'metodo_pago', 'cuota_plan_pago_cubierta_link', 'referencia_pago')
    list_filter = ('metodo_pago', 'fecha_pago', 'venta__vendedor_principal__nombre_asesor', 'cuota_plan_pago_cubierta__plan_pago_venta__venta') 
    search_fields = ('venta__id_venta', 'referencia_pago', 'venta__cliente__nombres_completos_razon_social')
    autocomplete_fields = ['venta', 'cuota_plan_pago_cubierta']
    date_hierarchy = 'fecha_pago'
    list_per_page = 25
    fields = ('venta', 'fecha_pago', 'monto_pago', 'metodo_pago', 'cuota_plan_pago_cubierta', 'referencia_pago', 'notas_pago')
    readonly_fields = ('id_pago', 'fecha_registro_pago')

    def venta_link(self, obj):
        if obj.venta:
            link = reverse("admin:gestion_inmobiliaria_venta_change", args=[obj.venta.pk])
            return format_html('<a href="{}">{}</a>', link, obj.venta.id_venta)
        return "-"
    venta_link.short_description = 'Venta Asociada'

    def cuota_plan_pago_cubierta_link(self, obj):
        if obj.cuota_plan_pago_cubierta:
            link = reverse("admin:gestion_inmobiliaria_cuotaplanpago_change", args=[obj.cuota_plan_pago_cubierta.pk])
            return format_html('<a href="{}">Cuota {} (Venta {})</a>', link, obj.cuota_plan_pago_cubierta.numero_cuota, obj.cuota_plan_pago_cubierta.plan_pago_venta.venta.id_venta)
        return "-"
    cuota_plan_pago_cubierta_link.short_description = 'Cuota Cubierta'

@admin.register(Presencia)
class PresenciaAdmin(admin.ModelAdmin):
    list_display = ('id_presencia', 'cliente_link', 'fecha_hora_presencia', 'proyecto_interes', 'get_asesor_closer_nombre', 'resultado_interaccion', 'venta_asociada_link', 'status_presencia')
    list_filter = ('fecha_hora_presencia', 'proyecto_interes', 'modalidad', 'status_presencia', 'resultado_interaccion', 'asesor_captacion_opc', 'asesor_call_agenda', 'asesor_liner', 'asesor_closer')
    search_fields = ('cliente__nombres_completos_razon_social', 'proyecto_interes', 'observaciones', 'id_presencia')
    autocomplete_fields = ['cliente', 'lote_interes_inicial', 'asesor_captacion_opc', 'asesor_call_agenda', 'asesor_liner', 'asesor_closer', 'venta_asociada']
    date_hierarchy = 'fecha_hora_presencia' 
    list_per_page = 20
    fieldsets = (
        ("Información Principal de la Presencia", {
            'fields': ('cliente', 'fecha_hora_presencia', 'proyecto_interes', 'lote_interes_inicial', 'modalidad')
        }),
        ("Asesores Involucrados en el Proceso", {
            'fields': ('medio_captacion', 'asesor_captacion_opc', 'asesor_call_agenda', 'asesor_liner', 'asesor_closer')
        }),
        ("Resultado y Seguimiento de la Presencia", {
            'fields': ('status_presencia', 'resultado_interaccion', 'venta_asociada', 'observaciones')
        }),
        ("Auditoría", {
            'fields': ('id_presencia', 'fecha_registro_sistema', 'ultima_modificacion'),
            'classes': ('collapse',)
        })
    )
    readonly_fields = ('id_presencia', 'fecha_registro_sistema', 'ultima_modificacion')

    @admin.display(description='Cliente', ordering='cliente__nombres_completos_razon_social')
    def cliente_link(self, obj):
        if obj.cliente:
            link = reverse("admin:gestion_inmobiliaria_cliente_change", args=[obj.cliente.pk])
            return format_html('<a href="{}">{}</a>', link, obj.cliente)
        return "-"

    @admin.display(description='Asesor Closer', ordering='asesor_closer__nombre_asesor')
    def get_asesor_closer_nombre(self, obj):
        return obj.asesor_closer.nombre_asesor if obj.asesor_closer else '-'

    @admin.display(description='Venta Asociada', ordering='venta_asociada__id_venta')
    def venta_asociada_link(self, obj):
        if obj.venta_asociada:
            link = reverse("admin:gestion_inmobiliaria_venta_change", args=[obj.venta_asociada.pk])
            return format_html('<a href="{}">{}</a>', link, obj.venta_asociada.id_venta)
        return "-"