#!/usr/bin/env python
import os
import django
import sys

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.management import execute_from_command_line
from django.db import connection

def force_migrate():
    """Forzar la ejecución de todas las migraciones"""
    try:
        print("🔄 Ejecutando migraciones de Django...")
        
        # Ejecutar makemigrations primero
        print("📝 Ejecutando makemigrations...")
        execute_from_command_line(['manage.py', 'makemigrations'])
        
        # Ejecutar migrate
        print("🗄️ Ejecutando migrate...")
        execute_from_command_line(['manage.py', 'migrate'])
        
        # Verificar tablas
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name;
            """)
            tables = cursor.fetchall()
            print(f"✅ Tablas encontradas: {len(tables)}")
            for table in tables:
                print(f"  - {table[0]}")
        
        print("✅ Migraciones completadas exitosamente")
        
    except Exception as e:
        print(f"❌ Error durante las migraciones: {e}")
        sys.exit(1)

if __name__ == '__main__':
    force_migrate() 