@echo off
echo "===== PUSHING ALL PROJECT FILES TO GITHUB ====="

echo "1. Setting git configuration..."
git config --global user.email "user@example.com"
git config --global user.name "User"

echo "2. Adding ALL files (including untracked files)..."
git add --all

echo "3. Committing all changes..."
git commit -m "Complete project with all files and improvements"

echo "4. Making sure we're on the master branch..."
git checkout master

echo "5. Pushing EVERYTHING to GitHub with force option..."
git push -u origin master --force

echo "6. Verifying what was pushed..."
git ls-tree -r master --name-only

echo "===== DONE! COMPLETE PROJECT HAS BEEN PUSHED TO GITHUB ====="
pause 