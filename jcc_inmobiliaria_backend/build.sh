#!/usr/bin/env bash
# exit on error
set -o errexit

echo "🚀 Iniciando build..."

pip install -r requirements.txt

echo "📦 Dependencias instaladas"

python manage.py collectstatic --no-input
echo "📁 Archivos estáticos recolectados"

python manage.py migrate
echo "🗄️ Migraciones aplicadas"

# Verificar estado de la base de datos
python check_db.py
echo "🔍 Verificación de BD completada"

# Crear superusuario si no existe
python create_superuser.py
echo "👤 Superusuario verificado"

echo "✅ Build completado exitosamente" 