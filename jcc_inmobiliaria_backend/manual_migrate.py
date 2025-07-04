#!/usr/bin/env python
import os
import django
import sys

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.management import execute_from_command_line
from django.db import connection

def manual_migrate():
    """Ejecutar migraciones manualmente"""
    try:
        print("🚀 Iniciando migraciones manuales...")
        
        # Verificar conexión a la BD
        with connection.cursor() as cursor:
            cursor.execute("SELECT version();")
            version = cursor.fetchone()
            print(f"✅ Conectado a PostgreSQL: {version[0]}")
        
        # Ejecutar makemigrations
        print("📝 Ejecutando makemigrations...")
        execute_from_command_line(['manage.py', 'makemigrations'])
        
        # Ejecutar migrate
        print("🗄️ Ejecutando migrate...")
        execute_from_command_line(['manage.py', 'migrate'])
        
        # Verificar tablas creadas
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
        
        # Crear superusuario
        print("👤 Creando superusuario...")
        from django.contrib.auth.models import User
        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser(
                username='admin',
                email='admin@jccinmobiliaria.com',
                password='JccAdmin2024!'
            )
            print("✅ Superusuario creado: admin / JccAdmin2024!")
        else:
            print("ℹ️ Superusuario ya existe")
        
        print("🎉 ¡Migraciones completadas exitosamente!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    manual_migrate() 