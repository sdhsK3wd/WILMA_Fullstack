@echo off
cd /d C:\Users\user\Desktop\WILMA_Fullstack\WaterflowForecast
echo Aktivieren der virtuellen Umgebung...
call venv\Scripts\activate

echo Server wird gestartet...
python -m uvicorn main:app --reload

pause
