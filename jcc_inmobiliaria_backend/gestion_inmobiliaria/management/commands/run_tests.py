from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.test.utils import get_runner
from django.conf import settings
import os
import sys
import time

class Command(BaseCommand):
    help = 'Ejecuta todos los tests y genera reportes'

    def add_arguments(self, parser):
        parser.add_argument(
            '--coverage',
            action='store_true',
            help='Ejecutar tests con cobertura de código',
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Mostrar output detallado',
        )
        parser.add_argument(
            '--parallel',
            action='store_true',
            help='Ejecutar tests en paralelo',
        )

    def handle(self, *args, **options):
        start_time = time.time()
        
        self.stdout.write(
            self.style.SUCCESS('🚀 Iniciando ejecución de tests...')
        )

        # Configurar argumentos para los tests
        test_args = []
        
        if options['verbose']:
            test_args.append('--verbosity=2')
        else:
            test_args.append('--verbosity=1')
            
        if options['parallel']:
            test_args.append('--parallel')
            
        if options['coverage']:
            # Instalar coverage si no está instalado
            try:
                import coverage
            except ImportError:
                self.stdout.write(
                    self.style.WARNING('Instalando coverage...')
                )
                os.system('pip install coverage')
                import coverage
            
            # Configurar coverage
            cov = coverage.Coverage(
                source=['gestion_inmobiliaria'],
                omit=[
                    '*/tests/*',
                    '*/migrations/*',
                    '*/management/*',
                    '*/venv/*',
                ]
            )
            cov.start()

        try:
            # Ejecutar tests
            self.stdout.write('📋 Ejecutando tests de Django...')
            result = call_command('test', *test_args, verbosity=options['verbose'])
            
            if options['coverage']:
                cov.stop()
                cov.save()
                
                # Generar reporte
                self.stdout.write('📊 Generando reporte de cobertura...')
                cov.report()
                
                # Guardar reporte HTML
                cov.html_report(directory='htmlcov')
                self.stdout.write(
                    self.style.SUCCESS('📁 Reporte HTML guardado en htmlcov/')
                )

            # Ejecutar tests de integridad de datos
            self.stdout.write('🔍 Ejecutando tests de integridad...')
            self.run_integrity_tests()
            
            # Ejecutar tests de validaciones
            self.stdout.write('✅ Ejecutando tests de validaciones...')
            self.run_validation_tests()
            
            end_time = time.time()
            duration = end_time - start_time
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'🎉 Tests completados en {duration:.2f} segundos'
                )
            )
            
            if result == 0:
                self.stdout.write(
                    self.style.SUCCESS('✅ Todos los tests pasaron correctamente')
                )
            else:
                self.stdout.write(
                    self.style.ERROR('❌ Algunos tests fallaron')
                )
                sys.exit(1)
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Error ejecutando tests: {e}')
            )
            sys.exit(1)

    def run_integrity_tests(self):
        """Ejecuta tests específicos de integridad de datos"""
        try:
            from django.test import TestCase
            from django.db import connection
            
            # Verificar integridad de la base de datos
            with connection.cursor() as cursor:
                # Verificar que no hay registros huérfanos
                cursor.execute("""
                    SELECT COUNT(*) FROM gestion_inmobiliaria_venta v 
                    LEFT JOIN gestion_inmobiliaria_cliente c ON v.cliente_id = c.id_cliente 
                    WHERE c.id_cliente IS NULL
                """)
                orphan_ventas = cursor.fetchone()[0]
                
                if orphan_ventas > 0:
                    self.stdout.write(
                        self.style.WARNING(f'⚠️  Encontradas {orphan_ventas} ventas sin cliente')
                    )
                else:
                    self.stdout.write('✅ No hay ventas huérfanas')
                
                # Verificar que no hay lotes vendidos duplicados
                cursor.execute("""
                    SELECT COUNT(*) FROM gestion_inmobiliaria_venta 
                    GROUP BY lote_id HAVING COUNT(*) > 1
                """)
                duplicate_lotes = cursor.fetchone()[0]
                
                if duplicate_lotes > 0:
                    self.stdout.write(
                        self.style.WARNING(f'⚠️  Encontrados {duplicate_lotes} lotes vendidos múltiples veces')
                    )
                else:
                    self.stdout.write('✅ No hay lotes vendidos duplicados')
                    
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Error en tests de integridad: {e}')
            )

    def run_validation_tests(self):
        """Ejecuta tests de validaciones de negocio"""
        try:
            from .models import Venta, Cliente, Lote, Asesor
            from decimal import Decimal
            
            # Verificar que las ventas a crédito tienen plazo > 0
            credit_ventas = Venta.objects.filter(
                tipo_venta='credito',
                plazo_meses_credito__lte=0
            ).count()
            
            if credit_ventas > 0:
                self.stdout.write(
                    self.style.WARNING(f'⚠️  Encontradas {credit_ventas} ventas a crédito sin plazo válido')
                )
            else:
                self.stdout.write('✅ Todas las ventas a crédito tienen plazo válido')
                
            # Verificar que los montos pagados no exceden el valor del lote
            invalid_payments = Venta.objects.filter(
                monto_pagado_actual__gt=models.F('valor_lote_venta')
            ).count()
            
            if invalid_payments > 0:
                self.stdout.write(
                    self.style.WARNING(f'⚠️  Encontradas {invalid_payments} ventas con pagos excesivos')
                )
            else:
                self.stdout.write('✅ Todos los pagos son válidos')
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Error en tests de validación: {e}')
            ) 