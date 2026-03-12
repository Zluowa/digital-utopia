#!/bin/bash
#
# Digital Utopia - One-Command Installer
# Usage: curl -sSL https://raw.githubusercontent.com/tishi-tech/digital-utopia/main/install.sh | bash
# Or: ./install.sh (from cloned repo)
#

set -e

# Colors
C='\033[0;36m'  # Cyan
G='\033[0;32m'  # Green
Y='\033[0;33m'  # Yellow
R='\033[0;31m'  # Red
B='\033[1;34m'  # Bold Blue
NC='\033[0m'    # No Color

echo -e "${B}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${B}║         Digital Utopia - AI Civilization Simulator        ║${NC}"
echo -e "${B}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ===========================================
# 1. Dependency Check
# ===========================================
echo -e "${C}[1/5] Checking dependencies...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${R}✗ Node.js not found${NC}"
    echo -e "  Please install Node.js >= 20.0.0"
    echo -e "  macOS: brew install node"
    echo -e "  Linux: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${R}✗ Node.js version too old: $(node -v)${NC}"
    echo -e "  Please upgrade to Node.js >= 20"
    exit 1
fi
echo -e "${G}✓${NC} Node.js $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${R}✗ npm not found${NC}"
    exit 1
fi
echo -e "${G}✓${NC} npm $(npm -v)"

# Check git
if ! command -v git &> /dev/null; then
    echo -e "${Y}⚠ git not found - some features may not work${NC}"
else
    echo -e "${G}✓${NC} git $(git --version | cut -d' ' -f3)"
fi

# ===========================================
# 2. Clone Repository (if not in repo)
# ===========================================
echo ""
echo -e "${C}[2/5] Setting up project...${NC}"

REPO_URL="https://github.com/tishi-tech/digital-utopia.git"
PROJECT_DIR="digital-utopia"

# Check if we're already in the project directory
if [ -f "package.json" ] && grep -q '"name": "digital-utopia"' package.json 2>/dev/null; then
    echo -e "${G}✓${NC} Already in Digital Utopia project directory"
    cd "$(pwd)"
else
    # Check if project directory exists
    if [ -d "$PROJECT_DIR" ]; then
        echo -e "${Y}⚠${NC} Directory '$PROJECT_DIR' already exists"
        read -p "  Use existing directory? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "  Aborting. Please remove or rename existing directory."
            exit 1
        fi
        cd "$PROJECT_DIR"
    else
        echo -e "  Cloning repository..."
        if ! command -v git &> /dev/null; then
            echo -e "${R}✗ git is required to clone the repository${NC}"
            echo -e "  Please install git or download the source code manually from:"
            echo -e "  ${B}$REPO_URL${NC}"
            exit 1
        fi
        git clone "$REPO_URL" "$PROJECT_DIR"
        cd "$PROJECT_DIR"
        echo -e "${G}✓${NC} Repository cloned"
    fi
fi

# ===========================================
# 3. Install Dependencies
# ===========================================
echo ""
echo -e "${C}[3/5] Installing dependencies (this may take a few minutes)...${NC}"

npm install

if [ $? -eq 0 ]; then
    echo -e "${G}✓${NC} Dependencies installed"
else
    echo -e "${R}✗ Failed to install dependencies${NC}"
    exit 1
fi

# ===========================================
# 4. Environment Setup
# ===========================================
echo ""
echo -e "${C}[4/5] Environment configuration...${NC}"

if [ -f ".env.local" ]; then
    echo -e "${G}✓${NC} .env.local found"
elif [ -f ".env.example" ]; then
    echo -e "${Y}⚠${NC} .env.example found but .env.local does not exist"
    echo -e "  Copying .env.example to .env.local..."
    cp .env.example .env.local
    echo -e "${G}✓${NC} Created .env.local"
    echo -e "${Y}  Please edit .env.local and add your API keys:${NC}"
    echo -e "    - ANTHROPIC_API_KEY: Your Anthropic API key for AI operations"
else
    echo -e "${Y}⚠${NC} No .env file found"
    echo -e "  Create a .env.local file with required environment variables"
fi

# ===========================================
# 5. Verify Installation
# ===========================================
echo ""
echo -e "${C}[5/5] Verifying installation...${NC}"

echo -e "  Running type check..."
if npm run build &> /dev/null; then
    echo -e "${G}✓${NC} TypeScript compilation successful"
else
    echo -e "${Y}⚠${NC} TypeScript compilation had warnings (this may be okay)"
fi

echo ""
echo -e "${B}════════════════════════════════════════════════════════════${NC}"
echo -e "${G}✓ Installation complete!${NC}"
echo -e "${B}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. ${B}Edit .env.local${NC} and add your API keys"
echo -e "  2. Run ${B}npm run dev${NC} to start the engine"
echo -e "  3. Open ${B}http://localhost:3000${NC} for the dashboard"
echo ""
echo -e "For help, see: ${B}https://github.com/tishi-tech/digital-utopia${NC}"
echo ""
