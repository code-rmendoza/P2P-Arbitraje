# Stage 1: Build frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

# Habilitar corepack para usar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm build

# Stage 2: Run backend
FROM python:3.12-slim
WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV P2P_PORT=8000
ENV P2P_HOST=0.0.0.0
ENV P2P_DATA_DIR=/app/data

# Crear directorio de datos para persistencia
RUN mkdir -p /app/data

# Copiar dependencias de Python e instalar
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el backend de Django
COPY backend/ ./backend

# Copiar el script del servidor portable
COPY run_server.py ./

# Copiar los estáticos compilados del frontend al directorio frontend_dist
COPY --from=frontend-builder /app/frontend/dist ./frontend_dist

# Exponer puerto del servidor
EXPOSE 8000

# Ejecutar el servidor Waitress
CMD ["python", "run_server.py"]
