@echo off
echo Checking what files are on the remote repository...
git ls-remote --heads origin
echo.
echo Checking commits in master branch...
git log --oneline -10 master

echo.
echo Last commit details:
git show --name-status HEAD

echo.
echo Current branch status:
git status

pause 