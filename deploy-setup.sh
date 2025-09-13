#!/bin/bash

# QuickRead Deployment Setup Script

echo "🚀 Setting up QuickRead for deployment..."

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Please run this script from the QuickRead root directory"
    exit 1
fi

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "🔧 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit for deployment"
    echo "📝 Please push this repository to GitHub before deploying"
else
    echo "✅ Git repository detected"
fi

# Create .gitignore if it doesn't exist
if [ ! -f ".gitignore" ]; then
    echo "📝 Creating .gitignore..."
    cat > .gitignore << EOF
# Dependencies
node_modules/
backend/__pycache__/
backend/.env

# Build outputs
frontend/build/
frontend/dist/

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Temporary files
*.tmp
*.temp
EOF
fi

echo ""
echo "✅ Setup complete! Next steps:"
echo ""
echo "1. Push your code to GitHub:"
echo "   git add ."
echo "   git commit -m 'Prepare for deployment'"
echo "   git push origin main"
echo ""
echo "2. Deploy backend to Render:"
echo "   - Visit https://render.com"
echo "   - Create new Web Service"
echo "   - Connect your GitHub repo"
echo "   - Set root directory to 'backend'"
echo ""
echo "3. Deploy frontend to Vercel:"
echo "   - Visit https://vercel.com"
echo "   - Import your GitHub repo"
echo "   - Set root directory to 'frontend'"
echo ""
echo "4. Update environment variables with your deployment URLs"
echo ""
echo "📖 Read DEPLOYMENT.md for detailed instructions"