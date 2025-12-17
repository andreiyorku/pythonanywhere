
@echo off
echo Running Server on '10.0.0.19','10.0.0.21'
call C:\venvs\pythonanywhere_env\Scripts\activate
python manage.py runserver 0.0.0.0:8000
pause
