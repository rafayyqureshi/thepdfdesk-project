@echo off
echo Setting up git configuration...
git config --global user.email "user@example.com"
git config --global user.name "User"

echo Adding ALL files to git (including untracked files)...
git add --all

echo Committing changes...
git commit -m "Complete project with all fixes and improvements"

echo Creating and switching to master branch...
git checkout -b master

echo Pushing the ENTIRE project to GitHub...
git push -u origin master --force

echo Done! All files have been pushed to GitHub.
pause 