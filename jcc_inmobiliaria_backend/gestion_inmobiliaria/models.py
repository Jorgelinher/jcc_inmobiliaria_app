# gestion_inmobiliaria/models.py
from django.db import models, transaction
from django.utils import timezone
from django.db.models import Sum, Q
from decimal import Decimal, ROUND_HALF_UP
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from dateutil.relativedelta import relativedelta 
from uuid import uuid4

# --- Función Auxiliar para generar IDs Correlativos ---
def generar_siguiente_id(modelo, prefijo, longitud_numero=4):
    ultimo_objeto = modelo.objects.all().order_by('pk').last()
    if not ultimo_objeto:
        return f"{prefijo}{'1'.zfill(longitud_numero)}"
    
    ultimo_id_str = str(ultimo_objeto.pk) 
    
    parte_numerica_str = ""
    if ultimo_id_str.startswith(prefijo):
        parte_numerica_str = ultimo_id_str[len(prefijo):]
    elif prefijo and ultimo_id_str.replace(prefijo, "").isdigit():
        parte_numerica_str = ultimo_id_str.replace(prefijo, "")
    elif ultimo_id_str.isdigit():
        parte_numerica_str = ultimo_id_str
    else:
        max_num = 0
        for obj_pk_str in modelo.objects.values_list('pk', flat=True).order_by('pk'):
            current_num_str = str(obj_pk_str)
            if current_num_str.startswith(prefijo):
                current_num_part = current_num_str[len(prefijo):]
                if current_num_part.isdigit():
                    max_num = max(max_num, int(current_num_part))
        siguiente_numero = max_num + 1
        if siguiente_numero == 1 and modelo.objects.filter(pk__startswith=prefijo).exists():
             siguiente_numero = modelo.objects.filter(pk__startswith=prefijo).count() + 1
        return f"{prefijo}{str(siguiente_numero).zfill(longitud_numero)}"

    try:
        ultimo_numero = int(parte_numerica_str)
        siguiente_numero = ultimo_numero + 1
    except ValueError:
        siguiente_numero = modelo.objects.count() + 1
        
    return f"{prefijo}{str(siguiente_numero).zfill(longitud_numero)}"

# --- MODELOS PRINCIPALES ---
class Lote(models.Model):
    ESTADO_LOTE_CHOICES = [('Disponible', 'Disponible'), ('Reservado', 'Reservado'), ('Vendido', 'Vendido')]
    id_lote = models.CharField(max_length=50, unique=True, primary_key=True, verbose_name="ID Lote", editable=False)
    ubicacion_proyecto = models.CharField(max_length=255, verbose_name="Ubicación del Proyecto")
    manzana = models.CharField(max_length=50, blank=True, null=True, verbose_name="Manzana")
    numero_lote = models.CharField(max_length=50, blank=True, null=True, verbose_name="Número de Lote")
    etapa = models.PositiveSmallIntegerField(verbose_name="Etapa del Lote (Número)", blank=True, null=True, help_text="Número de la etapa del lote dentro del proyecto (ej: 1, 2, 3)")
    area_m2 = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Área (m²)")
    precio_lista_soles = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, verbose_name="Precio Contado (S/.)")
    precio_credito_12_meses_soles = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, verbose_name="Precio Crédito 12 Meses (S/.)")
    precio_credito_24_meses_soles = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, verbose_name="Precio Crédito 24 Meses (S/.)")
    precio_credito_36_meses_soles = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, verbose_name="Precio Crédito 36 Meses (S/.)")
    precio_lista_dolares = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, verbose_name="Precio Lista ($) (Opcional)")
    precio_credito_12_meses_dolares = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, verbose_name="Precio Crédito 12 Meses ($)")
    precio_credito_24_meses_dolares = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, verbose_name="Precio Crédito 24 Meses ($)")
    precio_credito_36_meses_dolares = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, verbose_name="Precio Crédito 36 Meses ($)")
    estado_lote = models.CharField(max_length=20, choices=ESTADO_LOTE_CHOICES, default='Disponible', verbose_name="Estado del Lote")
    colindancias = models.TextField(blank=True, null=True, verbose_name="Colindancias")
    partida_registral = models.CharField(max_length=100, blank=True, null=True, verbose_name="Partida Registral")
    observaciones_lote = models.TextField(blank=True, null=True, verbose_name="Observaciones del Lote")
    fecha_creacion = models.DateTimeField(default=timezone.now, editable=False)
    ultima_modificacion = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.id_lote: self.id_lote = generar_siguiente_id(Lote, 'L', 4)
        super().save(*args, **kwargs)
    def __str__(self):
        etapa_str = f" - Etapa: {self.etapa}" if self.etapa is not None else ""
        return f"{self.id_lote} ({self.ubicacion_proyecto}{etapa_str} - Mz: {self.manzana or 'S/M'} Lt: {self.numero_lote or 'S/N'})"
    class Meta: verbose_name = "Lote"; verbose_name_plural = "Lotes"; ordering = ['ubicacion_proyecto', 'etapa', 'manzana', 'numero_lote']

class Cliente(models.Model):
    TIPO_DOCUMENTO_CHOICES = [('DNI', 'DNI'), ('RUC', 'RUC'), ('CE', 'Carnet de Extranjería'), ('Pasaporte', 'Pasaporte'), ('Otro', 'Otro')]
    ESTADO_CIVIL_CHOICES = [('Soltero(a)', 'Soltero(a)'), ('Casado(a)', 'Casado(a)'), ('Viudo(a)', 'Viudo(a)'), ('Divorciado(a)', 'Divorciado(a)'), ('Conviviente', 'Conviviente')]
    id_cliente = models.CharField(max_length=50, unique=True, primary_key=True, verbose_name="ID Cliente", editable=False)
    tipo_documento = models.CharField(max_length=15, choices=TIPO_DOCUMENTO_CHOICES, verbose_name="Tipo de Documento")
    numero_documento = models.CharField(max_length=20, unique=False, blank=True, null=True, verbose_name="Número de Documento")
    nombres_completos_razon_social = models.CharField(max_length=255, verbose_name="Nombres Completos / Razón Social")
    fecha_nacimiento_constitucion = models.DateField(blank=True, null=True, verbose_name="Fecha Nacimiento/Constitución")
    direccion = models.CharField(max_length=255, blank=True, null=True, verbose_name="Dirección")
    distrito = models.CharField(max_length=100, blank=True, null=True)
    provincia = models.CharField(max_length=100, blank=True, null=True)
    departamento = models.CharField(max_length=100, blank=True, null=True)
    telefono_principal = models.CharField(max_length=20, blank=True, null=True, verbose_name="Teléfono Principal")
    telefono_secundario = models.CharField(max_length=20, blank=True, null=True, verbose_name="Teléfono Secundario")
    email_principal = models.EmailField(max_length=255, blank=True, null=True, verbose_name="Email Principal")
    email_secundario = models.EmailField(max_length=255, blank=True, null=True, verbose_name="Email Secundario")
    estado_civil = models.CharField(max_length=20, choices=ESTADO_CIVIL_CHOICES, blank=True, null=True, verbose_name="Estado Civil")
    profesion_ocupacion = models.CharField(max_length=100, blank=True, null=True, verbose_name="Profesión/Ocupación")
    fecha_registro = models.DateTimeField(default=timezone.now, editable=False)
    ultima_modificacion = models.DateTimeField(auto_now=True)
    def save(self, *args, **kwargs):
        if not self.id_cliente: self.id_cliente = generar_siguiente_id(Cliente, 'CLI', 4)
        super().save(*args, **kwargs)
    def __str__(self): return f"{self.nombres_completos_razon_social} ({self.id_cliente})"
    class Meta: verbose_name = "Cliente"; verbose_name_plural = "Clientes"; ordering = ['nombres_completos_razon_social']

class Asesor(models.Model):
    TIPO_ASESOR_CHOICES = [('Junior', 'Junior'), ('Socio', 'Socio')]
    ESTADO_CIVIL_ASESOR_CHOICES = Cliente.ESTADO_CIVIL_CHOICES
    id_asesor = models.CharField(max_length=50, unique=True, primary_key=True, verbose_name="ID Asesor", editable=False)
    nombre_asesor = models.CharField(max_length=255, verbose_name="Nombre Completo del Asesor")
    dni = models.CharField(max_length=8, unique=True, blank=True, null=True, verbose_name="DNI")
    fecha_nacimiento = models.DateField(blank=True, null=True, verbose_name="Fecha de Nacimiento")
    estado_civil = models.CharField(max_length=20, choices=ESTADO_CIVIL_ASESOR_CHOICES, blank=True, null=True, verbose_name="Estado Civil")
    numero_hijos = models.PositiveSmallIntegerField(default=0, blank=True, null=True, verbose_name="Número de Hijos")
    direccion = models.CharField(max_length=255, blank=True, null=True, verbose_name="Dirección del Asesor")
    distrito = models.CharField(max_length=100, blank=True, null=True, verbose_name="Distrito del Asesor")
    telefono_personal = models.CharField(max_length=20, blank=True, null=True, verbose_name="Teléfono Personal")
    email_personal = models.EmailField(max_length=255, blank=True, null=True, verbose_name="Email Personal")
    banco_preferido = models.CharField(max_length=100, blank=True, null=True, verbose_name="Banco Preferido")
    numero_cuenta_bancaria = models.CharField(max_length=50, blank=True, null=True, verbose_name="Número de Cuenta Bancaria")
    cci_cuenta_bancaria = models.CharField(max_length=50, blank=True, null=True, verbose_name="CCI Cuenta Bancaria")
    id_referidor = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='referidos', verbose_name="ID Referidor (Líder)")
    fecha_ingreso = models.DateField(verbose_name="Fecha de Ingreso a la Empresa")
    tipo_asesor_actual = models.CharField(max_length=10, choices=TIPO_ASESOR_CHOICES, verbose_name="Tipo Asesor Actual")
    fecha_cambio_socio = models.DateField(null=True, blank=True, verbose_name="Fecha Cambio a Socio (si aplica)")
    observaciones_asesor = models.TextField(blank=True, null=True, verbose_name="Observaciones Adicionales")
    fecha_registro_sistema = models.DateTimeField(default=timezone.now, editable=False, verbose_name="Fecha de Registro en Sistema")
    ultima_modificacion_sistema = models.DateTimeField(auto_now=True, verbose_name="Última Modificación en Sistema")
    BANCO_CHOICES = [
        ('BCP', 'Banco de Crédito BCP'),
        ('Interbank', 'Interbank'),
        ('Scotiabank', 'Scotiabank'),
        ('BBVA', 'BBVA Continental'),
        ('Otro', 'Otro Banco (especificar en notas)'),
    ]
    banco = models.CharField(
        max_length=50, 
        choices=BANCO_CHOICES, 
        blank=True, 
        null=True, 
        verbose_name="Banco Principal"
    )
    numero_cuenta_bancaria = models.CharField(
        max_length=50, 
        blank=True, 
        null=True, 
        verbose_name="Número de Cuenta Bancaria Principal"
    )
    cci_cuenta_bancaria = models.CharField(
        max_length=50, 
        blank=True, 
        null=True, 
        verbose_name="CCI Cuenta Bancaria Principal"
    )
    # El campo 'cuenta_bancaria_otros' puede mantenerse para flexibilidad
    cuenta_bancaria_otros = models.TextField(
        blank=True, 
        null=True, 
        verbose_name="Otras Cuentas o Detalles Bancarios Adicionales"
    )
    def save(self, *args, **kwargs):
        if not self.id_asesor: self.id_asesor = generar_siguiente_id(Asesor, 'A', 4)
        super().save(*args, **kwargs)
    def __str__(self): return f"{self.nombre_asesor} ({self.id_asesor})"
    class Meta: verbose_name = "Asesor"; verbose_name_plural = "Asesores"; ordering = ['nombre_asesor']

class Venta(models.Model):
    TIPO_VENTA_CONTADO = 'contado'
    TIPO_VENTA_CREDITO = 'credito'
    TIPO_VENTA_CHOICES = [(TIPO_VENTA_CONTADO, 'Contado'), (TIPO_VENTA_CREDITO, 'Crédito')]
    PLAN_PAGO_CHOICES = [(0, 'Contado / Sin Plan'), (12, 'Crédito 12 Meses'), (24, 'Crédito 24 Meses'), (36, 'Crédito 36 Meses'),]
    PARTICIPACION_JUNIOR_CHOICES = [('opc y call', 'OPC y Call'), ('opc, call y línea', 'OPC, Call y Línea'), ('opc, call, front', 'OPC, Call, Front'), ('N/A', 'No Aplica')]
    PARTICIPACION_SOCIO_CHOICES = [('front', 'Front'), ('cierre', 'Cierre'), ('no participa', 'No Participa'), ('N/A', 'No Aplica')]
    STATUS_VENTA_SEPARACION = 'separacion'; STATUS_VENTA_PROCESABLE = 'procesable'; STATUS_VENTA_ANULADO = 'anulado'; STATUS_VENTA_COMPLETADA = 'completada'
    STATUS_VENTA_CHOICES = [(STATUS_VENTA_SEPARACION, 'Separación'),(STATUS_VENTA_PROCESABLE, 'Procesable'),(STATUS_VENTA_COMPLETADA, 'Completada'), (STATUS_VENTA_ANULADO, 'Anulado'),]
    
    id_venta = models.CharField(max_length=50, unique=True, primary_key=True, verbose_name="ID Venta", editable=False)
    fecha_venta = models.DateField(verbose_name="Fecha de Venta")
    lote = models.ForeignKey(Lote, on_delete=models.PROTECT, related_name='ventas_lote', verbose_name="Lote Vendido")
    cliente = models.ForeignKey(Cliente, on_delete=models.PROTECT, related_name='compras_cliente', verbose_name="Cliente")
    valor_lote_venta = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Valor de Venta Total (S/.)")
    tipo_venta = models.CharField(max_length=10, choices=TIPO_VENTA_CHOICES, default=TIPO_VENTA_CONTADO, verbose_name="Tipo de Venta")
    plazo_meses_credito = models.PositiveSmallIntegerField(choices=PLAN_PAGO_CHOICES, default=0, verbose_name="Plazo de Crédito (Meses)", help_text="0 para Contado. Seleccionar plazo si el tipo de venta es Crédito.")
    vendedor_principal = models.ForeignKey(Asesor, on_delete=models.PROTECT, related_name='ventas_realizadas', verbose_name="Vendedor Principal", null=True, blank=True)
    participacion_junior_venta = models.CharField(max_length=50, choices=PARTICIPACION_JUNIOR_CHOICES, blank=True, null=True, verbose_name="Participación Junior")
    id_socio_participante = models.ForeignKey(Asesor, on_delete=models.SET_NULL, null=True, blank=True, related_name='participaciones_socio', verbose_name="ID Socio Participante")
    participacion_socio_venta = models.CharField(max_length=20, choices=PARTICIPACION_SOCIO_CHOICES, blank=True, null=True, verbose_name="Participación Socio")
    modalidad_presentacion = models.CharField(max_length=100, blank=True, null=True, verbose_name="Modalidad Presentación")
    status_venta = models.CharField(max_length=20, choices=STATUS_VENTA_CHOICES, default=STATUS_VENTA_SEPARACION, verbose_name="Status de la Venta")
    monto_pagado_actual = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Monto Pagado Actual (S/.)")
    cuota_inicial_requerida = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Cuota Inicial Requerida (S/.)")
    
    cliente_firmo_contrato = models.BooleanField(default=False, verbose_name="¿Cliente Firmó Contrato?")
    fecha_firma_contrato = models.DateField(null=True, blank=True, verbose_name="Fecha de Firma de Contrato")

    notas = models.TextField(blank=True, null=True)
    fecha_registro_venta = models.DateTimeField(default=timezone.now, editable=False)
    porcentaje_comision_vendedor_principal_personalizado = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal('0.00')), MaxValueValidator(Decimal('100.00'))], verbose_name="Porcentaje Comisión Personalizada Vendedor Principal (%)", help_text="Dejar en blanco para usar tabla de comisiones. Ingresar valor entre 0.00 y 100.00.")
    porcentaje_comision_socio_personalizado = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal('0.00')), MaxValueValidator(Decimal('100.00'))], verbose_name="Porcentaje Comisión Personalizada Socio Participante (%)", help_text="Dejar en blanco para usar tabla de comisiones. Aplicable si hay socio participante. Ingresar valor entre 0.00 y 100.00.")

    precio_dolares = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, verbose_name="Precio Venta ($)")
    tipo_cambio = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True, verbose_name="Tipo de Cambio (S/ por $)")

    @property
    def saldo_pendiente(self):
        valor_venta = self.valor_lote_venta if self.valor_lote_venta is not None else Decimal('0.00')
        monto_pagado = self.monto_pagado_actual if self.monto_pagado_actual is not None else Decimal('0.00')
        return valor_venta - monto_pagado
    
    def actualizar_status_y_monto_pagado(self, save_instance=False):
        total_pagado_registros = self.registros_pago.aggregate(total=Sum('monto_pago'))['total'] or Decimal('0.00')
        monto_pagado_previo = self.monto_pagado_actual
        status_previo = self.status_venta
        self.monto_pagado_actual = total_pagado_registros
        
        # Actualizar status_venta basado en pagos y tipo de venta
        if self.status_venta not in [self.STATUS_VENTA_ANULADO, self.STATUS_VENTA_COMPLETADA]:
            if self.valor_lote_venta > Decimal('0.00') and self.monto_pagado_actual >= self.valor_lote_venta :
                self.status_venta = self.STATUS_VENTA_COMPLETADA
            elif self.tipo_venta == self.TIPO_VENTA_CREDITO:
                if self.monto_pagado_actual >= self.cuota_inicial_requerida and self.cuota_inicial_requerida > Decimal('0.00'):
                    self.status_venta = self.STATUS_VENTA_PROCESABLE
                elif self.monto_pagado_actual > Decimal('0.00'):
                    self.status_venta = self.STATUS_VENTA_SEPARACION
            elif self.tipo_venta == self.TIPO_VENTA_CONTADO:
                if self.monto_pagado_actual > Decimal('0.00'): # Cualquier pago para contado (sin CI especificada) la hace procesable
                     self.status_venta = self.STATUS_VENTA_PROCESABLE 
        
        # La lógica de actualizar estado del lote se moverá a una señal post_save de Venta.
        # self._actualizar_estado_lote_asociado() # Ya no se llama aquí directamente

        if save_instance and (self.monto_pagado_actual != monto_pagado_previo or self.status_venta != status_previo):
            print(f"[Venta {self.id_venta}] Método actualizar_status_y_monto_pagado llamando a super().save con update_fields: monto_pagado={self.monto_pagado_actual}, status={self.status_venta}")
            super(Venta, self).save(update_fields=['monto_pagado_actual', 'status_venta'])

    def marcar_como_firmada(self, fecha_firma=None):
        """Marca la venta como firmada y guarda."""
        if not self.cliente_firmo_contrato:
            self.cliente_firmo_contrato = True
            self.fecha_firma_contrato = fecha_firma if fecha_firma else timezone.now().date()
            print(f"[Venta {self.id_venta}] Marcada como FIRMADA en fecha {self.fecha_firma_contrato}.")
            # Guardar estos campos específicos. El post_save signal se encargará de actualizar el lote.
            super(Venta, self).save(update_fields=['cliente_firmo_contrato', 'fecha_firma_contrato'])
            # La señal post_save de Venta se disparará y llamará a actualizar_estado_lote_por_venta
        else:
            print(f"[Venta {self.id_venta}] Ya estaba marcada como firmada.")


    def save(self, *args, **kwargs):
        update_fields = kwargs.get('update_fields')
        is_new_instance = not self.pk

        if not self.id_venta: 
            self.id_venta = generar_siguiente_id(Venta, 'V', 5)
        
        recalculate_valor_lote = is_new_instance or not update_fields or \
                                 (update_fields and any(field in update_fields for field in ['lote', 'tipo_venta', 'plazo_meses_credito']))

        if recalculate_valor_lote and self.lote:
            proyecto = self.lote.ubicacion_proyecto.strip().lower() if self.lote.ubicacion_proyecto else ''
            if ('aucallama' in proyecto) or ('oasis 2' in proyecto):
                if self.precio_dolares and self.tipo_cambio:
                    self.valor_lote_venta = (self.precio_dolares * self.tipo_cambio).quantize(Decimal('0.01'))
                else:
                    self.valor_lote_venta = Decimal('0.00')
            else:
                if self.tipo_venta == self.TIPO_VENTA_CONTADO:
                    self.valor_lote_venta = self.lote.precio_lista_soles
                    if self.plazo_meses_credito != 0: self.plazo_meses_credito = 0
                elif self.tipo_venta == self.TIPO_VENTA_CREDITO:
                    precio_seleccionado = None
                    if self.plazo_meses_credito == 12: precio_seleccionado = self.lote.precio_credito_12_meses_soles
                    elif self.plazo_meses_credito == 24: precio_seleccionado = self.lote.precio_credito_24_meses_soles
                    elif self.plazo_meses_credito == 36: precio_seleccionado = self.lote.precio_credito_36_meses_soles
                    
                    if precio_seleccionado is not None: 
                        self.valor_lote_venta = precio_seleccionado
                    elif is_new_instance or not self.valor_lote_venta or self.valor_lote_venta == Decimal('0.00'):
                        self.valor_lote_venta = self.lote.precio_lista_soles 
        super().save(*args, **kwargs)

    def __str__(self): return f"Venta {self.id_venta} - Lote {self.lote.id_lote if self.lote else 'N/A'} ({self.get_status_venta_display()})"
    class Meta: verbose_name = "Venta"; verbose_name_plural = "Ventas"; ordering = ['-fecha_venta']



class PlanPagoVenta(models.Model):
    # ... (como estaba, incluyendo el método recalcular_cuotas_pendientes) ...
    id_plan_pago = models.AutoField(primary_key=True)
    venta = models.OneToOneField(Venta, on_delete=models.CASCADE, related_name='plan_pago_venta', verbose_name="Venta Asociada")
    monto_total_credito = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Monto Total del Crédito (Post Cuota Inicial)")
    numero_cuotas = models.PositiveSmallIntegerField(verbose_name="Número de Cuotas")
    monto_cuota_regular_original = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Monto de Cuota Regular Original")
    fecha_inicio_pago_cuotas = models.DateField(verbose_name="Fecha de Vencimiento de Primera Cuota")
    observaciones = models.TextField(blank=True, null=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    ultima_modificacion = models.DateTimeField(auto_now=True)
    
    # Campos para almacenar los valores originales
    _numero_cuotas_original = None
    _monto_cuota_regular_original_backup = None
    
    def save(self, *args, **kwargs):
        # Si es la primera vez que se guarda (created=True), guardar los valores originales
        if not self.pk:  # Nuevo registro
            self._numero_cuotas_original = self.numero_cuotas
            self._monto_cuota_regular_original_backup = self.monto_cuota_regular_original
            print(f"[PlanPagoVenta] Guardando valores originales: {self.numero_cuotas} cuotas, {self.monto_cuota_regular_original} por cuota")
        
        super().save(*args, **kwargs)
    
    def __str__(self): return f"Plan de Pago para Venta {self.venta.id_venta} - {self.numero_cuotas} cuotas"
    @transaction.atomic
    def recalcular_cuotas_pendientes(self, save_cuotas=True):
        print(f"\n[PlanPagoVenta ID {self.id_plan_pago}] >>> INICIO recalcular_cuotas_pendientes para Venta ID: {self.venta.id_venta}")
        
        # Determinar si es proyecto en dólares (Aucallama/Oasis 2)
        es_proyecto_dolares = (
            self.venta and self.venta.lote and (
                'aucallama' in self.venta.lote.ubicacion_proyecto.lower() or
                'oasis 2' in self.venta.lote.ubicacion_proyecto.lower()
            )
        )
        
        # Verificar si hay pagos registrados
        if es_proyecto_dolares:
            monto_total_pagado = sum(p.monto_pago_dolares or Decimal('0.00') for p in self.venta.registros_pago.all())
        else:
            monto_total_pagado = self.venta.monto_pagado_actual or Decimal('0.00')
        
        print(f"  Monto total pagado: {monto_total_pagado}")
        
        # Si no hay pagos, restaurar el plan a su estado inicial original
        if monto_total_pagado <= Decimal('0.00'):
            print(f"  No hay pagos registrados. Restaurando plan a estado inicial original...")
            
            # Eliminar todas las cuotas actuales
            cuotas_actuales = self.cuotas.all()
            if cuotas_actuales.exists():
                print(f"  Eliminando {cuotas_actuales.count()} cuotas actuales...")
                cuotas_actuales.delete()
            
            # Calcular el número de cuotas original basándose en el plazo de crédito de la venta
            numero_cuotas_original = self.venta.plazo_meses_credito
            if numero_cuotas_original == 0:
                # Si no hay plazo definido, usar 24 cuotas como valor por defecto
                numero_cuotas_original = 24
                print(f"  No se encontró plazo de crédito, usando 24 cuotas por defecto")
            
            print(f"  Número de cuotas original: {numero_cuotas_original}")
            
            # Calcular el monto de cuota regular original
            if es_proyecto_dolares:
                precio_dolares = self.venta.precio_dolares or Decimal('0.00')
                cuota_inicial_dolares = Decimal('0.00')
                if self.venta.cuota_inicial_requerida and self.venta.cuota_inicial_requerida > Decimal('0.00'):
                    if self.venta.tipo_cambio and self.venta.tipo_cambio > Decimal('0.00'):
                        cuota_inicial_dolares = (self.venta.cuota_inicial_requerida / self.venta.tipo_cambio).quantize(Decimal('0.01'))
                monto_financiado = precio_dolares - cuota_inicial_dolares
            else:
                monto_financiado = self.monto_total_credito
            
            monto_cuota_original = (monto_financiado / Decimal(numero_cuotas_original)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            
            # Restaurar el monto_cuota_regular_original
            self.monto_cuota_regular_original = monto_cuota_original
            print(f"  Monto cuota regular restaurado a: {monto_cuota_original}")
            
            # Recrear las cuotas originales
            from datetime import date, timedelta
            fecha_inicio = self.fecha_inicio_pago_cuotas
            
            for i in range(1, numero_cuotas_original + 1):
                fecha_vencimiento = fecha_inicio + timedelta(days=30 * (i - 1))
                
                cuota = CuotaPlanPago(
                    plan_pago_venta=self,
                    numero_cuota=i,
                    fecha_vencimiento=fecha_vencimiento,
                    monto_programado=monto_cuota_original,
                    monto_pagado=Decimal('0.00'),
                    estado_cuota='pendiente',
                    fecha_pago_efectivo=None
                )
                
                if es_proyecto_dolares:
                    cuota.monto_programado_dolares = monto_cuota_original
                
                cuota.save()
                print(f"    Cuota N°{i} recreada: monto={monto_cuota_original}, vencimiento={fecha_vencimiento}")
            
            # Actualizar el plan
            self.numero_cuotas = numero_cuotas_original
            self.ultima_modificacion = timezone.now()
            self.save(update_fields=['ultima_modificacion', 'numero_cuotas', 'monto_cuota_regular_original'])
            
            print(f"  Plan restaurado a estado inicial: {numero_cuotas_original} cuotas de {monto_cuota_original}")
            print(f"[PlanPagoVenta ID {self.id_plan_pago}] <<< FIN recalcular_cuotas_pendientes (RESTAURADO)")
            return
        
        # Si hay pagos, continuar con la lógica normal de recálculo
        if es_proyecto_dolares:
            # Para proyectos en dólares, calcular el monto financiado en dólares
            precio_dolares = self.venta.precio_dolares or Decimal('0.00')
            cuota_inicial_dolares = Decimal('0.00')
            
            # Si hay cuota inicial, convertirla de soles a dólares usando el tipo de cambio
            if self.venta.cuota_inicial_requerida and self.venta.cuota_inicial_requerida > Decimal('0.00'):
                if self.venta.tipo_cambio and self.venta.tipo_cambio > Decimal('0.00'):
                    cuota_inicial_dolares = (self.venta.cuota_inicial_requerida / self.venta.tipo_cambio).quantize(Decimal('0.01'))
            
            monto_original_a_financiar_por_plan = precio_dolares - cuota_inicial_dolares
            print(f"  [DÓLARES] Monto original a financiar (precio_dolares - cuota_inicial_dolares): {monto_original_a_financiar_por_plan}")
            
            # Calcular monto total pagado en dólares
            monto_total_pagado_en_dolares = sum(p.monto_pago_dolares or Decimal('0.00') for p in self.venta.registros_pago.all())
            print(f"  [DÓLARES] Monto total pagado en dólares: {monto_total_pagado_en_dolares}")
            
            saldo_capital_a_redistribuir = monto_original_a_financiar_por_plan - monto_total_pagado_en_dolares
            print(f"  [DÓLARES] Saldo de capital del plan a redistribuir: {saldo_capital_a_redistribuir}")
        else:
            # Para proyectos en soles, usar la lógica original
            monto_original_a_financiar_por_plan = self.monto_total_credito
            monto_total_pagado = self.venta.monto_pagado_actual or Decimal('0.00')
            print(f"  [SOLES] Monto original a financiar (del plan): {monto_original_a_financiar_por_plan}")
            print(f"  [SOLES] Monto total pagado: {monto_total_pagado}")
            
            saldo_capital_a_redistribuir = monto_original_a_financiar_por_plan - monto_total_pagado
            print(f"  [SOLES] Saldo de capital del plan a redistribuir: {saldo_capital_a_redistribuir}")
        
        if saldo_capital_a_redistribuir < Decimal('0.00'):
            print(f"  Advertencia: Saldo a redistribuir calculado como {saldo_capital_a_redistribuir}, ajustando a 0.")
            saldo_capital_a_redistribuir = Decimal('0.00')
        
        # NUEVA LÓGICA: Eliminar cuotas que ya no son necesarias basándose en el monto total pagado
        cuotas_a_eliminar = []
        
        if es_proyecto_dolares:
            monto_total_pagado = sum(p.monto_pago_dolares or Decimal('0.00') for p in self.venta.registros_pago.all())
        else:
            monto_total_pagado = self.venta.monto_pagado_actual or Decimal('0.00')
        
        monto_acumulado_cuotas = Decimal('0.00')
        
        for cuota in self.cuotas.all().order_by('numero_cuota'):
            if es_proyecto_dolares:
                monto_programado = cuota.monto_programado_dolares or Decimal('0.00')
            else:
                monto_programado = cuota.monto_programado
            
            # Si el monto total pagado cubre completamente esta cuota, marcarla para eliminar
            if monto_total_pagado >= (monto_acumulado_cuotas + monto_programado) and monto_programado > Decimal('0.00'):
                cuotas_a_eliminar.append(cuota)
                print(f"    Cuota N°{cuota.numero_cuota} marcada para eliminar (cubierta por pagos acumulados)")
            
            monto_acumulado_cuotas += monto_programado
        
        # Eliminar las cuotas que ya no son necesarias
        if cuotas_a_eliminar:
            print(f"  Eliminando {len(cuotas_a_eliminar)} cuotas que ya no son necesarias...")
            for cuota in cuotas_a_eliminar:
                cuota.delete()
            print(f"  {len(cuotas_a_eliminar)} cuotas eliminadas exitosamente.")
        
        # Recalcular números de cuota después de eliminar
        cuotas_restantes = self.cuotas.all().order_by('numero_cuota')
        for i, cuota in enumerate(cuotas_restantes, 1):
            if cuota.numero_cuota != i:
                cuota.numero_cuota = i
                cuota.save(update_fields=['numero_cuota'])
                print(f"    Cuota re-numerada: {cuota.numero_cuota} -> {i}")
        
        # Actualizar el número total de cuotas en el plan
        nuevo_numero_cuotas = self.cuotas.count()
        if self.numero_cuotas != nuevo_numero_cuotas:
            self.numero_cuotas = nuevo_numero_cuotas
            print(f"  Número de cuotas actualizado: {self.numero_cuotas} -> {nuevo_numero_cuotas}")
        
        # Obtener todas las cuotas restantes para recalcular
        cuotas_a_recalcular_lista = list(self.cuotas.all().order_by('numero_cuota'))
        num_cuotas_a_recalcular = len(cuotas_a_recalcular_lista)
        print(f"  Número de cuotas a recalcular: {num_cuotas_a_recalcular}")
        
        if num_cuotas_a_recalcular > 0:
            # Calcular el monto por cuota basándose en el saldo restante
            nuevo_monto_programado_cuota_bruto = saldo_capital_a_redistribuir / Decimal(num_cuotas_a_recalcular) if num_cuotas_a_recalcular > 0 else Decimal('0.00')
            nuevo_monto_programado_cuota_regular = nuevo_monto_programado_cuota_bruto.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            if nuevo_monto_programado_cuota_regular < Decimal('0.00'): nuevo_monto_programado_cuota_regular = Decimal('0.00')
            print(f"  Nuevo monto PROGRAMADO de cuota regular (recalculado): {nuevo_monto_programado_cuota_regular}")
            
            # Actualizar el monto_cuota_regular_original del plan con el nuevo valor recalculado
            if self.monto_cuota_regular_original != nuevo_monto_programado_cuota_regular:
                self.monto_cuota_regular_original = nuevo_monto_programado_cuota_regular
                print(f"  Monto cuota regular original actualizado: {self.monto_cuota_regular_original}")
            
            monto_acumulado_para_ajuste_final = Decimal('0.00')
            for i, cuota in enumerate(cuotas_a_recalcular_lista):
                cuota._monto_programado_changed_in_recalc = True 
                
                if i < num_cuotas_a_recalcular - 1:
                    if es_proyecto_dolares:
                        cuota.monto_programado_dolares = nuevo_monto_programado_cuota_regular
                        monto_acumulado_para_ajuste_final += cuota.monto_programado_dolares
                    else:
                        cuota.monto_programado = nuevo_monto_programado_cuota_regular
                        monto_acumulado_para_ajuste_final += cuota.monto_programado
                else: 
                    if es_proyecto_dolares:
                        cuota.monto_programado_dolares = saldo_capital_a_redistribuir - monto_acumulado_para_ajuste_final
                        if cuota.monto_programado_dolares < Decimal('0.00'): cuota.monto_programado_dolares = Decimal('0.00')
                    else:
                        cuota.monto_programado = saldo_capital_a_redistribuir - monto_acumulado_para_ajuste_final
                        if cuota.monto_programado < Decimal('0.00'): cuota.monto_programado = Decimal('0.00')
                
                # Resetear monto_pagado y estado de la cuota
                cuota.monto_pagado = Decimal('0.00')
                cuota.fecha_pago_efectivo = None
                cuota.actualizar_estado(save_instance=False) 
                
                if es_proyecto_dolares:
                    print(f"    Cuota N°{cuota.numero_cuota}: NUEVO monto_programado_dolares={cuota.monto_programado_dolares}, NUEVO estado={cuota.estado_cuota}")
                else:
                    print(f"    Cuota N°{cuota.numero_cuota}: NUEVO monto_programado={cuota.monto_programado}, NUEVO estado={cuota.estado_cuota}")
            
            if save_cuotas and cuotas_a_recalcular_lista:
                if es_proyecto_dolares:
                    campos_bulk_update = ['monto_programado_dolares', 'monto_pagado', 'estado_cuota', 'fecha_pago_efectivo']
                else:
                    campos_bulk_update = ['monto_programado', 'monto_pagado', 'estado_cuota', 'fecha_pago_efectivo']
                CuotaPlanPago.objects.bulk_update(cuotas_a_recalcular_lista, campos_bulk_update)
                print(f"  {len(cuotas_a_recalcular_lista)} cuotas actualizadas con bulk_update.")
        elif num_cuotas_a_recalcular == 0 and saldo_capital_a_redistribuir > Decimal('0.00'):
            print(f"  ADVERTENCIA: No hay cuotas no pagadas pero queda saldo de capital {saldo_capital_a_redistribuir} en Plan ID {self.id_plan_pago}.")
        
        self.ultima_modificacion = timezone.now()
        self.save(update_fields=['ultima_modificacion', 'numero_cuotas', 'monto_cuota_regular_original']) 
        print(f"  PlanPagoVenta ID {self.id_plan_pago} fecha de modificación actualizada.")
        print(f"[PlanPagoVenta ID {self.id_plan_pago}] <<< FIN recalcular_cuotas_pendientes")
    class Meta: verbose_name = "Plan de Pago de Venta"; verbose_name_plural = "Planes de Pago de Ventas"; ordering = ['-fecha_creacion']


class CuotaPlanPago(models.Model):
    # ... (como estaba, incluyendo el método actualizar_estado) ...
    ESTADO_CUOTA_CHOICES = [ ('pendiente', 'Pendiente'), ('pagada', 'Pagada'), ('parcialmente_pagada', 'Parcialmente Pagada'), ('atrasada', 'Atrasada'), ('vencida_no_pagada', 'Vencida No Pagada'), ('cancelada_con_excedente', 'Cancelada con Excedente') ]
    id_cuota = models.AutoField(primary_key=True)
    plan_pago_venta = models.ForeignKey(PlanPagoVenta, on_delete=models.CASCADE, related_name='cuotas', verbose_name="Plan de Pago Asociado")
    numero_cuota = models.PositiveSmallIntegerField(verbose_name="Número de Cuota")
    fecha_vencimiento = models.DateField(verbose_name="Fecha de Vencimiento")
    monto_programado = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Monto Programado de Cuota")
    monto_pagado = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'), verbose_name="Monto Pagado")
    estado_cuota = models.CharField(max_length=25, choices=ESTADO_CUOTA_CHOICES, default='pendiente', verbose_name="Estado de la Cuota")
    fecha_pago_efectivo = models.DateField(null=True, blank=True, verbose_name="Fecha de Último Pago/Pago Completo")
    monto_programado_dolares = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name="Monto Programado de Cuota ($)")
    @property
    def saldo_cuota(self):
        if self.plan_pago_venta and self.plan_pago_venta.venta and (
            'aucallama' in self.plan_pago_venta.venta.lote.ubicacion_proyecto.lower() or
            'oasis 2' in self.plan_pago_venta.venta.lote.ubicacion_proyecto.lower()
        ):
            return (self.monto_programado_dolares or 0) - sum(
                p.monto_pago_dolares or 0 for p in self.pagos_que_la_cubren.all()
            )
        else:
            return self.monto_programado - self.monto_pagado
    def actualizar_estado(self, save_instance=True):
        original_estado = self.estado_cuota
        original_fecha_pago = self.fecha_pago_efectivo
        original_monto_pagado_instancia = self.monto_pagado 
        original_monto_programado_instancia = self.monto_programado
        
        # Determinar si es proyecto en dólares (Aucallama/Oasis 2)
        es_proyecto_dolares = (
            self.plan_pago_venta and self.plan_pago_venta.venta and (
                'aucallama' in self.plan_pago_venta.venta.lote.ubicacion_proyecto.lower() or
                'oasis 2' in self.plan_pago_venta.venta.lote.ubicacion_proyecto.lower()
            )
        )
        
        # Para proyectos en dólares, usar monto_programado_dolares y calcular monto_pagado en dólares
        if es_proyecto_dolares:
            monto_programado = self.monto_programado_dolares or Decimal('0.00')
            monto_pagado = sum(p.monto_pago_dolares or Decimal('0.00') for p in self.pagos_que_la_cubren.all())
        else:
            monto_programado = self.monto_programado
            monto_pagado = self.monto_pagado
        
        if monto_programado <= Decimal('0.00'): 
            self.estado_cuota = 'pagada'
            if not self.fecha_pago_efectivo : self.fecha_pago_efectivo = timezone.now().date()
        elif monto_pagado >= monto_programado:
            self.estado_cuota = 'pagada' 
            if not self.fecha_pago_efectivo: self.fecha_pago_efectivo = timezone.now().date()
        elif monto_pagado > Decimal('0.00'):
            self.estado_cuota = 'parcialmente_pagada'
            self.fecha_pago_efectivo = None
        else: 
            self.estado_cuota = 'pendiente'
            self.fecha_pago_efectivo = None
        if self.estado_cuota not in ['pagada', 'cancelada_con_excedente'] and self.fecha_vencimiento < timezone.now().date():
            if self.estado_cuota == 'pendiente': self.estado_cuota = 'vencida_no_pagada'
            elif self.estado_cuota == 'parcialmente_pagada': self.estado_cuota = 'atrasada'
        campos_a_actualizar = []
        current_db_instance = None
        if not self._state.adding and self.pk:
            try: current_db_instance = self.__class__.objects.get(pk=self.pk)
            except self.__class__.DoesNotExist: pass
        if current_db_instance:
            if self.estado_cuota != current_db_instance.estado_cuota: campos_a_actualizar.append('estado_cuota')
            if self.fecha_pago_efectivo != current_db_instance.fecha_pago_efectivo: campos_a_actualizar.append('fecha_pago_efectivo')
            if self.monto_pagado != current_db_instance.monto_pagado: campos_a_actualizar.append('monto_pagado')
            if self.monto_programado != current_db_instance.monto_programado: campos_a_actualizar.append('monto_programado')
        else:
            if self.estado_cuota != original_estado: campos_a_actualizar.append('estado_cuota')
            if self.fecha_pago_efectivo != original_fecha_pago: campos_a_actualizar.append('fecha_pago_efectivo')
            if self.monto_pagado != original_monto_pagado_instancia : campos_a_actualizar.append('monto_pagado')
            if hasattr(self, '_monto_programado_changed_in_recalc') and self._monto_programado_changed_in_recalc:
                if 'monto_programado' not in campos_a_actualizar: campos_a_actualizar.append('monto_programado')
                delattr(self, '_monto_programado_changed_in_recalc')
        if save_instance and campos_a_actualizar and self.pk:
            print(f"    [Cuota ID {self.pk}] Guardando cambios en cuota. Campos: {list(set(campos_a_actualizar))}. Valores: E={self.estado_cuota}, FP={self.fecha_pago_efectivo}, MP={self.monto_pagado}, MProg={self.monto_programado}")
            super(CuotaPlanPago, self).save(update_fields=list(set(campos_a_actualizar)))
        elif save_instance and not campos_a_actualizar and self.pk:
            print(f"    [Cuota ID {self.pk}] No hubo cambios detectados para guardar en cuota.")
    def __str__(self): return f"Cuota {self.numero_cuota} - Venta {self.plan_pago_venta.venta.id_venta} - Vence: {self.fecha_vencimiento}"
    class Meta: verbose_name = "Cuota de Plan de Pago"; verbose_name_plural = "Cuotas de Planes de Pago"; ordering = ['plan_pago_venta', 'numero_cuota']; unique_together = ('plan_pago_venta', 'numero_cuota')

class ActividadDiaria(models.Model):
    # Cambiar id_actividad de AutoField a CharField y añadir lógica de generación
    id_actividad = models.CharField(max_length=50, unique=True, primary_key=True, verbose_name="ID Actividad", editable=False)
    fecha_actividad = models.DateField(verbose_name="Fecha de Actividad")
    asesor = models.ForeignKey(Asesor, on_delete=models.CASCADE, related_name='actividades_diarias_asesor', verbose_name="Asesor")
    datos_captados_opc = models.IntegerField(default=0, verbose_name="Datos Captados OPC")
    llamadas_realizadas = models.IntegerField(default=0, verbose_name="Datos Gestionados") # Etiqueta "Datos Gestionados"
    presencias_generadas = models.IntegerField(default=0, verbose_name="Presencias Generadas") # Se actualiza por señal de Presencia
    notas_actividad = models.TextField(blank=True, null=True, verbose_name="Notas de Actividad")

    def save(self, *args, **kwargs):
        if not self.id_actividad:
            # Define un prefijo para ActividadDiaria, por ejemplo 'ACT'
            self.id_actividad = generar_siguiente_id(ActividadDiaria, 'ACT', 5) # Ajusta longitud si es necesario
        super().save(*args, **kwargs)

    def __str__(self): 
        return f"Actividad ({self.id_actividad}) de {self.asesor.nombre_asesor if self.asesor else 'N/A'} el {self.fecha_actividad.strftime('%d/%m/%Y') if self.fecha_actividad else 'N/A'}"
    
    class Meta: 
        verbose_name = "Actividad Diaria"
        verbose_name_plural = "Actividades Diarias"
        ordering = ['-fecha_actividad', 'asesor']
        # unique_together ya no es necesario si id_actividad es el PK. 
        # Si quieres mantener la unicidad de fecha y asesor, puedes añadirla de nuevo si id_actividad no fuera el PK.
        # unique_together = ('fecha_actividad', 'asesor') # Comentado si id_actividad es PK único

class Presencia(models.Model):
    MEDIO_CAPTACION_CHOICES = [('campo_opc', 'Campo OPC'), ('redes_facebook', 'Redes Facebook'),('redes_instagram', 'Redes Instagram'), ('redes_tiktok', 'Redes TikTok'),('referido', 'Referido'), ('web', 'Página Web'), ('otro', 'Otro'),]
    MODALIDAD_PRESENCIA_CHOICES = [('presencial', 'Presencial'), ('virtual', 'Virtual')]
    STATUS_PRESENCIA_REALIZADA = 'realizada'
    STATUS_PRESENCIA_CHOICES = [('agendada', 'Agendada'), (STATUS_PRESENCIA_REALIZADA, 'Realizada'),('reprogramada', 'Reprogramada'), ('cancelada_cliente', 'Cancelada por Cliente'),('no_asistio', 'No Asistió'), ('caida_proceso', 'Caída en Proceso'),]
    RESULTADO_INTERACCION_CHOICES = [('interesado_seguimiento', 'Interesado - Programar Seguimiento'),('interesado_separacion', 'Interesado - Realizó Separación'),('interesado_venta_directa', 'Interesado - Venta Directa'),('no_interesado_objecion', 'No Interesado - Objeción'),('no_interesado_precio', 'No Interesado - Precio'),('no_interesado_otro', 'No Interesado - Otro'),]
    TIPO_TOUR_CHOICES = [
        ('tour', 'Tour (Presencia Real)'),
        ('no_tour', 'No Tour (Cita Confirmada, No Presencia)'),
    ]
    tipo_tour = models.CharField(
        max_length=10,
        choices=TIPO_TOUR_CHOICES,
        default='tour',
        verbose_name="Tipo de Presencia (Tour/No Tour)",
        help_text="Indica si la cita fue un Tour (presencia real) o No Tour (no califica como presencia)"
    )
    
    # Cambiar id_presencia de AutoField a CharField
    id_presencia = models.CharField(max_length=50, unique=True, primary_key=True, verbose_name="ID Presencia", editable=False)
    cliente = models.ForeignKey(Cliente, on_delete=models.PROTECT, related_name='presencias_cliente', verbose_name="Cliente")
    fecha_hora_presencia = models.DateTimeField(default=timezone.now, verbose_name="Fecha y Hora de la Presencia/Cita")
    proyecto_interes = models.CharField(max_length=255, verbose_name="Proyecto de Interés")
    lote_interes_inicial = models.ForeignKey(Lote, on_delete=models.SET_NULL, null=True, blank=True, related_name='presencias_interes_en_lote', verbose_name="Lote de Interés Inicial")
    asesor_captacion_opc = models.ForeignKey(Asesor, on_delete=models.SET_NULL, null=True, blank=True, related_name='presencias_captadas_opc', verbose_name="Asesor Captación OPC/Redes")
    medio_captacion = models.CharField(max_length=50, choices=MEDIO_CAPTACION_CHOICES, verbose_name="Medio de Captación")
    asesor_call_agenda = models.ForeignKey(Asesor, on_delete=models.SET_NULL, null=True, blank=True, related_name='presencias_agendadas_call', verbose_name="Asesor Call que Agendó")
    asesor_liner = models.ForeignKey(Asesor, on_delete=models.SET_NULL, null=True, blank=True, related_name='presencias_como_liner', verbose_name="Asesor Liner (Presentación)")
    asesor_closer = models.ForeignKey(Asesor, on_delete=models.SET_NULL, null=True, blank=True, related_name='presencias_como_closer', verbose_name="Asesor Closer (Cierre)")
    modalidad = models.CharField(max_length=20, choices=MODALIDAD_PRESENCIA_CHOICES, verbose_name="Modalidad de la Presencia")
    status_presencia = models.CharField(max_length=30, choices=STATUS_PRESENCIA_CHOICES, default='agendada', verbose_name="Estado de la Presencia/Cita")
    resultado_interaccion = models.CharField(max_length=50, choices=RESULTADO_INTERACCION_CHOICES, blank=True, null=True, verbose_name="Resultado Específico de la Interacción")
    venta_asociada = models.OneToOneField(Venta, on_delete=models.SET_NULL, null=True, blank=True, related_name='presencia_que_origino', verbose_name="Venta Asociada (si aplica)")
    observaciones = models.TextField(blank=True, null=True)
    lugar_visita = models.CharField(max_length=255, blank=True, null=True, verbose_name="Lugar de Visita")
    fecha_registro_sistema = models.DateTimeField(default=timezone.now, editable=False)
    ultima_modificacion = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.id_presencia:
            # Define un prefijo para Presencia, por ejemplo 'P' o 'PRS'
            self.id_presencia = generar_siguiente_id(Presencia, 'PRS', 5) # Ajusta longitud si es necesario
        super().save(*args, **kwargs)

    def __str__(self): 
        return f"Presencia ID {self.id_presencia} - Cliente: {self.cliente.nombres_completos_razon_social if self.cliente else 'N/A'} - Fecha: {self.fecha_hora_presencia.strftime('%Y-%m-%d %H:%M') if self.fecha_hora_presencia else 'N/A'}"
    
    class Meta: 
        verbose_name = "Presencia de Cliente"
        verbose_name_plural = "Presencias de Clientes"
        ordering = ['-fecha_hora_presencia']
# --- MODELO REGISTROPAGO ---
class RegistroPago(models.Model):
    METODO_PAGO_CHOICES = [('efectivo', 'Efectivo'),('transferencia', 'Transferencia Bancaria'),('tarjeta_credito', 'Tarjeta de Crédito'),('tarjeta_debito', 'Tarjeta de Débito'),('yape_plin', 'Yape/Plin'),('otro', 'Otro'),]
    
    # Cambiar id_pago de AutoField a CharField
    id_pago = models.CharField(max_length=50, unique=True, primary_key=True, verbose_name="ID Pago", editable=False)
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name='registros_pago', verbose_name="Venta Asociada")
    fecha_pago = models.DateField(default=timezone.now, verbose_name="Fecha del Pago")
    monto_pago = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, verbose_name="Monto del Pago (S/.)")
    monto_pago_dolares = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, verbose_name="Monto del Pago ($)")
    tipo_cambio_pago = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True, verbose_name="Tipo de Cambio del Pago (S/ por $)")
    monto_pago_soles = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, verbose_name="Monto del Pago (S/.) calculado")
    metodo_pago = models.CharField(max_length=30, choices=METODO_PAGO_CHOICES, blank=True, null=True, verbose_name="Método de Pago")
    referencia_pago = models.CharField(max_length=100, blank=True, null=True, verbose_name="Referencia (N° Op, Código, etc.)")
    notas_pago = models.TextField(blank=True, null=True, verbose_name="Notas Adicionales del Pago")
    fecha_registro_pago = models.DateTimeField(default=timezone.now, editable=False)
    cuota_plan_pago_cubierta = models.ForeignKey(CuotaPlanPago, on_delete=models.SET_NULL, null=True, blank=True, related_name='pagos_que_la_cubren', verbose_name="Cuota del Plan Cubierta (Opcional)")
    
    def save(self, *args, **kwargs):
        # Asignar un id_pago único si no existe
        if not self.id_pago:
            self.id_pago = f"PG-{uuid4().hex[:12].upper()}"
        # Si es pago en dólares, calcula monto en soles
        if self.monto_pago_dolares and self.tipo_cambio_pago:
            self.monto_pago_soles = (self.monto_pago_dolares * self.tipo_cambio_pago).quantize(Decimal('0.01'))
            self.monto_pago = self.monto_pago_soles
        super().save(*args, **kwargs)

    def __str__(self): 
        return f"Pago ({self.id_pago}) de S/. {self.monto_pago} para Venta {self.venta.id_venta if self.venta else 'N/A'} el {self.fecha_pago}"
    
    class Meta: 
        verbose_name = "Registro de Pago"
        verbose_name_plural = "Registros de Pagos"
        ordering = ['-fecha_pago']

# --- FUNCIÓN AUXILIAR PARA APLICAR PAGOS (DEBE ESTAR ANTES DE LAS SEÑALES QUE LA USAN) ---
def aplicar_pagos_a_cuotas_del_plan(plan: PlanPagoVenta, venta_obj: Venta):
    print(f"--- [Helper Function] Iniciando aplicar_pagos_a_cuotas_del_plan para Plan ID {plan.id_plan_pago} de Venta ID {venta_obj.id_venta} ---")
    
    # Determinar si es proyecto en dólares (Aucallama/Oasis 2)
    es_proyecto_dolares = (
        'aucallama' in venta_obj.lote.ubicacion_proyecto.lower() or
        'oasis 2' in venta_obj.lote.ubicacion_proyecto.lower()
    )
    print(f"  Proyecto en dólares: {es_proyecto_dolares}")
    
    cuotas_del_plan_qs = plan.cuotas.all().order_by('numero_cuota')

    # Resetear montos pagados de todas las cuotas del plan y desvincular RegistroPagos
    for cuota_reset in cuotas_del_plan_qs:
        if cuota_reset.monto_pagado != Decimal('0.00') or cuota_reset.fecha_pago_efectivo is not None or cuota_reset.estado_cuota != 'pendiente':
            cuota_reset.monto_pagado = Decimal('0.00')
            cuota_reset.fecha_pago_efectivo = None
            cuota_reset.actualizar_estado(save_instance=True)

    # Desvincular todos los RegistroPago de esta venta que podrían estar vinculados a cuotas de ESTE plan
    RegistroPago.objects.filter(venta=venta_obj, cuota_plan_pago_cubierta__plan_pago_venta=plan).update(cuota_plan_pago_cubierta=None)
    print(f"    Montos pagados de cuotas del Plan {plan.id_plan_pago} reseteados y pagos desvinculados.")

    cuotas_del_plan_actualizadas = list(plan.cuotas.all().order_by('numero_cuota'))
    todos_los_pagos_de_la_venta = venta_obj.registros_pago.all().order_by('fecha_pago', 'id_pago')

    for pago_individual in todos_los_pagos_de_la_venta:
        # Para proyectos en dólares, usar monto_pago_dolares; para otros, usar monto_pago
        if es_proyecto_dolares:
            monto_restante_del_pago = pago_individual.monto_pago_dolares or Decimal('0.00')
            print(f"  Procesando Pago ID {pago_individual.id_pago}, Monto original del pago (USD): {monto_restante_del_pago}")
        else:
            monto_restante_del_pago = pago_individual.monto_pago
            print(f"  Procesando Pago ID {pago_individual.id_pago}, Monto original del pago (S/): {monto_restante_del_pago}")

        # Si el pago ya tiene cuota_plan_pago_cubierta asignada, aplícalo SOLO a esa cuota
        if pago_individual.cuota_plan_pago_cubierta:
            cuota = pago_individual.cuota_plan_pago_cubierta
            # Para proyectos en dólares, usar monto_programado_dolares; para otros, usar monto_programado
            if es_proyecto_dolares:
                monto_programado_cuota = cuota.monto_programado_dolares or Decimal('0.00')
                monto_pagado_cuota = sum(p.monto_pago_dolares or Decimal('0.00') for p in cuota.pagos_que_la_cubren.all())
            else:
                monto_programado_cuota = cuota.monto_programado
                monto_pagado_cuota = cuota.monto_pagado
            
            pago_aplicado = min(monto_restante_del_pago, monto_programado_cuota - monto_pagado_cuota)
            if pago_aplicado > Decimal('0.00'):
                if es_proyecto_dolares:
                    # Para proyectos en dólares, actualizar monto_pagado basado en dólares
                    cuota.monto_pagado = monto_pagado_cuota + pago_aplicado
                else:
                    cuota.monto_pagado += pago_aplicado
                cuota.actualizar_estado(save_instance=True)
                print(f"    Pago ID {pago_individual.id_pago} aplicado SOLO a cuota N°{cuota.numero_cuota} (seleccionada por el usuario). Monto aplicado: {pago_aplicado}")
            continue  # No aplicar a otras cuotas

        # Si no tiene cuota específica, aplicar secuencialmente
        pago_vinculado_a_cuota_en_este_pago = False
        for cuota_iter in cuotas_del_plan_actualizadas:
            if monto_restante_del_pago <= Decimal('0.00'):
                break
                
            # Para proyectos en dólares, usar monto_programado_dolares; para otros, usar monto_programado
            if es_proyecto_dolares:
                monto_programado_cuota = cuota_iter.monto_programado_dolares or Decimal('0.00')
                monto_pagado_cuota = sum(p.monto_pago_dolares or Decimal('0.00') for p in cuota_iter.pagos_que_la_cubren.all())
            else:
                monto_programado_cuota = cuota_iter.monto_programado
                monto_pagado_cuota = cuota_iter.monto_pagado
            
            saldo_de_esta_cuota = monto_programado_cuota - monto_pagado_cuota
            if saldo_de_esta_cuota <= Decimal('0.00'):
                continue
            pago_aplicado_a_esta_cuota = min(monto_restante_del_pago, saldo_de_esta_cuota)
            if pago_aplicado_a_esta_cuota > Decimal('0.00'):
                if es_proyecto_dolares:
                    # Para proyectos en dólares, actualizar monto_pagado basado en dólares
                    cuota_iter.monto_pagado = monto_pagado_cuota + pago_aplicado_a_esta_cuota
                else:
                    cuota_iter.monto_pagado += pago_aplicado_a_esta_cuota
                    
                if not pago_vinculado_a_cuota_en_este_pago:
                    RegistroPago.objects.filter(pk=pago_individual.pk).update(cuota_plan_pago_cubierta=cuota_iter)
                    pago_individual.cuota_plan_pago_cubierta = cuota_iter
                    pago_vinculado_a_cuota_en_este_pago = True
                    print(f"      Pago ID {pago_individual.id_pago} vinculado a cuota N°{cuota_iter.numero_cuota}")
                monto_restante_del_pago -= pago_aplicado_a_esta_cuota
                cuota_iter.actualizar_estado(save_instance=True)
        if monto_restante_del_pago > Decimal('0.00'):
            print(f"  ADVERTENCIA: Del Pago ID {pago_individual.id_pago}, quedó un excedente de {monto_restante_del_pago} después de aplicar a todas las cuotas disponibles.")
    
    # NUEVA LÓGICA: Llamar a recalcular_cuotas_pendientes para eliminar cuotas completamente pagadas y renumérandolas
    print(f"  Llamando a recalcular_cuotas_pendientes para eliminar cuotas completamente pagadas y renumérandolas...")
    plan.recalcular_cuotas_pendientes(save_cuotas=True)
    
    print(f"--- [Helper Function] FIN aplicar_pagos_a_cuotas_del_plan para Plan ID {plan.id_plan_pago} ---")


# --- SEÑALES ---
# --- SEÑALES ---
# --- INICIO: SEÑALES PARA ACTUALIZAR ESTADO DEL LOTE BASADO EN VENTA ---
@receiver(post_save, sender=Venta)
def actualizar_estado_lote_por_venta_guardada(sender, instance: Venta, created, **kwargs):
    if not instance.lote:
        return

    with transaction.atomic():
        lote_obj = Lote.objects.select_for_update().get(pk=instance.lote.pk)
        current_lote_estado_db = lote_obj.estado_lote
        
        print(f"\n[Signal Venta Save/Update - Venta ID: {instance.id_venta} (creada: {created}), Lote ID: {lote_obj.id_lote}]")
        print(f"  Venta actual (instance): status='{instance.status_venta}', firma='{instance.cliente_firmo_contrato}'")
        print(f"  Lote (DB antes del cambio): estado='{current_lote_estado_db}'")

        nuevo_estado_propuesto = 'Disponible' # Por defecto, el lote tiende a estar disponible

        # Condición para VENDIDO:
        # ¿Existe alguna venta para este lote que esté (Procesable Y Firmada) O (Completada Y Firmada), y NO Anulada?
        es_vendido_por_alguna_venta = Venta.objects.filter(
            lote=lote_obj,
            cliente_firmo_contrato=True,
            status_venta__in=[Venta.STATUS_VENTA_PROCESABLE, Venta.STATUS_VENTA_COMPLETADA]
        ).exclude(status_venta=Venta.STATUS_VENTA_ANULADO).exists()
        
        print(f"  Checkeo para 'Vendido': ¿Existe alguna venta P&F o C&F para el lote? -> {es_vendido_por_alguna_venta}")

        if es_vendido_por_alguna_venta:
            nuevo_estado_propuesto = 'Vendido'
        else:
            # Condición para RESERVADO:
            # Si no está Vendido, ¿Existe alguna venta para este lote que esté PROCESABLE (sin importar firma) y NO Anulada?
            es_reservado_por_alguna_venta_procesable = Venta.objects.filter(
                lote=lote_obj, 
                status_venta=Venta.STATUS_VENTA_PROCESABLE
            ).exclude(status_venta=Venta.STATUS_VENTA_ANULADO).exists()
            
            print(f"  Checkeo para 'Reservado': ¿Existe alguna venta Procesable (y no vendida por firma) para el lote? -> {es_reservado_por_alguna_venta_procesable}")
            if es_reservado_por_alguna_venta_procesable:
                nuevo_estado_propuesto = 'Reservado'
            # Else: Si no es Vendido ni Reservado por ninguna venta, se queda como 'Disponible' (el default)
        
        print(f"  Estado Lote Determinado por la señal: '{nuevo_estado_propuesto}'")

        if current_lote_estado_db != nuevo_estado_propuesto:
            lote_obj.estado_lote = nuevo_estado_propuesto
            lote_obj.save(update_fields=['estado_lote'])
            print(f"  Lote {lote_obj.id_lote} estado CAMBIADO a '{nuevo_estado_propuesto}'")
        else:
            print(f"  Lote {lote_obj.id_lote} ya está en estado '{current_lote_estado_db}'. No se realizaron cambios en el lote.")

@receiver(post_delete, sender=Venta)
def actualizar_estado_lote_por_venta_eliminada(sender, instance: Venta, **kwargs):
    """
    Actualiza el estado del Lote asociado cuando una Venta se elimina.
    La lógica es la misma que cuando se guarda, ya que se reevalúa el estado del lote
    basado en las ventas restantes.
    """
    if not instance.lote: # instance.lote aún debería ser accesible en post_delete
        return
        
    # Para simular el estado de 'created=False' y que la lógica de la señal post_save se aplique correctamente
    # al reevaluar, podemos llamar a la función directamente.
    # No es necesario pasar 'created' si la lógica interna no depende de ello explícitamente para el lote.
    print(f"[Signal Venta Delete] Venta ID {instance.id_venta} eliminada. Reevaluando estado de Lote {instance.lote.id_lote}.")
    # Llamamos a la misma lógica de la señal post_save, pasándole la instancia de Venta eliminada.
    # La función buscará otras ventas para determinar el estado del lote.
    # No es ideal llamar a otra señal directamente, pero si la lógica es idéntica y está encapsulada:
    # En lugar de llamar a la señal, podríamos extraer la lógica a una función helper y llamarla desde ambas señales.
    # Por ahora, para simplicidad, si la lógica es la misma, podemos re-llamarla o duplicarla.
    # Vamos a asumir que la lógica de actualizar_estado_lote_por_venta_guardada es la que debe ejecutarse.
    # Para ello, necesitamos una instancia de Venta (que es 'instance' aquí).
    # El 'created' no es relevante para esta re-evaluación.
    
    # Re-evaluamos el estado del lote basado en las ventas restantes
    # Copiamos la lógica de la señal post_save aquí, ya que la instancia actual ya fue eliminada.
    # No podemos llamar a actualizar_estado_lote_por_venta_guardada(sender, instance, created=False, **kwargs)
    # porque la instancia de Venta ya no existe para ser "guardada".
    # Necesitamos operar sobre el lote_id que tenía la venta.

    lote_a_revisar = instance.lote # El objeto Lote sigue existiendo
    
    with transaction.atomic():
        lote_obj = Lote.objects.select_for_update().get(pk=lote_a_revisar.pk)
        current_lote_estado_db = lote_obj.estado_lote
        nuevo_estado_propuesto = 'Disponible'

        if Venta.objects.filter(
            lote=lote_obj, 
            cliente_firmo_contrato=True,
            status_venta__in=[Venta.STATUS_VENTA_PROCESABLE, Venta.STATUS_VENTA_COMPLETADA]
        ).exclude(status_venta=Venta.STATUS_VENTA_ANULADO).exists(): # Excluir la Venta que se está eliminando (ya no existe en este query)
            nuevo_estado_propuesto = 'Vendido'
        else:
            if Venta.objects.filter(
                lote=lote_obj, 
                status_venta=Venta.STATUS_VENTA_PROCESABLE
            ).exclude(status_venta=Venta.STATUS_VENTA_ANULADO).exists():
                nuevo_estado_propuesto = 'Reservado'

        if current_lote_estado_db != nuevo_estado_propuesto:
            lote_obj.estado_lote = nuevo_estado_propuesto
            lote_obj.save(update_fields=['estado_lote'])
            print(f"[Signal Venta Delete] Lote {lote_obj.id_lote} estado actualizado a '{nuevo_estado_propuesto}' tras eliminación de Venta {instance.id_venta}.")
        else:
            print(f"[Signal Venta Delete] Lote {lote_obj.id_lote} ya está en estado '{current_lote_estado_db}', no se requieren cambios tras eliminación de Venta {instance.id_venta}.")

# --- FIN: SEÑALES PARA ACTUALIZAR ESTADO DEL LOTE BASADO EN VENTA ---

@receiver(post_save, sender=Presencia)
def gestionar_actividad_diaria_por_presencia_guardada(sender, instance, created, **kwargs):
    if not instance.fecha_hora_presencia: return
    fecha_actividad = instance.fecha_hora_presencia.date()
    asesor_ids_actuales = set()
    if instance.asesor_captacion_opc: asesor_ids_actuales.add(instance.asesor_captacion_opc_id)
    if instance.asesor_call_agenda: asesor_ids_actuales.add(instance.asesor_call_agenda_id)
    if instance.asesor_liner: asesor_ids_actuales.add(instance.asesor_liner_id)
    if instance.asesor_closer: asesor_ids_actuales.add(instance.asesor_closer_id)
    for asesor_id in filter(None, asesor_ids_actuales):
        try:
            asesor_obj = Asesor.objects.get(pk=asesor_id)
            actividad, _ = ActividadDiaria.objects.get_or_create(asesor=asesor_obj, fecha_actividad=fecha_actividad, defaults={'presencias_generadas': 0})
            presencias_del_dia_para_asesor = Presencia.objects.filter( (Q(asesor_captacion_opc_id=asesor_id) | Q(asesor_call_agenda_id=asesor_id) | Q(asesor_liner_id=asesor_id) | Q(asesor_closer_id=asesor_id)), fecha_hora_presencia__date=fecha_actividad, status_presencia=Presencia.STATUS_PRESENCIA_REALIZADA ).distinct().count()
            if actividad.presencias_generadas != presencias_del_dia_para_asesor:
                actividad.presencias_generadas = presencias_del_dia_para_asesor
                actividad.save(update_fields=['presencias_generadas'])
        except Asesor.DoesNotExist: continue

@receiver(post_delete, sender=Presencia)
def gestionar_actividad_diaria_por_presencia_eliminada(sender, instance, **kwargs):
    if not instance.fecha_hora_presencia: return
    fecha_actividad = instance.fecha_hora_presencia.date()
    asesor_ids_afectados = set() 
    if instance.asesor_captacion_opc: asesor_ids_afectados.add(instance.asesor_captacion_opc_id)
    if instance.asesor_call_agenda: asesor_ids_afectados.add(instance.asesor_call_agenda_id)
    if instance.asesor_liner: asesor_ids_afectados.add(instance.asesor_liner_id)
    if instance.asesor_closer: asesor_ids_afectados.add(instance.asesor_closer_id)
    for asesor_id in filter(None, asesor_ids_afectados):
        try:
            asesor_obj = Asesor.objects.get(pk=asesor_id)
            actividad = ActividadDiaria.objects.filter(asesor=asesor_obj, fecha_actividad=fecha_actividad).first()
            if actividad:
                presencias_del_dia_para_asesor = Presencia.objects.filter( (Q(asesor_captacion_opc_id=asesor_id) | Q(asesor_call_agenda_id=asesor_id) | Q(asesor_liner_id=asesor_id) | Q(asesor_closer_id=asesor_id)), fecha_hora_presencia__date=fecha_actividad, status_presencia=Presencia.STATUS_PRESENCIA_REALIZADA ).distinct().count()
                if actividad.presencias_generadas != presencias_del_dia_para_asesor:
                    actividad.presencias_generadas = presencias_del_dia_para_asesor
                    actividad.save(update_fields=['presencias_generadas'])
        except Asesor.DoesNotExist: continue

@receiver(post_save, sender=RegistroPago)
def procesar_registro_pago_guardado(sender, instance: RegistroPago, created, **kwargs):
    with transaction.atomic():
        print(f"\n[SEÑAL POST_SAVE RegistroPago ID {instance.id_pago}] Creado: {created}")
        try:
            venta_obj = Venta.objects.select_for_update().get(pk=instance.venta_id)
        except Venta.DoesNotExist:
            print(f"  Venta ID {instance.venta_id} no encontrada para RegistroPago ID {instance.id_pago}. No se puede procesar.")
            return
        
        # Primero, actualizar el monto_pagado_actual y status de la Venta basado en todos los pagos
        venta_obj.actualizar_status_y_monto_pagado(save_instance=True)
        print(f"  Venta ID {venta_obj.id_venta} actualizada: Monto Pagado Actual = {venta_obj.monto_pagado_actual}, Status = {venta_obj.status_venta}")

        # Si es venta a crédito y tiene plan, reaplicar todos los pagos para asegurar consistencia de cuotas
        if venta_obj.tipo_venta == Venta.TIPO_VENTA_CREDITO and hasattr(venta_obj, 'plan_pago_venta') and venta_obj.plan_pago_venta:
            aplicar_pagos_a_cuotas_del_plan(venta_obj.plan_pago_venta, venta_obj)
            venta_obj.plan_pago_venta.refresh_from_db()  # <-- Asegura cuotas actualizadas
        
        # Finalmente, re-evaluar el estado de la venta, ya que la aplicación de pagos pudo completarla
        # o cambiar su estado de procesable.
        venta_obj.refresh_from_db() # Asegurar que cualquier cambio en venta_obj desde aplicar_pagos... se refleje
        venta_obj.actualizar_status_y_monto_pagado(save_instance=True)
        print(f"  Estado final Venta ID {venta_obj.id_venta} post-save pago y post-aplicación de pagos: {venta_obj.status_venta}")

@receiver(post_delete, sender=RegistroPago)
def procesar_registro_pago_eliminado(sender, instance: RegistroPago, **kwargs):
    with transaction.atomic():
        print(f"\n[SEÑAL POST_DELETE RegistroPago ID {instance.pk}] Venta ID asociada: {instance.venta_id}")
        try:
            venta_obj = Venta.objects.select_for_update().get(pk=instance.venta_id) 
        except Venta.DoesNotExist:
            print(f"  Venta ID {instance.venta_id} no encontrada (probablemente ya eliminada en cascada). La señal de eliminación de pago no realizará más acciones sobre esta Venta.")
            return

        # 1. Actualizar el monto_pagado_actual y status_venta general de la Venta PRIMERO.
        venta_obj.actualizar_status_y_monto_pagado(save_instance=True)
        print(f"  Venta ID {venta_obj.id_venta} actualizada (por eliminación de pago): Monto Pagado Actual = {venta_obj.monto_pagado_actual}, Status = {venta_obj.status_venta}")

        # 2. Si la venta es a crédito y tiene un plan:
        if venta_obj.tipo_venta == Venta.TIPO_VENTA_CREDITO and hasattr(venta_obj, 'plan_pago_venta') and venta_obj.plan_pago_venta:
            plan = venta_obj.plan_pago_venta
            # a. REAPLICAR todos los pagos RESTANTES para reajustar monto_pagado y estados de cuotas.
            print(f"  Re-aplicando pagos restantes a cuotas para Plan ID: {plan.id_plan_pago} de Venta ID {venta_obj.id_venta}")
            aplicar_pagos_a_cuotas_del_plan(plan, venta_obj)
            plan.refresh_from_db()  # <-- Asegura cuotas actualizadas
            # b. RECALCULAR los montos programados de las cuotas pendientes.
            print(f"  Llamando a recalcular_cuotas_pendientes para Plan ID: {plan.id_plan_pago} para reajustar montos programados.")
            plan.recalcular_cuotas_pendientes(save_cuotas=True)
        # 3. Finalmente, re-evaluar el estado de la venta una vez más.
        venta_obj.refresh_from_db() 
        venta_obj.actualizar_status_y_monto_pagado(save_instance=True)
        print(f"  Estado final Venta ID {venta_obj.id_venta} post-delete y post-reapli/recalc: {venta_obj.status_venta}")

class DefinicionMetaComision(models.Model):
    id_definicion = models.AutoField(primary_key=True)
    TIPO_ASESOR_CHOICES = Asesor.TIPO_ASESOR_CHOICES
    tipo_asesor = models.CharField(max_length=10, choices=TIPO_ASESOR_CHOICES, verbose_name="Tipo de Asesor")
    mes_en_rol = models.IntegerField(verbose_name="Mes en Rol")
    meta_datos_opc = models.IntegerField(default=0, verbose_name="Meta Datos OPC")
    meta_presencias = models.IntegerField(default=0, verbose_name="Meta Presencias")
    meta_ventas_directas = models.IntegerField(default=0, verbose_name="Meta Ventas Directas")
    meta_juniors_captados = models.IntegerField(default=0, verbose_name="Meta Juniors Captados")
    meta_ventas_equipo_socio = models.IntegerField(default=0, verbose_name="Meta Ventas Equipo (Socio)")
    meta_cierres_socio_equipo = models.IntegerField(default=0, verbose_name="Meta Cierres Socio (Ventas Equipo)")
    comision_residual_venta_equipo_porc = models.DecimalField(max_digits=5, decimal_places=4, default=0.0000, verbose_name="Comisión Residual por Venta Equipo (%)")
    def __str__(self): return f"Meta para {self.tipo_asesor} - Mes {self.mes_en_rol}"
    class Meta: verbose_name = "Definición de Meta y Comisión"; verbose_name_plural = "Definiciones de Metas y Comisiones"; unique_together = ('tipo_asesor', 'mes_en_rol'); ordering = ['tipo_asesor', 'mes_en_rol']

class TablaComisionDirecta(models.Model):
    id_tabla_comision = models.AutoField(primary_key=True)
    TIPO_VENTA_CHOICES = Venta.TIPO_VENTA_CHOICES
    ROL_ASESOR_EN_VENTA_JUNIOR_VP = 'JUNIOR_VENDEDOR_PRINCIPAL'; ROL_ASESOR_EN_VENTA_SOCIO_VP = 'SOCIO_VENDEDOR_PRINCIPAL'; ROL_ASESOR_EN_VENTA_SOCIO_PARTICIPANTE = 'SOCIO_PARTICIPANTE'
    ROL_ASESOR_EN_VENTA_CHOICES = [(ROL_ASESOR_EN_VENTA_JUNIOR_VP, 'Junior como Vendedor Principal'),(ROL_ASESOR_EN_VENTA_SOCIO_VP, 'Socio como Vendedor Principal'),(ROL_ASESOR_EN_VENTA_SOCIO_PARTICIPANTE, 'Socio como Participante en venta de Junior')]
    rol_asesor_en_venta = models.CharField(max_length=50, choices=ROL_ASESOR_EN_VENTA_CHOICES, default=ROL_ASESOR_EN_VENTA_JUNIOR_VP, verbose_name="Rol del Asesor en la Venta para esta comisión")
    tipo_venta = models.CharField(max_length=10, choices=TIPO_VENTA_CHOICES, verbose_name="Tipo de Venta")
    _PARTICIPACION_CHOICES = Venta.PARTICIPACION_JUNIOR_CHOICES + Venta.PARTICIPACION_SOCIO_CHOICES
    _unique_participaciones = []; _seen_participaciones = set()
    for _pc_val, _pc_label in _PARTICIPACION_CHOICES:
        if _pc_val not in _seen_participaciones: _unique_participaciones.append((_pc_val, _pc_label)); _seen_participaciones.add(_pc_val)
    participacion_en_venta_aplicable = models.CharField(max_length=50, choices=_unique_participaciones, default='N/A', verbose_name="Participación Aplicable para esta regla", help_text="Ej: 'opc y call' (Junior), 'front' (Socio Part.), 'N/A' (Socio VP)")
    porcentaje_comision = models.DecimalField(max_digits=5, decimal_places=4, default=0.0000, verbose_name="Porcentaje de Comisión (%)")
    def __str__(self): return f"Comisión: Rol {self.get_rol_asesor_en_venta_display()} - Venta {self.get_tipo_venta_display()} - Part: {self.get_participacion_en_venta_aplicable_display()}"
    class Meta: verbose_name = "Tabla de Comisión Directa"; verbose_name_plural = "Tablas de Comisiones Directas"; unique_together = ('rol_asesor_en_venta', 'tipo_venta', 'participacion_en_venta_aplicable'); ordering = ['rol_asesor_en_venta', 'tipo_venta']

class ConfigGeneral(models.Model):
    parametro = models.CharField(max_length=100, unique=True, primary_key=True, verbose_name="Parámetro")
    valor = models.CharField(max_length=255, verbose_name="Valor")
    descripcion = models.TextField(blank=True, null=True, verbose_name="Descripción")
    def __str__(self): return self.parametro
    class Meta: verbose_name = "Configuración General"; verbose_name_plural = "Configuraciones Generales"

class LogAuditoriaCambio(models.Model):
    id_log = models.AutoField(primary_key=True)
    timestamp = models.DateTimeField(default=timezone.now, verbose_name="Fecha y Hora")
    usuario_email = models.CharField(max_length=255, verbose_name="Usuario Email")
    accion = models.CharField(max_length=50, verbose_name="Acción")
    modulo = models.CharField(max_length=50, verbose_name="Módulo Afectado")
    id_registro_afectado = models.CharField(max_length=100, blank=True, null=True, verbose_name="ID Registro Afectado")
    campo_modificado = models.CharField(max_length=100, blank=True, null=True, verbose_name="Campo Modificado")
    valor_antiguo = models.TextField(blank=True, null=True, verbose_name="Valor Antiguo")
    valor_nuevo = models.TextField(blank=True, null=True, verbose_name="Valor Nuevo")
    detalles_adicionales = models.TextField(blank=True, null=True, verbose_name="Detalles Adicionales")
    def __str__(self): return f"{self.timestamp.strftime('%Y-%m-%d %H:%M')} - {self.usuario_email} - {self.accion} en {self.modulo}"
    class Meta: verbose_name = "Log de Auditoría"; verbose_name_plural = "Logs de Auditoría"; ordering = ['-timestamp']

class ComisionVentaAsesor(models.Model):
    ROL_ASESOR_VENTA_CHOICES = [
        ('captacion_opc', 'Captación OPC/Redes'),
        ('call', 'Call (Agendó)'),
        ('liner', 'Liner (Presentación)'),
        ('closer', 'Closer (Cierre)'),
        ('otro', 'Otro'),
    ]
    id_comision_venta_asesor = models.AutoField(primary_key=True)
    venta = models.ForeignKey('Venta', on_delete=models.CASCADE, related_name='comisiones_asesores', verbose_name="Venta Asociada")
    asesor = models.ForeignKey('Asesor', on_delete=models.PROTECT, related_name='comisiones_en_ventas', verbose_name="Asesor Involucrado")
    rol = models.CharField(max_length=20, choices=ROL_ASESOR_VENTA_CHOICES, verbose_name="Rol del Asesor en la Venta")
    porcentaje_comision = models.DecimalField(max_digits=5, decimal_places=2, validators=[MinValueValidator(Decimal('0.00')), MaxValueValidator(Decimal('100.00'))], verbose_name="Porcentaje de Comisión Asignado (%)")
    monto_comision_calculado = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, verbose_name="Monto Comisión Calculado (S/.)")
    notas = models.TextField(blank=True, null=True, verbose_name="Notas Adicionales")
    fecha_registro = models.DateTimeField(default=timezone.now, editable=False)
    ultima_modificacion = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Venta {self.venta_id} - Asesor {self.asesor_id} ({self.rol}) - {self.porcentaje_comision}%"

    class Meta:
        verbose_name = "Comisión de Venta por Asesor"
        verbose_name_plural = "Comisiones de Ventas por Asesor"
        unique_together = ('venta', 'asesor', 'rol')
        ordering = ['venta', 'asesor']