@echo off
echo Running Git commands to push changes...
git config --global user.email "rafayyqureshi@gmail.com"
git config --global user.name "Rafay Qureshi"
git add .
git commit -m "Fix client issues: storage display, filename format, remove buttons"
git push origin main
echo Done!
pause 