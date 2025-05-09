@echo off
echo Running Git commands to force push changes...
git config --global user.email "rafayyqureshi@gmail.com"
git config --global user.name "Rafay Qureshi"

echo Cleaning up any merge conflicts...
git reset --hard HEAD
git add .
git commit -m "Fix client issues: storage display, filename format, remove buttons"

echo Force pushing to remote...
git push -f origin main

echo Done!
pause 