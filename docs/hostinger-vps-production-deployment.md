# VPS Production Deployment Guide

## 1. System Update & Base Packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg lsb-release git nginx ufw
```

## 2. Install Docker & Docker Compose

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

docker --version
docker compose version
```

## 3. Configure Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 4. Install Node.js, Yarn, PM2

```bash
curl -sL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

sudo npm install -g yarn
sudo npm install -g pm2
```

## 5. Install PostgreSQL

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
```

## 6. Configure PostgreSQL Password

```bash
sudo -i -u postgres
psql
ALTER USER postgres PASSWORD 'root';
\q
exit
```

## 7. Enable PostgreSQL Remote Access

```bash
sudo nano /etc/postgresql/17/main/postgresql.conf
listen_addresses = '*'
sudo nano /etc/postgresql/17/main/pg_hba.conf
host    all             all             0.0.0.0/0               md5
sudo ufw allow 5432/tcp
sudo systemctl restart postgresql
```

## 8. Prepare Backend Directory

```bash
sudo mkdir -p /var/www/backend
sudo chown -R $USER:$USER /var/www/backend
cd /var/www/backend
```

## 9. Clone Project Repository

```bash
git clone <your-repo-url>
cd <project-folder>
```

## 10. Install Dependencies

```bash
yarn install
```

## 11. Setup Environment Variables

```bash
nano .env
```

## 12. Run Database Migration

```bash
npx prisma migrate deploy
```

## 13. Build Backend

```bash
yarn build
```

## 14. Start Backend Using PM2

```bash
pm2 start dist/src/main.js --name backend
pm2 save
pm2 startup
```

## 15. Create Nginx Backend Config

```bash
sudo nano /etc/nginx/sites-available/backend
```

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name backend.yourdomain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 16. Enable Backend Config

```bash
sudo ln -s /etc/nginx/sites-available/backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 17. Install Certbot (SSL)

```bash
sudo snap install core
sudo snap refresh core
sudo apt remove certbot -y
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```

## 18. Generate SSL Certificates

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d backend.yourdomain.com
```

## 19. Create DNS Record for Storage

```text
storage.yourdomain.com → VPS_IP
```

## 20. Create Nginx Config for MinIO Storage

```bash
sudo nano /etc/nginx/sites-available/storage
```

```nginx
server {
    listen 80;

    server_name storage.yourdomain.com;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:9000;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 21. Enable Storage Config

```bash
sudo ln -s /etc/nginx/sites-available/storage /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 22. Generate SSL for Storage

```bash
sudo certbot --nginx -d storage.yourdomain.com
```

## 23. Restart MinIO Container

```bash
docker restart minio
```

## 24. Install MinIO Client

```bash
curl https://dl.min.io/client/mc/release/linux-amd64/mc -o mc
chmod +x mc
sudo mv mc /usr/local/bin/
```

## 25. Connect MinIO CLI

```bash
mc alias set local http://127.0.0.1:9000 MINIO_ROOT_USER MINIO_ROOT_PASSWORD
```

## 26. Create Storage Bucket

```bash
mc mb local/public
```

## 27. Make Bucket Public

```bash
mc anonymous set download local/public
```

## 28. Verify Bucket

```bash
mc ls local
mc anonymous get local/public
```

## 29. Restart Backend

```bash
pm2 restart backend
```

## 30. Verify Services

```bash
pm2 list
docker ps
sudo systemctl status nginx
```