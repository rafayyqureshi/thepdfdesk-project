@echo off
echo "===== PUSHING ABSOLUTELY EVERYTHING TO GITHUB (NO RESTRICTIONS) ====="

echo "1. Setting git configuration..."
git config --global user.email "user@example.com"
git config --global user.name "User"

echo "2. Committing .gitignore change first..."
git add .gitignore
git commit -m "Remove all restrictions from .gitignore"

echo "3. Adding EVERYTHING (including previously ignored files)..."
git add --all -f

echo "4. Committing all changes..."
git commit -m "Push absolutely everything - no restrictions"

echo "5. Making sure we're on the master branch..."
git checkout master

echo "6. Pushing EVERYTHING to GitHub with force option..."
git push -u origin master --force

echo "7. Verifying what was pushed..."
git ls-tree -r master --name-only | sort

echo "===== DONE! ABSOLUTELY EVERYTHING HAS BEEN PUSHED TO GITHUB ====="
pause 