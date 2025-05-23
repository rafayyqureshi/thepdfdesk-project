@echo off
echo ===== FINAL PUSH: EVERYTHING EXCEPT NODE_MODULES =====

echo 1. Setting git configuration...
git config --global user.email "user@example.com"
git config --global user.name "User"

echo 2. Making sure only node_modules is ignored...
echo node_modules/ > .gitignore
git add .gitignore
git commit -m "Update gitignore to only exclude node_modules"

echo 3. Adding multistorage-test.html to public directory...
git add public/multistorage-test.html
git commit -m "Add multistorage-test.html to public folder"

echo 4. Adding ALL other files (except node_modules)...
git add .
git commit -m "Add all remaining files except node_modules"

echo 5. Pushing to GitHub...
git push origin master

echo ===== PUSH COMPLETE =====
echo The entire project has been pushed to GitHub
echo EXCEPT node_modules directory
pause 