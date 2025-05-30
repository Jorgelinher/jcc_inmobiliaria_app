# jcc_inmobiliaria_backend/config/urls.py
from django.contrib import admin
from django.urls import path, include

# Import views from the 'gestion_inmobiliaria' app
# Using an alias 'gestion_views' for clarity if you have many apps
from gestion_inmobiliaria import views as gestion_views

urlpatterns = [
    path('admin/', admin.site.urls),

    # Include URLs from the 'gestion_inmobiliaria' app, prefixed with 'api/gestion/'
    # This is typically for your ModelViewSets (Lotes, Clientes, etc.) and other app-specific views
    path('api/gestion/', include('gestion_inmobiliaria.urls')),

    # Authentication Endpoints
    # These paths directly use views from the 'gestion_inmobiliaria' app.
    # The frontend (apiService.js) calls these exact paths (e.g., /api/auth/login/).
    path('api/auth/get-csrf-token/', gestion_views.GetCSRFToken.as_view(), name='api_get_csrf_token'),
    path('api/auth/login/', gestion_views.LoginView.as_view(), name='api_login'),
    path('api/auth/logout/', gestion_views.LogoutView.as_view(), name='api_logout'),
    path('api/auth/status/', gestion_views.AuthStatusView.as_view(), name='api_auth_status'),

    # You might later add other project-wide URLs here if needed
]
