#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-prod.sh — Production setup for Architecture Management System
# Target: Linux server, 8 GB RAM, no cloud connection
#
# Run once as root (or with sudo) to prepare the server.
# ─────────────────────────────────────────────────────────────────────────────
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODEL="gemma4:e2b"
SWAP_FILE="/swapfile"
SWAP_SIZE_GB=4

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${GREEN}[✔]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
step()    { echo -e "\n${CYAN}══ $1 ══${NC}"; }
error()   { echo -e "${RED}[✘] $1${NC}"; exit 1; }

# ────────────────────────────────────────────────────────────────────────────
step "1 · System Check"
# ────────────────────────────────────────────────────────────────────────────
TOTAL_RAM_MB=$(awk '/MemTotal/ { printf "%.0f", $2/1024 }' /proc/meminfo)
info "RAM: ${TOTAL_RAM_MB} MB"
[ "$TOTAL_RAM_MB" -lt 7000 ] && warn "Less than 8 GB RAM detected — performance may be reduced."

FREE_DISK_GB=$(df -BG / | awk 'NR==2 { print $4 }' | tr -d 'G')
info "Free disk: ${FREE_DISK_GB} GB"
[ "$FREE_DISK_GB" -lt 12 ] && warn "Low disk space. Need ~12 GB free for swap + model."

# ────────────────────────────────────────────────────────────────────────────
step "2 · Swap File (${SWAP_SIZE_GB}GB) — Safety net for peak inference load"
# ────────────────────────────────────────────────────────────────────────────
# 8GB RAM is sufficient for normal operation; 4GB swap covers edge cases
# where multiple large images are analysed back-to-back.

if [ -f "$SWAP_FILE" ]; then
  CURRENT_SWAP=$(swapon --show=SIZE --noheadings 2>/dev/null | head -1 | tr -d ' G')
  if [ "${CURRENT_SWAP:-0}" -ge "$SWAP_SIZE_GB" ]; then
    info "Swap already configured (${CURRENT_SWAP}G). Skipping."
  else
    warn "Existing swap is smaller than required. Re-creating..."
    swapoff "$SWAP_FILE" 2>/dev/null || true
    rm -f "$SWAP_FILE"
    create_swap=true
  fi
else
  create_swap=true
fi

if [ "${create_swap:-false}" = true ]; then
  info "Creating ${SWAP_SIZE_GB}GB swap file at $SWAP_FILE ..."
  fallocate -l "${SWAP_SIZE_GB}G" "$SWAP_FILE" || \
    dd if=/dev/zero of="$SWAP_FILE" bs=1M count=$((SWAP_SIZE_GB * 1024)) status=progress
  chmod 600 "$SWAP_FILE"
  mkswap "$SWAP_FILE"
  swapon "$SWAP_FILE"
  info "Swap active."

  # Persist across reboots
  grep -q "$SWAP_FILE" /etc/fstab || echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab

  # Tune swappiness: use swap only as last resort on 8GB machine
  sysctl -w vm.swappiness=5 > /dev/null
  grep -q "vm.swappiness" /etc/sysctl.conf && \
    sed -i 's/vm.swappiness=.*/vm.swappiness=5/' /etc/sysctl.conf || \
    echo "vm.swappiness=5" >> /etc/sysctl.conf
  info "Swappiness set to 5 (swap used only as last resort)."
fi

# ────────────────────────────────────────────────────────────────────────────
step "3 · Docker"
# ────────────────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  info "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
  usermod -aG docker "${SUDO_USER:-$USER}" || true
else
  info "Docker: $(docker --version)"
fi

# ────────────────────────────────────────────────────────────────────────────
step "4 · Node.js"
# ────────────────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  info "Installing Node.js 18..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt-get install -y nodejs 2>/dev/null || yum install -y nodejs
fi
info "Node: $(node --version) | npm: $(npm --version)"

# ────────────────────────────────────────────────────────────────────────────
step "5 · Start Infrastructure Containers"
# ────────────────────────────────────────────────────────────────────────────
cd "$SCRIPT_DIR"
info "Starting PostgreSQL and Ollama..."
docker compose up -d postgres ollama

info "Waiting for PostgreSQL..."
until docker compose exec -T postgres pg_isready -U arch_user -d architecture_db &>/dev/null; do
  sleep 2
done
info "PostgreSQL ready."

info "Waiting for Ollama API..."
for i in {1..30}; do
  curl -s http://localhost:11434/api/tags &>/dev/null && break
  sleep 3
  [ "$i" -eq 30 ] && error "Ollama did not start in time."
done
info "Ollama ready."

# ────────────────────────────────────────────────────────────────────────────
step "6 · Pull AI Model: $MODEL"
# ────────────────────────────────────────────────────────────────────────────
if curl -s http://localhost:11434/api/tags | grep -q "\"$MODEL\""; then
  info "Model '$MODEL' already present."
else
  info "Pulling $MODEL (Q4 quantization, ~1.5 GB)..."
  docker exec architecture-ollama ollama pull "$MODEL" || \
    error "Failed to pull $MODEL. Ensure internet is available for first-time setup."
fi

# ────────────────────────────────────────────────────────────────────────────
step "7 · Application Setup"
# ────────────────────────────────────────────────────────────────────────────

# Server dependencies
info "Installing server dependencies..."
cd "$SCRIPT_DIR/server"
npm ci --omit=dev

# Client build
info "Building client..."
cd "$SCRIPT_DIR/client"
npm ci
npm run build

# Env file
cd "$SCRIPT_DIR/server"
if [ ! -f ".env" ]; then
  warn "No .env found — creating defaults. EDIT JWT secrets before going live!"
  cat > .env << EOF
PORT=3001
NODE_ENV=production

DB_HOST=localhost
DB_PORT=5432
DB_NAME=architecture_db
DB_USER=arch_user
DB_PASSWORD=arch_pass_2024

JWT_SECRET=REPLACE_$(openssl rand -hex 32)
JWT_REFRESH_SECRET=REPLACE_$(openssl rand -hex 32)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

UPLOAD_DIR=src/uploads
MAX_FILE_SIZE=10485760

CLIENT_URL=http://localhost:3001

OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:e2b
EOF
else
  grep -q "OLLAMA_URL" .env || \
    printf "\nOLLAMA_URL=http://localhost:11434\nOLLAMA_MODEL=gemma4:e2b\n" >> .env
  info ".env exists — OLLAMA vars ensured."
fi

# Seed
info "Running database seed..."
node src/seed.js || warn "Seed skipped (tables may already exist)."
node src/seedNav.js || warn "Nav seed skipped."

# ────────────────────────────────────────────────────────────────────────────
step "8 · Systemd Service"
# ────────────────────────────────────────────────────────────────────────────
SERVICE=/etc/systemd/system/architecture.service
if [ ! -f "$SERVICE" ]; then
  cat > "$SERVICE" << EOF
[Unit]
Description=Architecture Management System
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=${SUDO_USER:-$USER}
WorkingDirectory=$SCRIPT_DIR/server
ExecStart=$(command -v node) src/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
# Cap Node.js heap — leave RAM for Ollama
Environment=NODE_OPTIONS=--max-old-space-size=1024
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable architecture
  info "Systemd service created."
fi
systemctl restart architecture
info "Application started."

# ────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Setup complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "  App    → http://$(hostname -I | awk '{print $1}'):3001"
echo -e "  Ollama → http://localhost:11434"
echo -e "  Model  → $MODEL"
echo -e "  RAM    → 8 GB | Swap → ${SWAP_SIZE_GB}GB at $SWAP_FILE"
echo -e "${YELLOW}  Login  → admin / Admin@1234${NC}"
echo -e "${RED}  ⚠ Change JWT_SECRET in server/.env before going live!${NC}"
echo ""
