# ============================================================================
# PROTECCIÓN CRÍTICA - NO ELIMINAR NI MODIFICAR SIN AUTORIZACIÓN
# ============================================================================
# 
# Este archivo contiene funcionalidad CRÍTICA para el manejo de ventas en dólares
# (Aucallama/Oasis 2) y soles. Los siguientes elementos NO DEBEN ser eliminados
# ni modificados sin autorización explícita:
#
# 1. Métodos get_monto_total_credito_dolares y get_saldo_total_dolares
# 2. Cálculos de montos en dólares basados en precio_dolares del lote
# 3. Conversión de cuota inicial de soles a dólares usando tipo_cambio
# 4. Manejo de campos monto_pago_dolares y tipo_cambio_pago
# 5. Validaciones para proyectos en dólares
# 6. Cualquier serializer method relacionado con lógica de monedas
#
# ÚLTIMA ACTUALIZACIÓN: 26/Jun/2025 - Sistema robusto para Aucallama/Oasis 2
# ============================================================================

# gestion_inmobiliaria/serializers.py
from rest_framework import serializers
from django.db import transaction
from .models import (
    Lote, Cliente, Asesor, Venta, ActividadDiaria,
    DefinicionMetaComision, TablaComisionDirecta, ConfigGeneral, LogAuditoriaCambio,
    RegistroPago, Presencia,
    PlanPagoVenta, CuotaPlanPago, ComisionVentaAsesor
)
from decimal import Decimal

class LoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lote
        fields = [
            'id_lote', 'ubicacion_proyecto', 'manzana', 'numero_lote', 'etapa', 
            'area_m2', 'precio_lista_soles', 
            'precio_credito_12_meses_soles', 'precio_credito_24_meses_soles', 'precio_credito_36_meses_soles',
            'precio_lista_dolares',
            'precio_credito_12_meses_dolares', 'precio_credito_24_meses_dolares', 'precio_credito_36_meses_dolares',
            'estado_lote', 
            'colindancias', 'partida_registral', 'observaciones_lote', 
            'fecha_creacion', 'ultima_modificacion'
        ]
    def validate(self, data):
        proyecto = (data.get('ubicacion_proyecto') or '').strip().lower()
        # Permitir cualquier variante que contenga 'aucallama' u 'oasis 2'
        if not (('aucallama' in proyecto) or ('oasis 2' in proyecto)):
            if data.get('precio_lista_soles') in [None, '']:
                raise serializers.ValidationError({'precio_lista_soles': 'Este campo es obligatorio para proyectos que no son Aucallama u Oasis 2.'})
        return data

class ClienteCreateSerializer(serializers.ModelSerializer):
    telefono_principal = serializers.CharField(required=False, allow_blank=True, max_length=20, allow_null=True)
    direccion = serializers.CharField(required=False, allow_blank=True, max_length=255, allow_null=True)
    email_principal = serializers.EmailField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = Cliente
        fields = [
            'id_cliente', 
            'nombres_completos_razon_social', 'tipo_documento', 'numero_documento',
            'email_principal', 'telefono_principal', 'telefono_secundario', 'direccion',
            'fecha_nacimiento_constitucion', 'distrito', 'provincia', 'departamento',
            'estado_civil', 'profesion_ocupacion'
        ]
        read_only_fields = ('id_cliente',)

class ClienteSummarySerializer(serializers.ModelSerializer):
    display_text = serializers.SerializerMethodField()
    
    class Meta:
        model = Cliente
        fields = ['id_cliente', 'nombres_completos_razon_social', 'tipo_documento', 'numero_documento', 'email_principal', 'telefono_principal', 'direccion', 'display_text']
    
    def get_display_text(self, obj):
        """Retorna el texto para mostrar en desplegables: Nombre (Teléfono)"""
        telefono = obj.telefono_principal or 'Sin teléfono'
        return f"{obj.nombres_completos_razon_social} ({telefono})"

class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = '__all__'

class AsesorSerializer(serializers.ModelSerializer):
    # Campos de solo lectura para mostrar información relacionada o formateada
    nombre_referidor = serializers.CharField(source='id_referidor.nombre_asesor', read_only=True, allow_null=True)
    # Asumo que tienes un método get_estado_civil_display en tu modelo Asesor
    # Si no, puedes quitar esta línea o el serializer intentará encontrarlo.
    estado_civil_display = serializers.CharField(source='get_estado_civil_display', read_only=True, allow_null=True) 
    # Para mostrar el label del choice del banco
    banco_display = serializers.CharField(source='get_banco_display', read_only=True, allow_null=True)

    class Meta: # <--- ESTA CLASE INTERNA ES ESENCIAL
        model = Asesor
        fields = [
            'id_asesor', 
            'nombre_asesor', 
            'dni', 
            'fecha_nacimiento', 
            'estado_civil', 
            'estado_civil_display', # Mostrar el label del choice
            'numero_hijos', 
            'direccion', # Nombre que usaste en el form, asegúrate que coincida con el modelo
            'distrito',               # Nuevo campo
            'telefono_personal', 
            'email_personal', 
            
            # Campos bancarios actualizados
            'banco', 
            'banco_display', # Mostrar el label del choice
            'numero_cuenta_bancaria', 
            'cci_cuenta_bancaria',
            'cuenta_bancaria_otros',
            
            'id_referidor', 
            'nombre_referidor', 
            'fecha_ingreso', 
            'tipo_asesor_actual', 
            'fecha_cambio_socio', 
            'observaciones_asesor', 
            
            # Campos que podrías tener (ajusta según tu modelo actual):
            # 'meta_presencias_mensual', 
            # 'meta_ventas_mensual',
            # 'activo',
            # 'usuario', # Si tienes un campo OneToOneField a User
            
            'fecha_registro_sistema', 
            'ultima_modificacion_sistema'
        ]
        read_only_fields = (
            'id_asesor', 
            'nombre_referidor', 
            'estado_civil_display',
            'banco_display',
            'fecha_registro_sistema', 
            'ultima_modificacion_sistema'
        )

class CuotaPlanPagoSerializer(serializers.ModelSerializer):
    estado_cuota_display = serializers.CharField(source='get_estado_cuota_display', read_only=True)
    saldo_cuota = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    monto_programado_display = serializers.SerializerMethodField()
    saldo_cuota_display = serializers.SerializerMethodField()
    monto_pagado_soles = serializers.SerializerMethodField()
    tipo_cambio_pago = serializers.SerializerMethodField()
    monto_pagado_dolares = serializers.SerializerMethodField()
    saldo_cuota_dolares = serializers.SerializerMethodField()

    class Meta:
        model = CuotaPlanPago
        fields = [
            'id_cuota', 'plan_pago_venta', 'numero_cuota', 'fecha_vencimiento', 
            'monto_programado', 'monto_pagado', 'estado_cuota', 'estado_cuota_display',
            'fecha_pago_efectivo', 'saldo_cuota',
            'monto_programado_display', 'saldo_cuota_display',
            'monto_pagado_soles', 'tipo_cambio_pago',
            'monto_pagado_dolares', 'saldo_cuota_dolares',
        ]
        read_only_fields = ('id_cuota', 'estado_cuota_display', 'saldo_cuota', 'plan_pago_venta')
        extra_kwargs = {
            'monto_pagado': {'required': False},
            'estado_cuota': {'required': False},
            'fecha_pago_efectivo': {'required': False, 'allow_null': True},
        }

    def get_monto_programado_display(self, obj):
        if obj.plan_pago_venta and obj.plan_pago_venta.venta and (
            'aucallama' in obj.plan_pago_venta.venta.lote.ubicacion_proyecto.lower() or
            'oasis 2' in obj.plan_pago_venta.venta.lote.ubicacion_proyecto.lower()
        ):
            return {'dolares': obj.monto_programado_dolares, 'soles': None}
        return {'dolares': None, 'soles': obj.monto_programado}

    def get_saldo_cuota_display(self, obj):
        if obj.plan_pago_venta and obj.plan_pago_venta.venta and (
            'aucallama' in obj.plan_pago_venta.venta.lote.ubicacion_proyecto.lower() or
            'oasis 2' in obj.plan_pago_venta.venta.lote.ubicacion_proyecto.lower()
        ):
            return {'dolares': obj.saldo_cuota, 'soles': None}
        return {'dolares': None, 'soles': obj.saldo_cuota}

    def get_monto_pagado_soles(self, obj):
        pagos = obj.pagos_que_la_cubren.all()
        total = 0
        for p in pagos:
            if p.monto_pago_dolares is not None and p.tipo_cambio_pago is not None:
                total += float(p.monto_pago_dolares) * float(p.tipo_cambio_pago)
            elif p.monto_pago is not None:
                total += float(p.monto_pago)
        return round(total, 2)

    def get_tipo_cambio_pago(self, obj):
        pagos = obj.pagos_que_la_cubren.filter(monto_pago_dolares__isnull=False, tipo_cambio_pago__isnull=False).order_by('-fecha_pago', '-id_pago')
        if pagos:
            ultimo_pago = pagos[0]
            return float(ultimo_pago.tipo_cambio_pago)
        return None

    def get_monto_pagado_dolares(self, obj):
        pagos = obj.pagos_que_la_cubren.all()
        total = sum([float(p.monto_pago_dolares) for p in pagos if p.monto_pago_dolares is not None])
        return round(total, 2)

    def get_saldo_cuota_dolares(self, obj):
        if obj.plan_pago_venta and obj.plan_pago_venta.venta and (
            'aucallama' in obj.plan_pago_venta.venta.lote.ubicacion_proyecto.lower() or
            'oasis 2' in obj.plan_pago_venta.venta.lote.ubicacion_proyecto.lower()
        ):
            pagado = self.get_monto_pagado_dolares(obj)
            programado = float(obj.monto_programado_dolares or 0)
            return round(programado - pagado, 2)
        return None

class PlanPagoVentaSerializer(serializers.ModelSerializer):
    cuotas = CuotaPlanPagoSerializer(many=True, read_only=True)
    venta_id_str = serializers.CharField(source='venta.id_venta', read_only=True)
    venta_cliente_nombre = serializers.CharField(source='venta.cliente.nombres_completos_razon_social', read_only=True)
    venta_lote_id = serializers.CharField(source='venta.lote.id_lote', read_only=True)
    monto_cuota_regular_display = serializers.SerializerMethodField()
    monto_pagado_dolares = serializers.SerializerMethodField()
    saldo_total_dolares = serializers.SerializerMethodField()
    monto_total_credito_dolares = serializers.SerializerMethodField()

    class Meta:
        model = PlanPagoVenta
        fields = [
            'id_plan_pago', 'venta', 'venta_id_str', 'venta_cliente_nombre', 'venta_lote_id',
            'monto_total_credito', 'monto_total_credito_dolares', 'numero_cuotas',
            'monto_cuota_regular_original', 'monto_cuota_regular_display',
            'fecha_inicio_pago_cuotas', 'observaciones', 'cuotas',
            'monto_pagado_dolares', 'saldo_total_dolares',
        ]
        read_only_fields = ('id_plan_pago', 'fecha_creacion', 'ultima_modificacion', 'venta_id_str', 'cuotas', 'venta_cliente_nombre', 'venta_lote_id')

    def get_monto_cuota_regular_display(self, obj):
        if obj.venta and obj.venta.lote and (
            'aucallama' in obj.venta.lote.ubicacion_proyecto.lower() or
            'oasis 2' in obj.venta.lote.ubicacion_proyecto.lower()
        ):
            return {'dolares': obj.monto_cuota_regular_original, 'soles': None}
        return {'dolares': None, 'soles': obj.monto_cuota_regular_original}

    def get_monto_pagado_dolares(self, obj):
        pagos = obj.venta.registros_pago.all()
        total = sum([float(p.monto_pago_dolares) for p in pagos if p.monto_pago_dolares is not None])
        return round(total, 2)

    def get_monto_total_credito_dolares(self, obj):
        if obj.venta and obj.venta.lote and (
            'aucallama' in obj.venta.lote.ubicacion_proyecto.lower() or
            'oasis 2' in obj.venta.lote.ubicacion_proyecto.lower()
        ):
            # Para proyectos en dólares, calcular el monto financiado en dólares
            # basado en el precio_dolares del lote menos la cuota inicial en dólares
            precio_dolares = obj.venta.precio_dolares or Decimal('0.00')
            cuota_inicial_dolares = Decimal('0.00')
            
            # Si hay cuota inicial, convertirla de soles a dólares usando el tipo de cambio
            if obj.venta.cuota_inicial_requerida and obj.venta.cuota_inicial_requerida > Decimal('0.00'):
                if obj.venta.tipo_cambio and obj.venta.tipo_cambio > Decimal('0.00'):
                    cuota_inicial_dolares = (obj.venta.cuota_inicial_requerida / obj.venta.tipo_cambio).quantize(Decimal('0.01'))
            
            monto_financiado_dolares = precio_dolares - cuota_inicial_dolares
            return round(monto_financiado_dolares, 2)
        return None

    def get_saldo_total_dolares(self, obj):
        if obj.venta and obj.venta.lote and (
            'aucallama' in obj.venta.lote.ubicacion_proyecto.lower() or
            'oasis 2' in obj.venta.lote.ubicacion_proyecto.lower()
        ):
            # Para proyectos en dólares, calcular el saldo total en dólares
            monto_financiado_dolares = self.get_monto_total_credito_dolares(obj) or Decimal('0.00')
            pagos_en_dolares = Decimal(str(self.get_monto_pagado_dolares(obj) or 0))
            saldo_total_dolares = monto_financiado_dolares - pagos_en_dolares
            return round(saldo_total_dolares, 2)
        return None

class RegistroPagoSerializer(serializers.ModelSerializer):
    cuota_info = CuotaPlanPagoSerializer(source='cuota_plan_pago_cubierta', read_only=True, allow_null=True)
    monto_pago_display = serializers.SerializerMethodField()

    class Meta:
        model = RegistroPago
        fields = [
            'id_pago', 'venta', 'fecha_pago', 'monto_pago', 'monto_pago_dolares', 'tipo_cambio_pago', 'monto_pago_soles',
            'metodo_pago', 'referencia_pago', 'notas_pago', 'fecha_registro_pago', 
            'cuota_plan_pago_cubierta', 'cuota_info',
            'monto_pago_display'
        ]
        read_only_fields = ('fecha_registro_pago', 'cuota_info')
        extra_kwargs = {
            'monto_pago': {'required': False, 'allow_null': True},
            'monto_pago_dolares': {'required': False, 'allow_null': True},
            'tipo_cambio_pago': {'required': False, 'allow_null': True},
            'monto_pago_soles': {'required': False, 'allow_null': True},
        }

    def validate(self, data):
        monto_pago = data.get('monto_pago', None)
        monto_pago_dolares = data.get('monto_pago_dolares', None)
        if (monto_pago is None or monto_pago == '') and (monto_pago_dolares is None or monto_pago_dolares == ''):
            raise serializers.ValidationError({'monto_pago': 'Este campo es requerido si no se ingresa un monto en dólares.'})
        return data

    def get_monto_pago_display(self, obj):
        if obj.monto_pago_dolares and obj.tipo_cambio_pago:
            return f"${obj.monto_pago_dolares} (TC: {obj.tipo_cambio_pago})"
        return f"S/. {obj.monto_pago}"

class ComisionVentaAsesorSerializer(serializers.ModelSerializer):
    asesor_nombre = serializers.CharField(source='asesor.nombre_asesor', read_only=True)
    class Meta:
        model = ComisionVentaAsesor
        fields = ['id_comision_venta_asesor', 'asesor', 'asesor_nombre', 'rol', 'porcentaje_comision', 'monto_comision_calculado', 'notas']
        read_only_fields = ['id_comision_venta_asesor', 'monto_comision_calculado']

class VentaSerializer(serializers.ModelSerializer):
    lote_info = serializers.CharField(source='lote.__str__', read_only=True, allow_null=True)
    cliente_detalle = ClienteSummarySerializer(source='cliente', read_only=True)
    vendedor_principal_nombre = serializers.CharField(source='vendedor_principal.nombre_asesor', read_only=True, allow_null=True)
    socio_participante_nombre = serializers.CharField(source='id_socio_participante.nombre_asesor', read_only=True, allow_null=True)
    status_venta_display = serializers.CharField(source='get_status_venta_display', read_only=True)
    saldo_pendiente = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    registros_pago = RegistroPagoSerializer(many=True, read_only=True)
    presencia_que_origino_id = serializers.PrimaryKeyRelatedField(source='presencia_que_origino', read_only=True, allow_null=True)
    nuevo_cliente_data = ClienteCreateSerializer(required=False, write_only=True, allow_null=True)
    plan_pago_detalle = PlanPagoVentaSerializer(source='plan_pago_venta', read_only=True, allow_null=True)
    precio_dolares = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    tipo_cambio = serializers.DecimalField(max_digits=8, decimal_places=3, required=False, allow_null=True)
    saldo_pendiente_dolares = serializers.SerializerMethodField()
    comisiones_asesores = ComisionVentaAsesorSerializer(many=True, required=False)

    # --- INICIO: AÑADIR CAMPOS DE FIRMA ---
    cliente_firmo_contrato = serializers.BooleanField(read_only=True)
    fecha_firma_contrato = serializers.DateField(read_only=True, allow_null=True)
    # --- FIN: AÑADIR CAMPOS DE FIRMA ---

    class Meta:
        model = Venta
        fields = [
            'id_venta', 'fecha_venta',
            'lote', 'lote_info',
            'cliente', 'cliente_detalle', 'nuevo_cliente_data',
            'valor_lote_venta', 
            'tipo_venta', 
            'plazo_meses_credito', 
            'cuota_inicial_requerida', 
            'monto_pagado_actual',
            'saldo_pendiente',
            'status_venta', 'status_venta_display',
            'cliente_firmo_contrato', # Nuevo
            'fecha_firma_contrato',   # Nuevo
            'vendedor_principal', 'vendedor_principal_nombre',
            'participacion_junior_venta',
            'id_socio_participante', 'socio_participante_nombre',
            'participacion_socio_venta',
            'modalidad_presentacion', 'notas',
            'fecha_registro_venta',
            'registros_pago', 
            'plan_pago_detalle', 
            'presencia_que_origino_id',
            'porcentaje_comision_vendedor_principal_personalizado',
            'porcentaje_comision_socio_personalizado',
            'precio_dolares',
            'tipo_cambio',
            'saldo_pendiente_dolares',
            'comisiones_asesores',
        ]
        read_only_fields = (
            'valor_lote_venta', 
            'cliente_detalle', 'monto_pagado_actual', 'saldo_pendiente', 
            'status_venta_display', 'registros_pago', 'fecha_registro_venta', 
            'presencia_que_origino_id', 'plan_pago_detalle',
            'cliente_firmo_contrato', 'fecha_firma_contrato' # Nuevos campos read-only
        )
        extra_kwargs = {
            'cliente': {'required': False, 'allow_null': True},
            'plazo_meses_credito': {'required': False, 'allow_null': False, 'default': 0},
            'vendedor_principal': {'required': False, 'allow_null': True},
        }
    def validate_plazo_meses_credito(self, value):
        tipo_venta = self.initial_data.get('tipo_venta')
        if tipo_venta == Venta.TIPO_VENTA_CREDITO and (value is None or value == 0):
            raise serializers.ValidationError("Para ventas a crédito, se debe especificar un plazo en meses (12, 24, o 36).")
        if tipo_venta == Venta.TIPO_VENTA_CONTADO and value not in [None, 0]:
            raise serializers.ValidationError("El plazo en meses solo aplica para ventas a crédito (o debe ser 0/Nulo para contado).")
        return value if tipo_venta == Venta.TIPO_VENTA_CREDITO else 0 # Asegurar 0 para contado
        
    def validate(self, data):
        cliente_id = data.get('cliente')
        nuevo_cliente_info = data.get('nuevo_cliente_data')

        if not self.instance: 
            if not cliente_id and not nuevo_cliente_info:
                raise serializers.ValidationError({"cliente": "Se debe proporcionar un cliente existente o los datos para crear uno nuevo."})
            if cliente_id and nuevo_cliente_info:
                raise serializers.ValidationError({"cliente": "Proporcione un cliente existente (ID) o datos para un nuevo cliente, pero no ambos."})

        if data.get('porcentaje_comision_socio_personalizado') is not None and not data.get('id_socio_participante'):
            raise serializers.ValidationError({"porcentaje_comision_socio_personalizado": "No se puede establecer comisión personalizada para socio sin seleccionar un socio participante."})

        tipo_venta = data.get('tipo_venta')
        plazo_meses = data.get('plazo_meses_credito', 0 if tipo_venta == Venta.TIPO_VENTA_CONTADO else None) # Default si no viene
        lote = data.get('lote') 

        if not lote and self.instance: 
            lote = self.instance.lote
        
        if not lote: 
            raise serializers.ValidationError({"lote": "Se requiere un lote para la venta."})

        proyecto = lote.ubicacion_proyecto.strip().lower() if lote and lote.ubicacion_proyecto else ''
        es_dolares = ('aucallama' in proyecto) or ('oasis 2' in proyecto)
        if es_dolares:
            if not data.get('precio_dolares') or float(data.get('precio_dolares') or 0) <= 0:
                raise serializers.ValidationError({"precio_dolares": "Debe ingresar el precio en dólares para este proyecto."})
            if not data.get('tipo_cambio') or float(data.get('tipo_cambio') or 0) <= 0:
                raise serializers.ValidationError({"tipo_cambio": "Debe ingresar un tipo de cambio válido para este proyecto."})

        if tipo_venta == Venta.TIPO_VENTA_CREDITO:
            if not plazo_meses or plazo_meses not in [12, 24, 36]:
                raise serializers.ValidationError({"plazo_meses_credito": "Debe seleccionar un plazo válido (12, 24, o 36 meses) para ventas a crédito."})
            if lote:
                if plazo_meses == 12:
                    if es_dolares:
                        if not lote.precio_credito_12_meses_dolares:
                            raise serializers.ValidationError({"plazo_meses_credito": f"El lote {lote.id_lote} no tiene precio definido para 12 meses (dólares)."})
                    else:
                        if not lote.precio_credito_12_meses_soles:
                            raise serializers.ValidationError({"plazo_meses_credito": f"El lote {lote.id_lote} no tiene precio definido para 12 meses."})
                elif plazo_meses == 24:
                    if es_dolares:
                        if not lote.precio_credito_24_meses_dolares:
                            raise serializers.ValidationError({"plazo_meses_credito": f"El lote {lote.id_lote} no tiene precio definido para 24 meses (dólares)."})
                    else:
                        if not lote.precio_credito_24_meses_soles:
                            raise serializers.ValidationError({"plazo_meses_credito": f"El lote {lote.id_lote} no tiene precio definido para 24 meses."})
                elif plazo_meses == 36:
                    if es_dolares:
                        if not lote.precio_credito_36_meses_dolares:
                            raise serializers.ValidationError({"plazo_meses_credito": f"El lote {lote.id_lote} no tiene precio definido para 36 meses (dólares)."})
                    else:
                        if not lote.precio_credito_36_meses_soles:
                            raise serializers.ValidationError({"plazo_meses_credito": f"El lote {lote.id_lote} no tiene precio definido para 36 meses."})
        elif tipo_venta == Venta.TIPO_VENTA_CONTADO:
             data['plazo_meses_credito'] = 0
        return data

    def create(self, validated_data):
        comisiones_asesores_data = validated_data.pop('comisiones_asesores', [])
        venta = super().create(validated_data)
        for comision_data in comisiones_asesores_data:
            ComisionVentaAsesor.objects.create(venta=venta, **comision_data)
        return venta

    def update(self, instance, validated_data):
        comisiones_asesores_data = validated_data.pop('comisiones_asesores', None)
        venta = super().update(instance, validated_data)
        if comisiones_asesores_data is not None:
            instance.comisiones_asesores.all().delete()
            for comision_data in comisiones_asesores_data:
                ComisionVentaAsesor.objects.create(venta=instance, **comision_data)
        return venta

    def get_saldo_pendiente_dolares(self, obj):
        if obj.lote and (
            'aucallama' in obj.lote.ubicacion_proyecto.lower() or
            'oasis 2' in obj.lote.ubicacion_proyecto.lower()
        ):
            if obj.precio_dolares:
                total = float(obj.precio_dolares)
                pagado = sum([float(p.monto_pago_dolares) for p in obj.registros_pago.all() if p.monto_pago_dolares is not None])
                return round(total - pagado, 2)
        return None

class ActividadDiariaSerializer(serializers.ModelSerializer):
    asesor_nombre = serializers.CharField(source='asesor.nombre_asesor', read_only=True, allow_null=True)
    class Meta:
        model = ActividadDiaria
        fields = ['id_actividad', 'fecha_actividad', 'asesor', 'asesor_nombre', 'datos_captados_opc', 'llamadas_realizadas', 'presencias_generadas', 'notas_actividad']

class PresenciaSerializer(serializers.ModelSerializer):
    cliente_detalle = ClienteSummarySerializer(source='cliente', read_only=True)
    asesor_captacion_opc_nombre = serializers.CharField(source='asesor_captacion_opc.nombre_asesor', read_only=True, allow_null=True)
    asesor_call_agenda_nombre = serializers.CharField(source='asesor_call_agenda.nombre_asesor', read_only=True, allow_null=True)
    asesor_liner_nombre = serializers.CharField(source='asesor_liner.nombre_asesor', read_only=True, allow_null=True)
    asesor_closer_nombre = serializers.CharField(source='asesor_closer.nombre_asesor', read_only=True, allow_null=True)
    lote_interes_inicial_id_str = serializers.CharField(source='lote_interes_inicial.id_lote', read_only=True, allow_null=True)
    venta_asociada_id_str = serializers.CharField(source='venta_asociada.id_venta', read_only=True, allow_null=True)
    status_presencia_display = serializers.CharField(source='get_status_presencia_display', read_only=True, allow_null=True)
    resultado_interaccion_display = serializers.CharField(source='get_resultado_interaccion_display', read_only=True, allow_null=True)
    modalidad_display = serializers.CharField(source='get_modalidad_display', read_only=True, allow_null=True)
    medio_captacion_display = serializers.CharField(source='get_medio_captacion_display', read_only=True, allow_null=True)
    nuevo_cliente_data = ClienteCreateSerializer(required=False, write_only=True, allow_null=True)
    class Meta:
        model = Presencia
        fields = [ 'id_presencia', 'cliente', 'cliente_detalle', 'nuevo_cliente_data', 'fecha_hora_presencia', 'proyecto_interes', 'lote_interes_inicial', 'lote_interes_inicial_id_str', 'asesor_captacion_opc', 'asesor_captacion_opc_nombre', 'medio_captacion', 'medio_captacion_display', 'asesor_call_agenda', 'asesor_call_agenda_nombre', 'asesor_liner', 'asesor_liner_nombre', 'asesor_closer', 'asesor_closer_nombre', 'modalidad', 'modalidad_display', 'status_presencia', 'status_presencia_display', 'resultado_interaccion', 'resultado_interaccion_display', 'venta_asociada', 'venta_asociada_id_str', 'observaciones', 'fecha_registro_sistema', 'ultima_modificacion', 'tipo_tour' ]
        read_only_fields = ( 'cliente_detalle', 'fecha_registro_sistema', 'ultima_modificacion', 'asesor_captacion_opc_nombre', 'asesor_call_agenda_nombre', 'asesor_liner_nombre', 'asesor_closer_nombre', 'lote_interes_inicial_id_str', 'venta_asociada_id_str', 'status_presencia_display', 'resultado_interaccion_display', 'modalidad_display', 'medio_captacion_display')
        extra_kwargs = { 'cliente': {'required': False, 'allow_null': True} }
    def validate(self, data):
        cliente_id = data.get('cliente')
        nuevo_cliente_info = data.get('nuevo_cliente_data')
        if not self.instance: 
            if not cliente_id and not nuevo_cliente_info: raise serializers.ValidationError({"cliente": "Se debe proporcionar un cliente existente o los datos para crear uno nuevo para la presencia."})
            if cliente_id and nuevo_cliente_info: raise serializers.ValidationError({"cliente": "Proporcione un cliente existente (ID) o datos para un nuevo cliente para la presencia, pero no ambos."})
        return data

class DefinicionMetaComisionSerializer(serializers.ModelSerializer):
    class Meta: model = DefinicionMetaComision; fields = '__all__'
class TablaComisionDirectaSerializer(serializers.ModelSerializer):
    class Meta: model = TablaComisionDirecta; fields = '__all__'
class ConfigGeneralSerializer(serializers.ModelSerializer):
    class Meta: model = ConfigGeneral; fields = '__all__'