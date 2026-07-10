# Manual de Implementación, Desarrollo y Lanzamiento (Releases)
## P2P Arbitrage Calculator

Este documento es una guía paso a paso, escrita en lenguaje claro y accesible (apta para desarrolladores Junior y perfiles no técnicos), para comprender, desarrollar, compilar y publicar actualizaciones del software **P2P Arbitrage**.

---

## 1. Entendiendo el Proyecto (Arquitectura Simple)

La aplicación consta de dos partes principales que se comunican entre sí:
1.  **El Frontend (Cliente/Interfaz Visual)**: Es la pantalla que ve el usuario final. Está hecha con **React 19** y **TypeScript**. Se encarga de mostrar los datos, permitir registrar movimientos y realizar simulaciones rápidas.
2.  **El Backend (Servidor/Lógica y Base de Datos)**: Es el motor que procesa la información y la guarda de forma segura. Está hecho con **Django 6 (Python)** y utiliza una base de datos **SQLite** (un archivo local llamado `db.sqlite3`).

### Los Modos de Ejecución
*   **Modo Desarrollo**: Se ejecutan tanto el frontend como el backend en paralelo usando consolas separadas. Ideal para modificar código y ver cambios en tiempo real.
*   **Modo Ejecutable Portable (.exe)**: Se compilan ambas partes en una sola aplicación ejecutable para Windows. No requiere que el usuario final instale Python, Node.js ni bases de datos. Todo funciona haciendo doble clic en `P2P_Arbitrage.exe`.

---

## 2. Guía de Inicio Rápido para Desarrollo (Paso a Paso)

Sigue estos pasos en tu computadora (Windows) para levantar el entorno de programación:

### Requisitos Previos
Debes tener instalado:
*   [Python 3.10+](https://www.python.org/downloads/) (Asegúrate de marcar la casilla *"Add Python to PATH"* al instalar).
*   [Node.js (versión 20 o superior)](https://nodejs.org/).
*   [pnpm](https://pnpm.io/installation) (Instálalo abriendo una terminal y ejecutando `npm install -g pnpm`).

### Paso 1: Configurar el Backend (Servidor)
1.  Abre una terminal (PowerShell o CMD) y entra a la carpeta `backend/`:
    ```bash
    cd backend
    ```
2.  Crea un entorno virtual de Python (un espacio aislado para dependencias):
    ```bash
    python -m venv venv
    ```
3.  Activa el entorno virtual:
    ```bash
    venv\Scripts\activate
    ```
4.  Instala las librerías necesarias de Python:
    ```bash
    pip install -r requirements.txt
    ```
5.  Crea y aplica la base de datos local:
    ```bash
    python manage.py migrate
    ```
6.  Inicia el servidor de desarrollo:
    ```bash
    python manage.py runserver
    ```
    *Nota: El servidor estará escuchando en el puerto `http://127.0.0.1:8000/`.*

### Paso 2: Configurar el Frontend (Interfaz Visual)
1.  Abre una **segunda** terminal y entra a la carpeta `frontend/`:
    ```bash
    cd frontend
    ```
2.  Instala las librerías necesarias de React:
    ```bash
    pnpm install
    ```
3.  Inicia el servidor del frontend:
    ```bash
    pnpm dev
    ```
    *Nota: La interfaz se abrirá en `http://localhost:5173/` y redirigirá de forma automática las llamadas de datos al backend en el puerto 8000.*

---

## 3. Guía de Compilación Portable (.exe)

Cuando quieras empaquetar tu código en una aplicación final autoejecutable para Windows, sigue esta sección:

1.  Abre una consola en la raíz del proyecto.
2.  Ejecuta el archivo automatizado de construcción:
    ```cmd
    build.bat
    ```
3.  **¿Qué hace este script de forma automatizada?**
    - Descarga e instala las librerías necesarias en tu Python global.
    - Compila la interfaz visual del frontend (Vite React) generando archivos optimizados en `frontend/dist/`.
    - Recopila los archivos estáticos de Django.
    - Utiliza **PyInstaller** para empaquetar el servidor Python y todas sus dependencias en un ejecutable portable.
    - Copia el frontend compilado y los archivos de versión dentro del directorio final de distribución: `backend/dist/P2P_Arbitrage/`.

El ejecutable final se genera en la subcarpeta correspondiente a la arquitectura de tu entorno de Python actual:
*   Para 64 bits (x64): 📂 `backend\dist\P2P_Arbitrage_x64\P2P_Arbitrage.exe`
*   Para 32 bits (x86): 📂 `backend\dist\P2P_Arbitrage_x86\P2P_Arbitrage.exe`

El script `build.bat` detecta automáticamente qué arquitectura de Python está activa en tu consola para organizar los archivos en su subcarpeta respectiva.

---

## 4. Guía Detallada para Publicar una Nueva Versión (Releases)

El software cuenta con un sistema de **actualización automática** (Auto-Update). Al iniciar, el ejecutable consulta las últimas publicaciones del repositorio en GitHub, detecta la arquitectura del proceso actual (32 bits o 64 bits) y descarga el ZIP correspondiente. Para subir una actualización de forma correcta sin romper este sistema, debes seguir meticulosamente estos pasos:

### Explicación Sencilla: ¿Por qué hay archivos ZIP y SHA256 para cada arquitectura?
*   `P2P_Arbitrage_x64.zip` y `P2P_Arbitrage_x86.zip`: Son los paquetes del software compilados en 64 y 32 bits respectivamente.
*   `P2P_Arbitrage_x64.zip.sha256` y `P2P_Arbitrage_x86.zip.sha256`: Son firmas digitales de seguridad de cada paquete. Al descargar la actualización, el ejecutable del cliente calcula el hash de su ZIP correspondiente y lo compara contra esta firma. Si coinciden, procede; si no, cancela la instalación para prevenir descargas incompletas o modificaciones maliciosas.

### Paso 1: Incrementar el Número de Versión
Abre el archivo `version.json` en la raíz del proyecto y cambia el número de versión (por ejemplo, de `2.1.0` a `2.2.0`):
```json
{
  "version": "2.2.0"
}
```

### Paso 2: Ejecutar la Compilación y Empaquetado Automático
Abre una terminal de comandos en la raíz del proyecto y ejecuta:
```cmd
build.bat
```

**¿Qué hace este script de forma automatizada?**
1.  Instala las dependencias y PyInstaller en tus entornos de Python de 64 y 32 bits usando el lanzador de Windows (`py.exe`).
2.  Construye los recursos optimizados del frontend y recopila los archivos estáticos de Django.
3.  Compila los ejecutables portables tanto para 64 bits (`x64`) como para 32 bits (`x86`).
4.  Comprime ambas versiones en archivos ZIP (`P2P_Arbitrage_x64.zip` y `P2P_Arbitrage_x86.zip`).
5.  Calcula y genera las firmas de integridad SHA-256 (`.sha256`) para cada ZIP.
6.  Genera copias retrocompatibles (`P2P_Arbitrage.zip` y su `.sha256`) para que clientes que vengan de versiones antiguas (v2.1.0) puedan actualizarse automáticamente sin problemas.

Todos los archivos resultantes se guardarán listos en la carpeta:
📂 `backend\dist\`

---

### Paso 3: Crear y Subir el Lanzamiento a GitHub
Puedes hacer esto de dos maneras (elige la que prefieras):

#### Opción A: A través de la Consola (Recomendado y rápido)
Si tienes el CLI de GitHub (`gh`) instalado y autenticado, ejecuta:
```bash
gh release create v2.2.0 backend\dist\P2P_Arbitrage_x64.zip backend\dist\P2P_Arbitrage_x64.zip.sha256 backend\dist\P2P_Arbitrage_x86.zip backend\dist\P2P_Arbitrage_x86.zip.sha256 backend\dist\P2P_Arbitrage.zip backend\dist\P2P_Arbitrage.zip.sha256 --title "v2.2.0" --notes "Notas del release v2.2.0 - Describe tus cambios aquí"
```

#### Opción B: A través de la Página Web de GitHub
1.  Entra a tu repositorio en GitHub: [https://github.com/code-rmendoza/P2P-Arbitraje](https://github.com/code-rmendoza/P2P-Arbitraje).
2.  Haz clic en **"Releases"** en la barra lateral derecha y luego en **"Draft a new release"**.
3.  Crea un nuevo tag (etiqueta) escribiendo exactamente **`v2.2.0`** (con la letra "v" minúscula al inicio).
4.  Escribe el título del lanzamiento (ej. `v2.2.0`) y describe brevemente los cambios realizados.
5.  En la sección de arrastrar archivos (*Attach binaries by dropping them here*), sube **obligatoriamente** los seis archivos ubicados en `backend\dist\`:
    *   📂 `P2P_Arbitrage_x64.zip`
    *   📂 `P2P_Arbitrage_x64.zip.sha256`
    *   📂 `P2P_Arbitrage_x86.zip`
    *   📂 `P2P_Arbitrage_x86.zip.sha256`
    *   📂 `P2P_Arbitrage.zip`
    *   📂 `P2P_Arbitrage.zip.sha256`
6.  Haz clic en **"Publish Release"**.

### Paso 4: Limpieza de Archivos Locales Temporales
Para no ocupar espacio innecesario en tu disco local con archivos binarios duplicados temporales, ejecuta el siguiente comando en PowerShell en la raíz para borrar las carpetas descomprimidas (no te preocupes, los ZIP y las firmas ya están creados en `backend/dist`):
```powershell
Remove-Item -Path "backend/build" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "backend/dist/P2P_Arbitrage_x64" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "backend/dist/P2P_Arbitrage_x86" -Recurse -Force -ErrorAction SilentlyContinue
```
```

### Paso 6: Sincronizar el Cambio de Versión en Git
Por último, registra en el control de versiones que la versión oficial del código fue actualizada:
```bash
git add version.json
git commit -m "Bump version to 2.2.0"
git push origin main
```

---

## 5. Glosario de Términos para No Técnicos

*   **Repository (Repositorio)**: La carpeta en la nube de GitHub donde se aloja todo el código del proyecto.
*   **Commit**: Una instantánea o "guardado" del código en un punto del tiempo con una descripción de lo que se cambió.
*   **Push**: Subir tus cambios locales a la nube de GitHub.
*   **Release (Lanzamiento)**: Una publicación formal de una versión específica del programa, lista para que los usuarios la descarguen.
*   **Hash SHA-256**: Una huella dactilar única para archivos digitales. Si el archivo cambia incluso un solo carácter, el hash cambia por completo. Se usa para verificar que las descargas son seguras y no fueron alteradas.
