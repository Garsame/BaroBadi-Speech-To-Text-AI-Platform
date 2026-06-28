# Ubuntu VPS Deployment Guide & Roadmap

This document serves as the complete operational guide and roadmap for deploying the **BaroBadi Speech-to-Text & AI Note Generation Platform** to your Ubuntu 24.04 LTS VPS (hosted on VPSDime) using your custom domain: `baro-platform.elivateict.com`.

---

## 1. Production Architecture Overview

The system runs on a single VPS using the following components:

```
                            [ Web Traffic (HTTP/HTTPS) ]
                                         │
                                         ▼
                                  [ Nginx Server ]
                                (Port 80 / Port 443)
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼ (Proxy to Port 3000)                          ▼ (Proxy to Port 8000)
         [ Next.js Frontend ]                            [ FastAPI Backend ]
        Managed by PM2 Process                          Managed by Systemd/Gunicorn
                 │                                               │
                 │                                       ┌───────┴───────┐
                 │                                       ▼               ▼
                 │                              [ Local Uploads ]   [ PostgreSQL ]
                 └─────────────────────────────► (Audio/Profiles)  (somali_notes_db)
```

---

## 2. Pre-Deployment Checklists

Before beginning the installation, ensure you have the following details ready:

### Server & Domain Details
* **Server IP Address:** `104.251.222.122`
* **Root Password:** `WadsetIslingEmboleClang` (copied from setup)
* **Production Domain:** `baro-platform.elivateict.com` (pointed to the server IP)

### API Keys & Environment Configurations
Ensure you have the production values for these keys:
* **Google Client ID & Secret** (for Google Login)
* **Google Gemini API Key** (for Somali note generation)
* **OpenAI API Key** (for Whisper audio transcription)
* **Azure Speech Key & Region** (for Somali text-to-speech audio reviews)
* **SMTP Credentials** (Host, Port, Username, Password for email verification)

---

## 3. Step-by-Step Deployment Roadmap

### Phase 1: Server Initialization & Dependency Installation
Connect to your VPS via SSH as the root user:
```bash
ssh root@104.251.222.122
```

Update system packages and install python, git, postgresql, nginx, and ffmpeg:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv git nginx postgresql postgresql-contrib ffmpeg
```

Install Node.js v20 (needed for Next.js 16 compiler):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

---

### Phase 2: Production PostgreSQL Setup
Initialize the database instance, create a dedicated database user, and configure database permissions:

1. Log into the PostgreSQL CLI:
   ```bash
   sudo -i -u postgres psql
   ```
2. Run these SQL queries (replace `'your_secure_password'` with a secure password):
   ```sql
   CREATE DATABASE somali_notes_db;
   CREATE USER speech_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE somali_notes_db TO speech_user;
   \q
   ```

---

### Phase 3: Project Setup & Code Retrieval
Clone the repository from GitHub into the `/var/www/` directory:
```bash
sudo mkdir -p /var/www/baro-platform
sudo chown -R $USER:$USER /var/www/baro-platform
cd /var/www/baro-platform

# Clone the main branch
git clone -b main https://github.com/Garsame/BaroBadi-Speech-To-Text-AI-Platform.git .
```

---

### Phase 4: Backend Setup & Configuration

1. Create a Python Virtual Environment:
   ```bash
   cd /var/www/baro-platform/backend
   python3 -m venv venv
   source venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

2. Create the production backend configuration file:
   ```bash
   nano .env
   ```
   **Paste the following configuration template** (fill in your actual API keys):
   ```env
   SECRET_KEY="GenerateAStrongRandomStringHere"
   DATABASE_URL="postgresql://speech_user:your_secure_password@localhost:5432/somali_notes_db"
   
   # AI Service Keys
   OPENAI_API_KEY="your-openai-api-key"
   GEMINI_API_KEY="your-gemini-api-key"
   AZURE_SPEECH_KEY="your-azure-speech-key"
   AZURE_SPEECH_REGION="eastus" # or your azure region
   
   # Core Config
   GEMMA_MODEL="gemini-2.5-flash"
   USE_CELERY=False
   USE_OPENAI_FOR_TRANSCRIPTION=True
   
   # SMTP Email Settings
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT=587
   SMTP_TLS=True
   SMTP_USER="your-email@gmail.com"
   SMTP_PASSWORD="your-gmail-app-password"
   SMTP_FROM_EMAIL="your-email@gmail.com"
   ```

3. Run the database migrations to create the tables:
   ```bash
   alembic upgrade head
   ```

---

### Phase 5: Backend Process Management (Systemd)
To ensure the backend FastAPI app runs 24/7 in the background, we run it as a Linux Systemd service.

1. Create the service file:
   ```bash
   sudo nano /etc/systemd/system/baro-backend.service
   ```
2. Paste the service configuration:
   ```ini
   [Unit]
   Description=BaroBadi FastAPI Backend
   After=network.target

   [Service]
   User=root
   WorkingDirectory=/var/www/baro-platform/backend
   ExecStart=/var/www/baro-platform/backend/venv/bin/gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 127.0.0.1:8000
   Restart=always
   Environment=PATH=/var/www/baro-platform/backend/venv/bin:/usr/bin:/usr/local/bin

   [Install]
   WantedBy=multi-user.target
   ```
3. Start and enable the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl start baro-backend
   sudo systemctl enable baro-backend
   ```

---

### Phase 6: Frontend Setup & Process Management (PM2)

1. Navigate to the frontend directory:
   ```bash
   cd /var/www/baro-platform/frontend
   ```

2. Create the production environment file:
   ```bash
   nano .env.local
   ```
   **Paste the following details:**
   ```env
   NEXT_PUBLIC_API_BASE_URL="https://baro-platform.elivateict.com"
   NEXT_PUBLIC_GOOGLE_CLIENT_ID="your-google-client-id-here"
   ```

3. Install dependencies and compile Next.js:
   ```bash
   npm install
   npm run build
   ```

4. Start Next.js using PM2 so it stays active:
   ```bash
   pm2 start npm --name "baro-frontend" -- run start
   pm2 save
   pm2 startup
   ```

---

### Phase 7: Nginx Web Server Configuration
Configure Nginx as a reverse proxy, routing browser requests to the Next.js frontend (port 3000), backend API requests to FastAPI (port 8000), and serving uploads locally.

1. Create the site configuration:
   ```bash
   sudo nano /etc/nginx/sites-available/baro-platform
   ```
2. Paste this Nginx configuration block:
   ```nginx
   server {
       listen 80;
       server_name baro-platform.elivateict.com;

       # Max file upload size (needed for large video/audio lecture uploads)
       client_max_body_size 100M;

       # Serve static uploads directly through Nginx (highly optimized)
       location /uploads/ {
           alias /var/www/baro-platform/backend/uploads/;
           expires 7d;
           add_header Cache-Control "public";
       }

       # Route API requests to the FastAPI backend
       location /api/ {
           proxy_pass http://127.0.0.1:8000/api/;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       # Route page requests to the Next.js frontend
       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
3. Enable the site and restart Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/baro-platform /etc/nginx/sites-enabled/
   sudo rm /etc/nginx/sites-enabled/default
   sudo nginx -t
   sudo systemctl restart nginx
   ```

---

### Phase 8: SSL Encryption (HTTPS)
Install Certbot to secure your website with free Let's Encrypt SSL certificates:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d baro-platform.elivateict.com
```
*Select option `2` to automatically redirect all HTTP traffic to HTTPS.*

---

### Phase 9: Google Developer Credentials Adjustment
To avoid a `redirect_uri_mismatch` error when users log in with Google:
1. Go to your **Google Cloud Console** -> **APIs & Services** -> **Credentials**.
2. Edit your **OAuth 2.0 Client ID**.
3. In **Authorized JavaScript Origins**, add:
   * `https://baro-platform.elivateict.com`
4. In **Authorized Redirect URIs**, add:
   * `https://baro-platform.elivateict.com/api/v1/auth/google/callback`
5. Save changes (takes about 5 minutes to propagate).

---

## 4. Post-Deployment Verification Steps

After completing all phases, verify functionality in order:
1. Load `https://baro-platform.elivateict.com` in your browser. Confirm the SSL certificate is active (padlock icon).
2. Go to the Sign-up page, register a new account, and check if you receive the verification email.
3. Try signing in with Google.
4. Upload a small audio/video lecture. Open the developer console (F12) to monitor the upload progress.
5. Verify the background pipeline runs, extracts audio, calls OpenAI/Gemini, and displays Somali notes and quizzes successfully.
6. Verify profile image uploads write correctly to `/var/www/baro-platform/backend/uploads/profiles` and load correctly on the dashboard.
