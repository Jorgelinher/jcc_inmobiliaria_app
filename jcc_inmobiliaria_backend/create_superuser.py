#!/usr/bin/env python
import os
import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User

def create_superuser():
    """Crear superusuario si no existe"""
    if not User.objects.filter(username='admin').exists():
        User.objects.create_superuser(
            username='admin',
            email='admin@jccinmobiliaria.com',
            password='JccAdmin2024!'
        )
        print("✅ Superusuario creado exitosamente")
        print("Username: admin")
        print("Password: JccAdmin2024!")
    else:
        print("ℹ️ Superusuario ya existe")

if __name__ == '__main__':
    create_superuser() 