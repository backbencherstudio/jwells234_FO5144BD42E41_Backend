# Hostinger VPS Production Deployment Guide

## 1) Prepare Hostinger VPS

1. Create an Ubuntu 22.04/24.04 VPS.
2. Point DNS A record for `api.yourdomain.com` to VPS public IP.
3. SSH into VPS and install base packages:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg lsb-release git nginx ufw
```

4. Install Docker Engine + Compose plugin:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

5. Configure firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 2) Prepare Project On Server

1. Create deployment folder and clone repository:

```bash
sudo mkdir -p /srv/backend
sudo chown -R $USER:$USER /srv/backend
git clone <your-repo-url> /srv/backend
cd /srv/backend
```

2. Create production env file:

```bash
cp .env.production.example .env.production
```

3. Edit `.env.production` with real production secrets.

## 3) Run Backend Stack

```bash
cd /srv/backend
docker compose -f docker-compose.prod.yml up -d --build
```

Check status:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
```

## 4) Configure Nginx Reverse Proxy

1. Copy template:

```bash
sudo cp deploy/nginx/backend.conf /etc/nginx/sites-available/backend
```

2. Update `server_name` in `/etc/nginx/sites-available/backend` to your API domain.
3. Enable site and reload nginx:

```bash
sudo ln -s /etc/nginx/sites-available/backend /etc/nginx/sites-enabled/backend
sudo nginx -t
sudo systemctl reload nginx
```

## 5) Enable SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

Use auto-renew check:

```bash
sudo certbot renew --dry-run
```

## 6) Configure GitHub Secrets For CI/CD

Set these repository secrets:

- `VPS_HOST`: VPS public IP or host
- `VPS_USER`: SSH user on VPS
- `VPS_SSH_KEY`: private key content
- `GHCR_USERNAME`: GitHub username for package pull
- `GHCR_TOKEN`: Personal Access Token with `read:packages`
- `ENV_PRODUCTION_FILE`: full content of `.env.production`

The workflow at `.github/workflows/deploy.yml` will:
1. Build and push Docker image to GHCR.
2. SSH into VPS.
3. Write `.env.production` from secret.
4. Pull latest image.
5. Run `docker compose -f docker-compose.prod.yml up -d`.

## 7) Production Checklist

- Use strong secrets for `APP_KEY`, `JWT_SECRET`, `SESSION_SECRET`.
- Keep `SWAGGER_ENABLED=false` in production.
- Restrict `CORS_ORIGINS` to only your frontend domains.
- Rotate any credentials previously committed to local `.env` files.
- Back up PostgreSQL volume regularly.
- Monitor logs with `docker compose logs` and configure external monitoring.
