#!/bin/bash
# ResSynth AI - Deploy to GitHub + Vercel
# Run this from the ressynth project directory on your MacBook
# Prerequisites: git, gh (GitHub CLI), vercel CLI
# Install if needed: brew install gh && npm i -g vercel

set -e

REPO_NAME="ressynth-ai"
VERCEL_PROJECT="resynth"

echo ""
echo "========================================="
echo "  ResSynth AI - Deployment"
echo "========================================="
echo ""

# ─── Step 1: Git Setup ───
echo "[1/5] Initializing git..."
if [ ! -d ".git" ]; then
  git init
  git branch -M main
fi

# Make sure .gitignore is in place
if [ ! -f ".gitignore" ]; then
  echo "node_modules\ndist\n*.local\n.env\n.DS_Store" > .gitignore
fi

git add -A
git commit -m "feat: multi-agent UX research synthesis platform

- 6 AI providers: Gemini, Kimi, Anthropic, Qwen, Groq, OpenRouter
- Supervisor-agent architecture for task distribution
- Knowledge base with consistent system prompts
- Token usage tracking per provider
- localStorage memory layer
- 750MB file upload limit with compression guidance
- Automatic fallback chain ordered by accuracy" 2>/dev/null || echo "  (already committed)"

# ─── Step 2: GitHub ───
echo "[2/5] Creating GitHub repository..."
if gh repo view "$REPO_NAME" &>/dev/null; then
  echo "  Repo $REPO_NAME already exists. Pushing..."
  git remote remove origin 2>/dev/null || true
  gh repo clone "$REPO_NAME" --confirm 2>/dev/null || true
  git remote add origin "$(gh repo view $REPO_NAME --json url -q .url).git" 2>/dev/null || true
else
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
fi

git push -u origin main --force
echo "  GitHub: https://github.com/$(gh api user -q .login)/$REPO_NAME"

# ─── Step 3: Install deps ───
echo "[3/5] Installing dependencies..."
npm install --silent

# ─── Step 4: Build ───
echo "[4/5] Building production bundle..."
npm run build

# ─── Step 5: Vercel Deploy ───
echo "[5/5] Deploying to Vercel..."

# Check if already linked to Vercel project
if [ -f ".vercel/project.json" ]; then
  echo "  Using existing Vercel project config..."
  vercel --prod --yes
else
  echo "  Linking to Vercel..."
  vercel link --yes --project "$VERCEL_PROJECT"
  vercel --prod --yes
fi

echo ""
echo "========================================="
echo "  Deployment Complete!"
echo "========================================="
echo ""
echo "  GitHub:  https://github.com/$(gh api user -q .login)/$REPO_NAME"
echo "  Vercel:  https://resynth-six.vercel.app"
echo ""
echo "  Next: Open the app, click Settings (gear icon),"
echo "  and add your API keys to start analyzing."
echo ""
