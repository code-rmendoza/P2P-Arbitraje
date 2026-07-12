# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for P2P Arbitrage Portable
Build: pyinstaller P2P_Portable.spec
"""
import os

block_cipher = None
ROOT = os.path.dirname(os.path.abspath(SPEC))
BACKEND = os.path.join(ROOT, 'backend')

django_imports = [
    'django',
    'django.contrib',
    'django.contrib.admin',
    'django.contrib.admin.templatetags',
    'django.contrib.admin.templatetags.admin_list',
    'django.contrib.admin.templatetags.admin_urls',
    'django.contrib.admin.templatetags.log',
    'django.contrib.auth',
    'django.contrib.auth.backends',
    'django.contrib.auth.hashers',
    'django.contrib.auth.tokens',
    'django.contrib.contenttypes',
    'django.contrib.contenttypes.models',
    'django.contrib.sessions',
    'django.contrib.sessions.backends.db',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.staticfiles.finders',
    'django.contrib.staticfiles.storage',
    'django.core.cache',
    'django.core.cache.backends.db',
    'django.core.exceptions',
    'django.core.files',
    'django.core.files.storage',
    'django.core.files.uploadedfile',
    'django.core.handlers',
    'django.core.handlers.wsgi',
    'django.core.management',
    'django.core.management.commands.migrate',
    'django.core.management.commands.runserver',
    'django.core.serializers',
    'django.core.serializers.json',
    'django.core.validators',
    'django.db',
    'django.db.backends',
    'django.db.backends.sqlite3',
    'django.db.backends.sqlite3.base',
    'django.db.backends.sqlite3.operations',
    'django.db.models',
    'django.db.models.deletion',
    'django.db.models.fields',
    'django.db.models.query',
    'django.db.transaction',
    'django.dispatch',
    'django.forms',
    'django.http',
    'django.middleware',
    'django.middleware.common',
    'django.middleware.csrf',
    'django.shortcuts',
    'django.template',
    'django.template.backends',
    'django.template.backends.django',
    'django.template.defaultfilters',
    'django.template.loader',
    'django.utils',
    'django.utils.dateformat',
    'django.utils.encoding',
    'django.utils.functional',
    'django.utils.safestring',
    'django.utils.timezone',
    'django.views',
    'django.views.static',
    'rest_framework',
    'rest_framework.authentication',
    'rest_framework.authtoken',
    'rest_framework.authtoken.models',
    'rest_framework.authtoken.serializers',
    'rest_framework.authtoken.views',
    'rest_framework.fields',
    'rest_framework.filters',
    'rest_framework.generics',
    'rest_framework.metadata',
    'rest_framework.negotiation',
    'rest_framework.parsers',
    'rest_framework.permissions',
    'rest_framework.relations',
    'rest_framework.response',
    'rest_framework.routers',
    'rest_framework.schemas',
    'rest_framework.serializers',
    'rest_framework.settings',
    'rest_framework.status',
    'rest_framework.throttling',
    'rest_framework.utils',
    'rest_framework.utils.field_mapping',
    'rest_framework.utils.serializer_helpers',
    'rest_framework.validators',
    'rest_framework.viewsets',
    'corsheaders',
    'corsheaders.middleware',
    'calculator',
    'calculator.models',
    'calculator.views',
    'calculator.serializers',
    'calculator.urls',
    'calculator.admin',
    'calculator.apps',
    'p2p_project',
    'p2p_project.settings',
    'p2p_project.urls',
    'p2p_project.wsgi',
    'waitress',
    'bs4',
    'urllib3',
    'requests',
]

# Dynamically add all migrations of the calculator app
migrations_dir = os.path.join(BACKEND, 'calculator', 'migrations')
if os.path.exists(migrations_dir):
    django_imports.append('calculator.migrations')
    for f in os.listdir(migrations_dir):
        if f.endswith('.py') and not f.startswith('__'):
            django_imports.append(f"calculator.migrations.{f[:-3]}")

import django
django_dir = os.path.dirname(django.__file__)
django_locale = os.path.join(django_dir, 'conf', 'locale')

# Config files for auto-update system
config_datas = [
    (os.path.join(ROOT, 'version.json'), '.'),
    (os.path.join(ROOT, 'release_config.json'), '.'),
    (django_locale, os.path.join('django', 'conf', 'locale')),
]

a = Analysis(
    [os.path.join(ROOT, 'run_server.py')],
    pathex=[ROOT, BACKEND],
    binaries=[],
    datas=config_datas,
    hiddenimports=django_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='P2P_Arbitrage',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    icon=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='P2P_Arbitrage',
)
