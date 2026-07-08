#!/usr/bin/env python
"""
P2P Arbitrage - Portable Server
"""
import os
import sys
import threading
import time
import webbrowser
from pathlib import Path

def get_base_path():
    if getattr(sys, 'frozen', False):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent

def get_data_path():
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent
    return Path(__file__).resolve().parent

BASE_DIR = get_base_path()
DATA_DIR = get_data_path()

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'p2p_project.settings')

import django
from django.conf import settings
from django.core.wsgi import get_wsgi_application
from django.core.management import call_command
from waitress import serve

settings.DATABASES['default']['NAME'] = str(DATA_DIR / 'db.sqlite3')
settings.STATIC_ROOT = str(BASE_DIR / 'staticfiles')
settings.DEBUG = False
settings.ALLOWED_HOSTS = ['*']
settings.CORS_ALLOWED_ORIGINS = []
settings.CORS_ALLOW_ALL_ORIGINS = True

django.setup()

db_path = DATA_DIR / 'db.sqlite3'
if not db_path.exists():
    call_command('migrate', '--run-syncdb', verbosity=0)

django_app = get_wsgi_application()

if getattr(sys, 'frozen', False):
    FRONTEND_DIST = Path(sys.executable).parent / 'frontend_dist'
    INDEX_FILE = FRONTEND_DIST / 'index.html'

    class SPAMiddleware:
        def __init__(self, app):
            self.app = app

        def __call__(self, environ, start_response):
            path = environ.get('PATH_INFO', '/')
            if path.startswith('/api/') or path.startswith('/admin/'):
                return self.app(environ, start_response)
            if path != '/':
                file_path = os.path.join(str(FRONTEND_DIST), path.lstrip('/'))
                if os.path.isfile(file_path):
                    import mimetypes
                    ct, _ = mimetypes.guess_type(file_path)
                    with open(file_path, 'rb') as f:
                        content = f.read()
                    start_response('200 OK', [('Content-Type', ct or 'application/octet-stream'), ('Content-Length', str(len(content)))])
                    return [content]
            if os.path.isfile(str(INDEX_FILE)):
                with open(str(INDEX_FILE), 'rb') as f:
                    content = f.read()
                start_response('200 OK', [('Content-Type', 'text/html'), ('Content-Length', str(len(content)))])
                return [content]
            return self.app(environ, start_response)

    wsgi_app = SPAMiddleware(django_app)
else:
    wsgi_app = django_app

PORT = int(os.environ.get('P2P_PORT', 8000))
HOST = '127.0.0.1'

def open_browser():
    time.sleep(1.5)
    webbrowser.open(f'http://{HOST}:{PORT}')

if __name__ == '__main__':
    threading.Thread(target=open_browser, daemon=True).start()
    try:
        serve(wsgi_app, host=HOST, port=PORT, threads=4)
    except KeyboardInterrupt:
        pass
