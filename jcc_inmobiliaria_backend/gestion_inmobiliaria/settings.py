# --- CONFIGURACIÓN DE INTEGRACIÓN CON CRM ---
# Token de autenticación para recibir webhooks del CRM (debe coincidir con COMERCIAL_WEBHOOK_TOKEN en el CRM)
CRM_WEBHOOK_TOKEN = os.environ.get('CRM_WEBHOOK_TOKEN', 'jcc-webhook-secret-token-2024') 

DEBUG = False  # Cambiar a True solo en desarrollo
ALLOWED_HOSTS = ['tu-dominio.com', 'localhost', '127.0.0.1']  # Ajustar para producción

# Seguridad cookies
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_SECONDS = 3600
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_SSL_REDIRECT = True

# CORS y CSRF restrictivos
CORS_ALLOWED_ORIGINS = [
    'https://tu-dominio.com',
]
CSRF_TRUSTED_ORIGINS = [
    'https://tu-dominio.com',
]

# Browsable API solo en debug
if not DEBUG:
    REST_FRAMEWORK = {
        'DEFAULT_RENDERER_CLASSES': [
            'rest_framework.renderers.JSONRenderer',
        ]
    } 