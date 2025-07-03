#!/usr/bin/env python
import os
import sys
import django
from decimal import Decimal
from datetime import date, timedelta

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from gestion_inmobiliaria.models import ComisionVentaAsesor, Venta, CierreComisionMensual, DetalleComisionCerrada

def verificar_comisiones_julio_2025():
    print("=== VERIFICACIÓN DE COMISIONES JULIO 2025 ===\n")
    
    # Parámetros del período
    mes = 7
    anio = 2025
    fecha_inicio_periodo = date(anio, mes, 1)
    next_month = mes + 1 if mes < 12 else 1
    next_year = anio if mes < 12 else anio + 1
    fecha_fin_periodo = date(next_year, next_month, 1) - timedelta(days=1)
    
    print(f"Período: {fecha_inicio_periodo} a {fecha_fin_periodo}")
    print(f"Mes: {mes}, Año: {anio}\n")
    
    # 1. Verificar comisiones en el módulo de comisiones (solo procesables)
    print("1. COMISIONES EN MÓDULO DE COMISIONES (solo ventas procesables):")
    comisiones_modulo = ComisionVentaAsesor.objects.filter(
        venta__fecha_venta__gte=fecha_inicio_periodo,
        venta__fecha_venta__lte=fecha_fin_periodo,
        venta__status_venta=Venta.STATUS_VENTA_PROCESABLE
    ).select_related('asesor', 'venta')
    
    total_modulo = Decimal('0.00')
    print(f"   Total comisiones encontradas: {comisiones_modulo.count()}")
    
    for com in comisiones_modulo:
        monto = com.monto_comision_calculado or Decimal('0.00')
        total_modulo += monto
        print(f"   - Venta {com.venta.id_venta} | {com.asesor.nombre_asesor} | {com.rol} | {com.porcentaje_comision}% | S/ {monto}")
    
    print(f"   TOTAL MÓDULO COMISIONES: S/ {total_modulo}\n")
    
    # 2. Verificar comisiones en cierre de comisiones (todas las comisiones)
    print("2. COMISIONES EN CIERRE DE COMISIONES (todas las comisiones):")
    comisiones_cierre = ComisionVentaAsesor.objects.filter(
        venta__fecha_venta__month=mes,
        venta__fecha_venta__year=anio,
        detallecomisioncerrada__isnull=True
    ).select_related('asesor', 'venta')
    
    total_cierre = Decimal('0.00')
    print(f"   Total comisiones encontradas: {comisiones_cierre.count()}")
    
    for com in comisiones_cierre:
        monto = com.monto_comision_calculado or Decimal('0.00')
        total_cierre += monto
        print(f"   - Venta {com.venta.id_venta} | {com.asesor.nombre_asesor} | {com.rol} | {com.porcentaje_comision}% | S/ {monto} | Status: {com.venta.status_venta}")
    
    print(f"   TOTAL CIERRE COMISIONES: S/ {total_cierre}\n")
    
    # 3. Verificar cierre existente
    print("3. CIERRE EXISTENTE EN BASE DE DATOS:")
    cierre_existente = CierreComisionMensual.objects.filter(mes=mes, año=anio).first()
    if cierre_existente:
        print(f"   Cierre encontrado: {cierre_existente}")
        print(f"   Status: {cierre_existente.status}")
        print(f"   Monto total: S/ {cierre_existente.monto_total_comisiones}")
        print(f"   Fecha cierre: {cierre_existente.fecha_cierre}")
        print(f"   Cerrado por: {cierre_existente.cerrado_por}")
        
        # Verificar detalles del cierre
        detalles = DetalleComisionCerrada.objects.filter(cierre=cierre_existente)
        print(f"   Total detalles: {detalles.count()}")
        
        total_detalles = Decimal('0.00')
        for detalle in detalles:
            total_detalles += detalle.monto_comision_final
            print(f"   - Venta {detalle.venta_id} | {detalle.asesor_nombre} | {detalle.rol_en_venta} | {detalle.porcentaje_comision_aplicado}% | S/ {detalle.monto_comision_final}")
        
        print(f"   TOTAL DETALLES: S/ {total_detalles}")
    else:
        print("   No se encontró cierre para este período")
    
    print("\n=== RESUMEN ===")
    print(f"Módulo Comisiones: S/ {total_modulo}")
    print(f"Cierre Comisiones: S/ {total_cierre}")
    if cierre_existente:
        print(f"Cierre en BD: S/ {cierre_existente.monto_total_comisiones}")
    
    # 4. Verificar todas las ventas del período
    print("\n4. TODAS LAS VENTAS DEL PERÍODO:")
    ventas_periodo = Venta.objects.filter(
        fecha_venta__month=mes,
        fecha_venta__year=anio
    ).select_related('cliente', 'lote')
    
    print(f"   Total ventas: {ventas_periodo.count()}")
    for venta in ventas_periodo:
        comisiones_venta = ComisionVentaAsesor.objects.filter(venta=venta)
        total_venta = sum(c.monto_comision_calculado or Decimal('0.00') for c in comisiones_venta)
        print(f"   - Venta {venta.id_venta} | {venta.cliente.nombres_completos_razon_social} | {venta.lote} | Status: {venta.status_venta} | Total comisiones: S/ {total_venta}")

if __name__ == "__main__":
    verificar_comisiones_julio_2025() 