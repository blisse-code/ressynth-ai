#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  ResSynth AI - Complete Setup + Deploy
#  Paste this entire script into your Mac Terminal app
# ═══════════════════════════════════════════════════════════════
set -e

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   ResSynth AI - Setup & Deploy               ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ─── Check prerequisites ───
echo "Checking tools..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install from https://nodejs.org"
    exit 1
fi
echo "✓ Node.js $(node --version)"

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found."
    exit 1
fi
echo "✓ npm $(npm --version)"

# Install GitHub CLI if missing
if ! command -v gh &> /dev/null; then
    echo ""
    echo "Installing GitHub CLI..."
    if command -v brew &> /dev/null; then
        brew install gh
    else
        echo "❌ brew not found. Install Homebrew first:"
        echo '   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
        echo "   Then run this script again."
        exit 1
    fi
fi
echo "✓ GitHub CLI $(gh --version | head -1)"

# Install Vercel CLI if missing
if ! command -v vercel &> /dev/null; then
    echo ""
    echo "Installing Vercel CLI..."
    npm install -g vercel
fi
echo "✓ Vercel CLI $(vercel --version 2>/dev/null | head -1)"

# ─── GitHub Login ───
echo ""
if ! gh auth status &> /dev/null; then
    echo "═══ Step 1: GitHub Login ═══"
    echo "A browser window will open. Log in to GitHub and authorize."
    echo ""
    gh auth login --web --git-protocol https
    echo ""
fi
echo "✓ GitHub authenticated"

# ─── Vercel Login ───
echo ""
if ! vercel whoami &> /dev/null; then
    echo "═══ Step 2: Vercel Login ═══"
    echo "A browser window will open. Log in to Vercel."
    echo ""
    vercel login
    echo ""
fi
echo "✓ Vercel authenticated"

# ─── Find and enter project directory ───
echo ""
echo "═══ Step 3: Project Setup ═══"

# Check if we're already in the ressynth directory
if [ -f "App.tsx" ] && [ -f "services/supervisor.ts" ]; then
    PROJECT_DIR="$(pwd)"
elif [ -d "ressynth" ] && [ -f "ressynth/App.tsx" ]; then
    PROJECT_DIR="$(pwd)/ressynth"
    cd "$PROJECT_DIR"
else
    echo ""
    echo "Where is the ressynth project folder?"
    echo "(Drag the 'ressynth' folder into this terminal window and press Enter)"
    echo ""
    read -p "Path: " PROJECT_DIR
    PROJECT_DIR="${PROJECT_DIR%/}"  # Remove trailing slash
    if [ ! -f "$PROJECT_DIR/App.tsx" ]; then
        echo "❌ Could not find App.tsx in that folder. Please check the path."
        exit 1
    fi
    cd "$PROJECT_DIR"
fi
echo "✓ Project directory: $PROJECT_DIR"

# ─── Install dependencies ───
echo ""
echo "═══ Step 4: Installing dependencies ═══"
npm install
echo "✓ Dependencies installed"

# ─── Build ───
echo ""
echo "═══ Step 5: Building ═══"
npm run build
echo "✓ Build successful"

# ─── GitHub Repo ───
echo ""
echo "═══ Step 6: Pushing to GitHub ═══"

if [ ! -d ".git" ]; then
    git init
    git branch -M main
fi

git add -A
git commit -m "feat: multi-agent UX research synthesis platform

- 6 AI providers: Gemini, Kimi, Anthropic, Qwen, Groq, OpenRouter
- Supervisor-agent architecture for task distribution  
- Knowledge base with consistent system prompts
- Token usage tracking per provider
- Automatic fallback chain ordered by accuracy
- 750MB file upload with compression guidance" 2>/dev/null || echo "  (already committed)"

GITHUB_USER=$(gh api user -q .login 2>/dev/null || echo "")
REPO_NAME="ressynth-ai"

if [ -z "$GITHUB_USER" ]; then
    echo "❌ Could not get GitHub username. Please run: gh auth login"
    exit 1
fi

# Check if repo exists
if gh repo view "$GITHUB_USER/$REPO_NAME" &> /dev/null; then
    echo "  Repo already exists. Updating..."
    git remote remove origin 2>/dev/null || true
    git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git"
else
    echo "  Creating new repo: $GITHUB_USER/$REPO_NAME"
    gh repo create "$REPO_NAME" --public --source=. --remote=origin
fi

git push -u origin main --force
echo ""
echo "✓ GitHub: https://github.com/$GITHUB_USER/$REPO_NAME"

# ─── Vercel Deploy ───
echo ""
echo "═══ Step 7: Deploying to Vercel ═══"

# Link to existing resynth project
mkdir -p .vercel
cat > .vercel/project.json << 'VERCEL_CONFIG'
{
  "projectId": "prj_DLtjel7X9Jiwp4HPLgE1uQQbV7TH",
  "orgId": "team_uDVjd8LQuVptAtuSKAU9lCdt",
  "settings": {
    "framework": "vite",
    "buildCommand": "npm run build",
    "outputDirectory": "dist"
  }
}
VERCEL_CONFIG

vercel --prod --yes
echo ""

# ─── Done ───
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                 DEPLOYMENT COMPLETE                       ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║                                                           ║"
echo "║  GitHub:  https://github.com/$GITHUB_USER/$REPO_NAME"
echo "║  Live:    https://resynth-six.vercel.app                  ║"
echo "║                                                           ║"
echo "║  Next steps:                                              ║"
echo "║  1. Open https://resynth-six.vercel.app                   ║"
echo "║  2. Click the gear icon (top right)                       ║"
echo "║  3. Add your Gemini + Kimi API keys                       ║"
echo "║  4. Upload a short test recording                         ║"
echo "║                                                           ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
