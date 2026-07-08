"""
URL configuration for portable .exe mode.
Serves Django API + React frontend from a single process.
"""
from django.contrib import admin
from django.urls import path, include
from p2p_project.spa_view import serve_spa

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('calculator.urls')),
    path('', serve_spa, {'path': ''}),
    path('<path:path>', serve_spa),
]
