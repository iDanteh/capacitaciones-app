# Configuración del VPS en Hetzner

## 1. Crear el servidor

- **Plan:** CX22 (2 vCPU AMD, 4GB RAM, 40GB NVMe SSD) — ~€4.49/mes
- **OS:** Ubuntu 24.04 LTS
- **Ubicación:** Nuremberg o Helsinki (más cercano a Latam = Helsinki)
- **SSH Key:** Agregar tu clave pública durante la creación

## 2. Configuración inicial del servidor

```bash
# Conectarse al VPS
ssh root@<IP_DEL_VPS>

# Actualizar paquetes
apt update && apt upgrade -y

# Crear usuario de deploy (no trabajar como root)
adduser deploy
usermod -aG sudo deploy

# Copiar clave SSH al nuevo usuario
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh

# Cambiar a usuario deploy
su - deploy
```

## 3. Instalar Docker

```bash
# Instalación oficial de Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Verificar instalación
docker --version
docker compose version
```

## 4. Configurar el proyecto en el VPS

```bash
# Crear directorio del proyecto
sudo mkdir -p /opt/capacitaciones
sudo chown deploy:deploy /opt/capacitaciones
cd /opt/capacitaciones

# Clonar el repositorio (o copiar solo los archivos necesarios)
git clone https://github.com/TU_USUARIO/capacitaciones-app.git .

# Crear archivo .env de producción (NUNCA commitear este archivo)
cp apps/api/.env.example .env
nano .env  # ← Rellenar con valores reales de producción
```

## 5. Configurar GitHub Secrets

En tu repositorio de GitHub → Settings → Secrets and variables → Actions:

| Secret | Valor |
|--------|-------|
| `VPS_HOST` | IP del VPS (ej: 65.109.XX.XX) |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | Contenido completo de `~/.ssh/id_rsa` (clave privada) |

## 6. Obtener certificado SSL con Let's Encrypt

```bash
# En el VPS, instalar Certbot
sudo apt install certbot -y

# Generar certificado (con Cloudflare como proxy, usar certbot standalone)
# Primero, apuntar el DNS del dominio al VPS en Cloudflare
sudo certbot certonly --standalone -d api.tudominio.com

# Los certs quedan en:
# /etc/letsencrypt/live/api.tudominio.com/fullchain.pem
# /etc/letsencrypt/live/api.tudominio.com/privkey.pem

# Copiar certs al directorio nginx
sudo cp /etc/letsencrypt/live/api.tudominio.com/fullchain.pem /opt/capacitaciones/nginx/certs/
sudo cp /etc/letsencrypt/live/api.tudominio.com/privkey.pem /opt/capacitaciones/nginx/certs/
```

## 7. Primer deploy manual

```bash
cd /opt/capacitaciones

# Login a GitHub Container Registry
echo "GITHUB_TOKEN" | docker login ghcr.io -u TU_USUARIO --password-stdin

# Levantar todo
docker compose -f docker/docker-compose.prod.yml up -d

# Verificar que corre
docker ps
docker compose -f docker/docker-compose.prod.yml logs api
```

## 8. Renovación automática de SSL

```bash
# Agregar cron job para renovar certificados
sudo crontab -e

# Agregar esta línea:
0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/api.tudominio.com/*.pem /opt/capacitaciones/nginx/certs/ && docker compose -f /opt/capacitaciones/docker/docker-compose.prod.yml restart nginx
```

## Diagrama de red

```
Internet
    │
    ▼
Cloudflare (DNS + CDN + DDoS protection)
    │
    ▼
Hetzner VPS :443
    │
    ▼
Nginx (reverse proxy + SSL termination)
    │
    ├──→ :3001  NestJS API (Docker)
    │
    └──→ Postgres :5432 (Docker, solo accesible internamente)
         Redis    :6379 (Docker, solo accesible internamente)

Vercel (Next.js frontend)
    │
    └──→ NEXT_PUBLIC_API_URL → api.tudominio.com
```
