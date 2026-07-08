"""
SPA view that serves the React frontend from frontend/dist.
Used when running as a portable .exe.
"""
import os
import sys
from pathlib import Path
from django.http import FileResponse, HttpResponseNotFound
from django.views.decorators.http import require_GET


def get_frontend_dist():
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent / 'frontend_dist'
    return Path(__file__).resolve().parent.parent.parent / 'frontend' / 'dist'


@require_GET
def serve_spa(request, path=''):
    dist = get_frontend_dist()
    file_path = dist / path

    if path and file_path.is_file():
        return FileResponse(file_path.open('rb'))

    index = dist / 'index.html'
    if index.is_file():
        return FileResponse(index.open('rb'))

    return HttpResponseNotFound('Frontend not built. Run: cd frontend && pnpm build')
