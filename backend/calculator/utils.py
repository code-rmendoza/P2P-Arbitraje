import sys
import json
from pathlib import Path


def _get_data_dir():
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent
    return Path(__file__).resolve().parent.parent


def load_json(path, default=None):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def parse_version(v):
    try:
        parts = v.strip().lstrip('v').split('.')
        return tuple(int(x) for x in parts)
    except (ValueError, AttributeError):
        return (0, 0, 0)
