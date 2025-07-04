#!/usr/bin/env python
import os
import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection
from django.core.management import execute_from_command_line

def check_database():
    """Verificar el estado de la base de datos"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT version();")
            version = cursor.fetchone()
            print(f"✅ Conexión a PostgreSQL exitosa: {version[0]}")
            
            # Verificar si las tablas existen
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name;
            """)
            tables = cursor.fetchall()
            print(f"📋 Tablas encontradas: {len(tables)}")
            for table in tables:
                print(f"  - {table[0]}")
                
    except Exception as e:
        print(f"❌ Error de conexión a la base de datos: {e}")

def check_migrations():
    """Verificar el estado de las migraciones"""
    try:
        print("\n🔄 Verificando migraciones...")
        execute_from_command_line(['manage.py', 'showmigrations'])
    except Exception as e:
        print(f"❌ Error al verificar migraciones: {e}")

if __name__ == '__main__':
    check_database()
    check_migrations() 