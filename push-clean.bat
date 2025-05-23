@echo off
echo "===== PUSHING PROJECT TO GITHUB (WITHOUT NODE_MODULES) ====="

echo "1. Setting git configuration..."
git config --global user.email "mrafayyqureshi@gmail.com"
git config --global user.name "Rafay"

echo "2. Updating .gitignore to exclude only node_modules..."
git add .gitignore
git commit -m "Update .gitignore to exclude only node_modules directory"

echo "3. Adding the multistorage-test.html file in public directory..."
git add public/multistorage-test.html
git commit -m "Add multistorage-test.html to public directory for proper serving"

echo "4. Adding all other files (except node_modules due to .gitignore)..."
git add --all
git commit -m "Add all files except node_modules"

echo "5. Making sure we're on the master branch..."
git checkout master

echo "6. Pushing everything (except node_modules) to GitHub..."
git push -u origin master

echo "===== DONE! PROJECT PUSHED TO GITHUB (WITHOUT NODE_MODULES) ====="
pause 