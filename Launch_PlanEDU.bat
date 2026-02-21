@echo off
TITLE PlanEDU Launcher
echo 🚀 Starting PlanEDU Backend Server...

:: Start the browser with the landing page
start index.html

:: Move to backend folder and start the API
cd planedu-backend
npm start

pause
