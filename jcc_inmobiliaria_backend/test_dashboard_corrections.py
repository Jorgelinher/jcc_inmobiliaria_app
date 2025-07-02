#!/usr/bin/env python
"""
Script de prueba para verificar las correcciones del dashboard
"""
import os
import sys
import django
from datetime import datetime, date
from decimal import Decimal

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from gestion_inmobiliaria.models import Presencia, Venta, RegistroPago, Lote
from gestion_inmobiliaria.views import GetDashboardDataAPIView
from django.test import RequestFactory
from django.contrib.auth.models import User
from django.db import models
from rest_framework.test import APIRequestFactory

def test_dashboard_corrections():
    """Prueba las correcciones del dashboard"""
    print("=== PRUEBA DE CORRECCIONES DEL DASHBOARD ===")
    
    # Crear un usuario de prueba
    user, created = User.objects.get_or_create(
        username='test_user',
        defaults={'email': 'test@example.com'}
    )
    
    # Crear request factory de DRF
    factory = APIRequestFactory()
    
    # Crear vista
    view = GetDashboardDataAPIView()
    
    # Prueba 1: Sin filtros
    print("\n1. PRUEBA SIN FILTROS:")
    request = factory.get('/api/gestion/dashboard-data/')
    request.user = user
    
    try:
        response = view.get(request)
        if response.status_code == 200:
            data = response.data
            print(f"✅ Respuesta exitosa")
            print(f"   - Monto Total Recaudo: {data['tarjetas']['montoTotalRecaudo']}")
            print(f"   - N° Presencias TOUR Realizadas: {data['tarjetas']['nPresenciasRealizadas']}")
            print(f"   - Tasa Conversión Ventas: {data['tarjetas']['tasaConversionVentas']}%")
            print(f"   - N° Ventas Procesables: {data['tarjetas']['nVentasProcesables']}")
            print(f"   - Lotes Disponibles: {data['tarjetas']['lotesDisponibles']}")
            print(f"   - Lotes Vendidos: {data['tarjetas']['lotesVendidos']}")
            
            # Verificar gráfico histórico
            historico = data['graficos']['historicoVentasPresencias']
            print(f"   - Gráfico Histórico: {len(historico)-1} meses de datos")
            if len(historico) > 1:
                print(f"     Primer mes: {historico[1]}")
        else:
            print(f"❌ Error en respuesta: {response.status_code}")
            print(f"   {response.data}")
    except Exception as e:
        print(f"❌ Error en prueba sin filtros: {str(e)}")
    
    # Prueba 2: Con filtros de fecha
    print("\n2. PRUEBA CON FILTROS DE FECHA (Febrero 2025):")
    request = factory.get('/api/gestion/dashboard-data/?startDate=2025-02-01&endDate=2025-02-28')
    request.user = user
    
    try:
        response = view.get(request)
        if response.status_code == 200:
            data = response.data
            print(f"✅ Respuesta exitosa con filtros")
            print(f"   - Monto Total Recaudo: {data['tarjetas']['montoTotalRecaudo']}")
            print(f"   - N° Presencias TOUR Realizadas: {data['tarjetas']['nPresenciasRealizadas']}")
            print(f"   - Tasa Conversión Ventas: {data['tarjetas']['tasaConversionVentas']}%")
            print(f"   - N° Ventas Procesables: {data['tarjetas']['nVentasProcesables']}")
            
            # Verificar gráfico histórico
            historico = data['graficos']['historicoVentasPresencias']
            print(f"   - Gráfico Histórico: {len(historico)-1} meses de datos")
            if len(historico) > 1:
                print(f"     Datos filtrados: {historico[1:]}")
        else:
            print(f"❌ Error en respuesta: {response.status_code}")
            print(f"   {response.data}")
    except Exception as e:
        print(f"❌ Error en prueba con filtros: {str(e)}")
    
    # Prueba 3: Verificar datos de presencias
    print("\n3. VERIFICACIÓN DE DATOS DE PRESENCIAS:")
    try:
        # Contar presencias TOUR realizadas
        presencias_tour = Presencia.objects.filter(
            tipo_tour='tour',
            status_presencia='realizada'
        ).count()
        print(f"   - Total presencias TOUR realizadas: {presencias_tour}")
        
        # Contar presencias por mes (febrero 2025)
        presencias_feb_2025 = Presencia.objects.filter(
            tipo_tour='tour',
            status_presencia='realizada',
            fecha_hora_presencia__date__year=2025,
            fecha_hora_presencia__date__month=2
        ).count()
        print(f"   - Presencias TOUR realizadas en Febrero 2025: {presencias_feb_2025}")
        
        # Contar ventas en febrero 2025
        ventas_feb_2025 = Venta.objects.filter(
            fecha_venta__year=2025,
            fecha_venta__month=2
        ).count()
        print(f"   - Ventas en Febrero 2025: {ventas_feb_2025}")
        
        # Contar recaudos en febrero 2025
        recaudos_feb_2025 = RegistroPago.objects.filter(
            fecha_pago__year=2025,
            fecha_pago__month=2
        ).aggregate(total=models.Sum('monto_pago'))['total'] or Decimal('0.00')
        print(f"   - Recaudos en Febrero 2025: {recaudos_feb_2025}")
        
    except Exception as e:
        print(f"❌ Error en verificación de datos: {str(e)}")
    
    print("\n=== FIN DE PRUEBAS ===")

if __name__ == '__main__':
    test_dashboard_corrections() 