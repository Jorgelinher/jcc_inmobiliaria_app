# --- CONFIGURACIÓN DE INTEGRACIÓN CON CRM ---
# Token de autenticación para recibir webhooks del CRM (debe coincidir con COMERCIAL_WEBHOOK_TOKEN en el CRM)
CRM_WEBHOOK_TOKEN = os.environ.get('CRM_WEBHOOK_TOKEN', 'jcc-webhook-secret-token-2024') 