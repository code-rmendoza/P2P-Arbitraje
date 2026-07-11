import os
import sys
import shutil
import zipfile
import hashlib
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / 'backend'
FRONTEND = ROOT / 'frontend'
DIST = BACKEND / 'dist'
BUILD = BACKEND / 'build'

def clean_directory(path):
    if path.exists():
        try:
            shutil.rmtree(path)
            print(f"Cleaned directory: {path}")
        except Exception as e:
            print(f"Warning: Could not clean {path}: {e}")

def get_sha256(filename):
    h = hashlib.sha256()
    with open(filename, 'rb') as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest().lower()

def zip_dir(src_dir, zip_name):
    exclude_files = {'db.sqlite3', 'update_state.json', 'secret_key.json', 'auth_token.json'}
    with zipfile.ZipFile(zip_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(src_dir):
            for file in files:
                if file in exclude_files:
                    print(f"Excluding from zip: {file}")
                    continue
                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, src_dir)
                zipf.write(abs_path, rel_path)

def verify_zip(zip_path):
    print(f"Verifying zip: {zip_path}...")
    required_paths = [
        'P2P_Arbitrage.exe',
        '_internal/django/conf/locale',
        'frontend_dist/index.html',
        'version.json'
    ]
    with zipfile.ZipFile(zip_path, 'r') as zf:
        namelist = zf.namelist()
        missing = []
        for req in required_paths:
            found = False
            for name in namelist:
                if name == req or name.startswith(req + '/'):
                    found = True
                    break
            if not found:
                missing.append(req)
        
        if missing:
            raise RuntimeError(f"Zip validation failed for {zip_path}. Missing required elements: {missing}")
        print(f"Zip validation passed for {zip_path}! Contains {len(namelist)} items.")

def run_command(args, cwd):
    print(f"Running command: {' '.join(args)} in {cwd}")
    res = subprocess.run(args, cwd=str(cwd), capture_output=True, text=True, shell=True)
    if res.returncode != 0:
        print("STDOUT:", res.stdout)
        print("STDERR:", res.stderr)
        raise RuntimeError(f"Command failed: {args}")

def main():
    # 1. Clean build directories
    print("Step 1: Cleaning directories...")
    clean_directory(BUILD)
    clean_directory(DIST)

    # 2. Build Frontend
    print("\nStep 2: Building Frontend...")
    run_command(['pnpm', 'install'], FRONTEND)
    run_command(['pnpm', 'build'], FRONTEND)

    # 3. Collect Static
    print("\nStep 3: Collecting Django static files...")
    run_command(['py', '-3-64', 'manage.py', 'collectstatic', '--noinput'], BACKEND)

    # 4. Build x64
    print("\nStep 4: Compiling x64 executable...")
    run_command(['py', '-3-64', '-m', 'PyInstaller', '../P2P_Portable.spec', '--noconfirm', '--clean'], BACKEND)
    
    x64_dir = DIST / 'P2P_Arbitrage_x64'
    shutil.move(DIST / 'P2P_Arbitrage', x64_dir)
    shutil.copytree(FRONTEND / 'dist', x64_dir / 'frontend_dist')
    shutil.copy2(ROOT / 'version.json', x64_dir / 'version.json')
    shutil.copy2(ROOT / 'release_config.json', x64_dir / 'release_config.json')

    # 5. Build x86
    print("\nStep 5: Compiling x86 executable...")
    run_command(['py', '-3-32', '-m', 'PyInstaller', '../P2P_Portable.spec', '--noconfirm', '--clean'], BACKEND)
    
    x86_dir = DIST / 'P2P_Arbitrage_x86'
    shutil.move(DIST / 'P2P_Arbitrage', x86_dir)
    shutil.copytree(FRONTEND / 'dist', x86_dir / 'frontend_dist')
    shutil.copy2(ROOT / 'version.json', x86_dir / 'version.json')
    shutil.copy2(ROOT / 'release_config.json', x86_dir / 'release_config.json')

    # 6. Compress and sign
    print("\nStep 6: Compressing and generating signatures...")
    zip_x64 = DIST / 'P2P_Arbitrage_x64.zip'
    zip_dir(x64_dir, zip_x64)
    verify_zip(zip_x64)
    hash_x64 = get_sha256(zip_x64)
    with open(str(zip_x64) + '.sha256', 'w', encoding='ascii') as f:
        f.write(f"{hash_x64}  P2P_Arbitrage_x64.zip\n")

    zip_x86 = DIST / 'P2P_Arbitrage_x86.zip'
    zip_dir(x86_dir, zip_x86)
    verify_zip(zip_x86)
    hash_x86 = get_sha256(zip_x86)
    with open(str(zip_x86) + '.sha256', 'w', encoding='ascii') as f:
        f.write(f"{hash_x86}  P2P_Arbitrage_x86.zip\n")

    # 7. Copy fallback
    print("\nStep 7: Copying fallback zip...")
    shutil.copy2(zip_x64, DIST / 'P2P_Arbitrage.zip')
    shutil.copy2(str(zip_x64) + '.sha256', DIST / 'P2P_Arbitrage.zip.sha256')

    # 8. Final clean up of unpacked folders
    print("\nStep 8: Cleaning up unpacked folders...")
    clean_directory(BUILD)
    clean_directory(x64_dir)
    clean_directory(x86_dir)

    print("\nBUILD SUCCESSFUL!")

if __name__ == '__main__':
    main()
