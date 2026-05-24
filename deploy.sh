#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — Production deployment for Architecture Management System
# Target: Linux server with 4 GB RAM, no cloud connection
# ─────────────────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODEL="gemma4:e2b"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── 1. Check RAM ──────────────────────────────────────────────────────────────
TOTAL_RAM_MB=$(awk '/MemTotal/ { printf "%.0f", $2/1024 }' /proc/meminfo)
info "Total RAM: ${TOTAL_RAM_MB} MB"
if [ "$TOTAL_RAM_MB" -lt 3500 ]; then
  error "Insufficient RAM. Minimum 3.5 GB required (found ${TOTAL_RAM_MB} MB)."
fi

# ── 2. Install Docker if missing ──────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  info "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  usermod -aG docker "$USER" || true
  info "Docker installed. You may need to re-login for group changes."
else
  info "Docker already installed: $(docker --version)"
fi

if ! docker compose version &>/dev/null; then
  info "Installing Docker Compose plugin..."
  apt-get install -y docker-compose-plugin 2>/dev/null || \
    yum install -y docker-compose-plugin 2>/dev/null || \
    error "Could not install docker compose plugin. Install manually."
fi

# ── 3. Check Node.js ──────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  info "Installing Node.js 18..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt-get install -y nodejs || yum install -y nodejs
fi
info "Node: $(node --version)"

# ── 4. Start infrastructure services ─────────────────────────────────────────
cd "$SCRIPT_DIR"
info "Starting PostgreSQL and Ollama containers..."
docker compose up -d postgres ollama

info "Waiting for PostgreSQL to be ready..."
until docker compose exec -T postgres pg_isready -U arch_user -d architecture_db &>/dev/null; do
  sleep 2
done
info "PostgreSQL ready."

# ── 5. Pull the AI model ──────────────────────────────────────────────────────
info "Pulling model: $MODEL (this may take several minutes on first run)..."
# Wait for Ollama container to be ready
until curl -s http://localhost:11434/api/tags &>/dev/null; do
  sleep 3
  info "Waiting for Ollama to start..."
done

# Check if model already pulled
if curl -s http://localhost:11434/api/tags | grep -q "$MODEL"; then
  info "Model $MODEL already present, skipping pull."
else
  docker exec architecture-ollama ollama pull "$MODEL" || \
    error "Failed to pull model $MODEL. Check internet connection for first-time setup."
fi
info "Model ready: $MODEL"

# ── 6. Install app dependencies ───────────────────────────────────────────────
info "Installing server dependencies..."
cd "$SCRIPT_DIR/server"
npm ci --omit=dev

info "Installing client dependencies and building..."
cd "$SCRIPT_DIR/client"
npm ci
npm run build

# ── 7. Seed database ──────────────────────────────────────────────────────────
cd "$SCRIPT_DIR/server"
info "Running database seed..."
node src/seed.js || warn "Seed may have already run (safe to ignore if tables exist)."

# ── 8. Configure production .env ──────────────────────────────────────────────
if [ ! -f "$SCRIPT_DIR/server/.env" ]; then
  warn "No .env found. Creating from template..."
  cp "$SCRIPT_DIR/server/.env.example" "$SCRIPT_DIR/server/.env" 2>/dev/null || cat > "$SCRIPT_DIR/server/.env" << EOF
PORT=3001
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=architecture_db
DB_USER=arch_user
DB_PASSWORD=arch_pass_2024
JWT_SECRET=CHANGE_THIS_IN_PRODUCTION_$(openssl rand -hex 32)
JWT_REFRESH_SECRET=CHANGE_THIS_IN_PRODUCTION_$(openssl rand -hex 32)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
UPLOAD_DIR=src/uploads
MAX_FILE_SIZE=10485760
CLIENT_URL=http://localhost:5173
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:e2b
EOF
  warn "Review and update $SCRIPT_DIR/server/.env before starting the server."
else
  # Ensure OLLAMA vars are present
  grep -q "OLLAMA_URL" "$SCRIPT_DIR/server/.env" || \
    echo -e "\nOLLAMA_URL=http://localhost:11434\nOLLAMA_MODEL=gemma4:e2b" >> "$SCRIPT_DIR/server/.env"
  info ".env already exists — OLLAMA vars checked."
fi

# ── 9. Set up systemd service for the Node server ─────────────────────────────
SERVICE_FILE="/etc/systemd/system/architecture.service"
if [ ! -f "$SERVICE_FILE" ]; then
  info "Creating systemd service..."
  cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Architecture Management System
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$SCRIPT_DIR/server
ExecStart=$(which node) src/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
# Limit Node.js heap to 512MB to protect the 4GB system
Environment=NODE_OPTIONS=--max-old-space-size=512

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable architecture
  info "Systemd service created: architecture.service"
fi

# ── 10. Start the app ─────────────────────────────────────────────────────────
info "Starting Architecture Management System..."
systemctl restart architecture || node "$SCRIPT_DIR/server/src/index.js" &

echo ""
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Deployment complete!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "  App:    http://localhost:3001"
echo -e "  Ollama: http://localhost:11434"
echo -e "  Model:  $MODEL"
echo -e "${YELLOW}  Default credentials: admin / Admin@1234${NC}"
echo -e "${RED}  Change the JWT secrets in .env before going live!${NC}"
echo ""
