# jcc_inmobiliaria_backend/config/urls.py
from django.contrib import admin
from django.urls import path, include

# Importa las CLASES de vista que definimos en gestion_inmobiliaria.views
from gestion_inmobiliaria.views import (
    GetCSRFToken,
    LoginView,
    LogoutView,
    AuthStatusView
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/gestion/', include('gestion_inmobiliaria.urls')), # Tus URLs de la app

    # Endpoints de Autenticación por Sesión
    path('api/auth/login/', LoginView.as_view(), name='api_login'),
    path('api/auth/logout/', LogoutView.as_view(), name='api_logout'),
    path('api/auth/status/', AuthStatusView.as_view(), name='api_auth_status'),
    path('api/auth/csrf_cookie/', GetCSRFToken.as_view(), name='api_csrf_cookie'),
]
