@echo off
echo ===== KeyVaultManager Port Conflict Fix =====

echo.
echo Step 1: Checking for processes using port 3000...
netstat -ano | findstr :3000

echo.
echo Step 2: Identifying the PID of the process using port 3000...
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') DO SET PID=%%P

echo.
if defined PID (
  echo Process found with PID: %PID%
  echo Terminating process...
  taskkill /F /PID %PID%
  echo Process terminated.
) else (
  echo No processes found using port 3000.
)

echo.
echo Step 3: Alternative - Set a different port in .env file...
echo Updating PORT in .env file to 3001...
powershell -Command "(Get-Content .env) -replace 'PORT=3000', 'PORT=3001' | Set-Content .env"

echo.
echo ===== Port fix complete! =====
echo You can now try running the server with: npm start
pause 