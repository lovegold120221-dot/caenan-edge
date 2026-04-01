#!/bin/bash
# Post-install script for Caenan Local Edge .deb package
# Runs as root after dpkg installation.
set -e

echo "[caenan] Running post-install setup..."

# ── Docker ────────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "[caenan] Installing Docker..."
  apt-get update -qq
  apt-get install -y docker.io docker-compose-v2
  systemctl enable docker
  systemctl start docker
else
  echo "[caenan] Docker already installed."
fi

# Add the installing user to the docker group
REAL_USER="$SUDO_USER"
if [ -z "$REAL_USER" ]; then REAL_USER="$USER"; fi
if [ -n "$REAL_USER" ] && [ "$REAL_USER" != "root" ]; then
  usermod -aG docker "$REAL_USER" 2>/dev/null || true
fi

# ── Supabase CLI ──────────────────────────────────────────────────────────────
if ! command -v supabase &>/dev/null; then
  echo "[caenan] Installing Supabase CLI..."
  ARCH=$(uname -m)
  if [ "$ARCH" = "x86_64" ]; then ARCH="amd64"; else ARCH="arm64"; fi
  LATEST=$(curl -fsSL https://api.github.com/repos/supabase/cli/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
  curl -fsSL "https://github.com/supabase/cli/releases/download/$LATEST/supabase_linux_$ARCH.tar.gz" \
    | tar -xz -C /usr/local/bin supabase
  chmod +x /usr/local/bin/supabase
else
  echo "[caenan] Supabase CLI already installed."
fi

# ── Ollama ────────────────────────────────────────────────────────────────────
if ! command -v ollama &>/dev/null; then
  echo "[caenan] Installing Ollama..."
  curl -fsSL https://ollama.com/install.sh | sh
else
  echo "[caenan] Ollama already installed."
fi

systemctl enable ollama 2>/dev/null || true
systemctl start  ollama 2>/dev/null || true

echo "[caenan] Post-install complete."
echo "[caenan] NOTE: Log out and back in for Docker group changes to take effect."
