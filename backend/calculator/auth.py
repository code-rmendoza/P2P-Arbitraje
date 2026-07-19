import json
import secrets
import hmac
from rest_framework.permissions import BasePermission
from .utils import _get_data_dir


def _get_secret_token():
    data_dir = _get_data_dir()
    token_file = data_dir / 'auth_token.json'
    try:
        with open(token_file, 'r') as f:
            data = json.load(f)
            return data.get('token', '')
    except (FileNotFoundError, json.JSONDecodeError):
        token = secrets.token_urlsafe(32)
        with open(token_file, 'w') as f:
            json.dump({'token': token}, f)
        return token



def _check_auth(request):
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if not auth_header.startswith('Bearer '):
        return False
    token = auth_header.split(' ', 1)[1]
    return hmac.compare_digest(token, _get_secret_token())


class RequireAuthForDestructive(BasePermission):
    """Allow read without auth. Require auth for create/update/delete."""
    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return _check_auth(request)
