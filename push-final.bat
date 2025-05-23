@echo off
echo "===== PUSHING ABSOLUTELY EVERYTHING TO GITHUB (FINAL ATTEMPT) ====="

echo "1. Setting git configuration..."
git config --global user.email "user@example.com"
git config --global user.name "User"
git config --global core.longpaths true

echo "2. Forcing add of all node_modules and other untracked files..."
git add .env -f
git add combined.log -f
git add error.log -f
git add node_modules -f

echo "3. Committing these changes..."
git commit -m "Add all node_modules and untracked files"

echo "4. Forcing push to GitHub..."
git push -u origin master --force

echo "===== DONE! ABSOLUTELY EVERYTHING (INCLUDING NODE_MODULES) HAS BEEN PUSHED TO GITHUB ====="
pause 