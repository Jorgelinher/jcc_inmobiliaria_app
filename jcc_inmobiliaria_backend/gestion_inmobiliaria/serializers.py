# gestion_inmobiliaria/serializers.py
from rest_framework import serializers
from django.db import transaction
from .models import (
    Lote, Cliente, Asesor, Venta, ActividadDiaria,
    DefinicionMetaComision, TablaComisionDirecta, ConfigGeneral, LogAuditoriaCambio,
    RegistroPago, Presencia,
    PlanPagoVenta, CuotaPlanPago
)

class LoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lote
        fields = [
            'id_lote', 'ubicacion_proyecto', 'manzana', 'numero_lote', 'etapa', 
            'area_m2', 'precio_lista_soles', 
            'precio_credito_12_meses_soles', 'precio_credito_24_meses_soles', 'precio_credito_36_meses_soles',
            'precio_lista_dolares', 'estado_lote', 
            'colindancias', 'partida_registral', 'observaciones_lote', 
            'fecha_creacion', 'ultima_modificacion'
        ]

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
    class Meta:
        model = Cliente
        fields = ['id_cliente', 'nombres_completos_razon_social', 'tipo_documento', 'numero_documento', 'email_principal', 'telefono_principal', 'direccion']

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

    class Meta:
        model = CuotaPlanPago
        fields = [
            'id_cuota', 'plan_pago_venta', 'numero_cuota', 'fecha_vencimiento', 
            'monto_programado', 'monto_pagado', 'estado_cuota', 'estado_cuota_display',
            'fecha_pago_efectivo', 'saldo_cuota'
        ]
        read_only_fields = ('id_cuota', 'estado_cuota_display', 'saldo_cuota', 'plan_pago_venta')
        extra_kwargs = {
            'monto_pagado': {'required': False},
            'estado_cuota': {'required': False},
            'fecha_pago_efectivo': {'required': False, 'allow_null': True},
        }

class PlanPagoVentaSerializer(serializers.ModelSerializer):
    cuotas = CuotaPlanPagoSerializer(many=True, read_only=True)
    venta_id_str = serializers.CharField(source='venta.id_venta', read_only=True)
    venta_cliente_nombre = serializers.CharField(source='venta.cliente.nombres_completos_razon_social', read_only=True)
    venta_lote_id = serializers.CharField(source='venta.lote.id_lote', read_only=True)

    class Meta:
        model = PlanPagoVenta
        fields = [
            'id_plan_pago', 'venta', 'venta_id_str', 'venta_cliente_nombre', 'venta_lote_id',
            'monto_total_credito', 'numero_cuotas',
            'monto_cuota_regular_original', # <--- CORRECCIÓN AQUÍ
            'fecha_inicio_pago_cuotas', 
            'observaciones', 'fecha_creacion', 'ultima_modificacion',
            'cuotas'
        ]
        read_only_fields = ('id_plan_pago', 'fecha_creacion', 'ultima_modificacion', 'venta_id_str', 'cuotas', 'venta_cliente_nombre', 'venta_lote_id')

class RegistroPagoSerializer(serializers.ModelSerializer):
    cuota_info = CuotaPlanPagoSerializer(source='cuota_plan_pago_cubierta', read_only=True, allow_null=True)

    class Meta:
        model = RegistroPago
        fields = [
            'id_pago', 'venta', 'fecha_pago', 'monto_pago', 'metodo_pago', 
            'referencia_pago', 'notas_pago', 'fecha_registro_pago', 
            'cuota_plan_pago_cubierta', 'cuota_info'
        ]
        read_only_fields = ('fecha_registro_pago', 'cuota_info')
        extra_kwargs = {
            'cuota_plan_pago_cubierta': {'required': False, 'allow_null': True}
        }

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

        if tipo_venta == Venta.TIPO_VENTA_CREDITO:
            if not plazo_meses or plazo_meses not in [12, 24, 36]:
                raise serializers.ValidationError({"plazo_meses_credito": "Debe seleccionar un plazo válido (12, 24, o 36 meses) para ventas a crédito."})
            if lote:
                if plazo_meses == 12 and not lote.precio_credito_12_meses_soles:
                    raise serializers.ValidationError({"plazo_meses_credito": f"El lote {lote.id_lote} no tiene precio definido para 12 meses."})
                elif plazo_meses == 24 and not lote.precio_credito_24_meses_soles:
                    raise serializers.ValidationError({"plazo_meses_credito": f"El lote {lote.id_lote} no tiene precio definido para 24 meses."})
                elif plazo_meses == 36 and not lote.precio_credito_36_meses_soles:
                    raise serializers.ValidationError({"plazo_meses_credito": f"El lote {lote.id_lote} no tiene precio definido para 36 meses."})
        elif tipo_venta == Venta.TIPO_VENTA_CONTADO:
             data['plazo_meses_credito'] = 0
        return data

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
        fields = [ 'id_presencia', 'cliente', 'cliente_detalle', 'nuevo_cliente_data', 'fecha_hora_presencia', 'proyecto_interes', 'lote_interes_inicial', 'lote_interes_inicial_id_str', 'asesor_captacion_opc', 'asesor_captacion_opc_nombre', 'medio_captacion', 'medio_captacion_display', 'asesor_call_agenda', 'asesor_call_agenda_nombre', 'asesor_liner', 'asesor_liner_nombre', 'asesor_closer', 'asesor_closer_nombre', 'modalidad', 'modalidad_display', 'status_presencia', 'status_presencia_display', 'resultado_interaccion', 'resultado_interaccion_display', 'venta_asociada', 'venta_asociada_id_str', 'observaciones', 'fecha_registro_sistema', 'ultima_modificacion' ]
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