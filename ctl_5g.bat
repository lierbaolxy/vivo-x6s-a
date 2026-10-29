@echo off
chcp 936 >nul
rem ============================================================
rem  �ֻ�ң�ؿ���̨ �� �� 2 ̨��5G �ֻ� / 172.20.33.75��
rem  �� X6s A ��ȫ�����������˿� 8001��������־�������Զ�ѭ��
rem
rem  ctl_5g.bat start                  ��� 3~10 ���Զ��ϻ�
rem  ctl_5g.bat start 10               �̶� 10 ��
rem  ctl_5g.bat start 10 172.20.33.75 �̶� 10 �� + �� ping �ֻ�
rem  ctl_5g.bat stop                   ֹͣ���������
rem  ctl_5g.bat status                 ״̬ / PC ��ַ / �ֻ���� IP / ��� 6 ���ر�
rem
rem  ע�⣺X6s A �� ctl.bat���˿� 8000���������� 8001���������š�
rem ============================================================
setlocal enabledelayedexpansion

rem ---------- ·�����Զ�ȡ���ű�����Ŀ¼ ----------
set "DIR=%~dp0"
set "SERVER=%DIR%phone_ctl_server.py"
set "PORT=8001"
set "PCS_ACK_LOG=phone_ack_5g.log"
set "DEFPHONE=172.20.33.75"

if /i "%~1"=="start"  goto start
if /i "%~1"=="stop"   goto stop
if /i "%~1"=="status" goto status

echo �÷�: ctl_5g.bat [start [�����] [�ֻ�IP] ^| stop ^| status]
exit /b 1

rem ==================== start ====================
:start
call :parseargs %~2 %~3

call :portup
if "%UP%"=="1" (
    echo [server-5g] �������У�������������ִ�� ctl_5g.bat stop
    exit /b 0
)

echo [server-5g] ������... ���=%MODE%
start "PhoneSwipeServer5G" /min cmd /c python "%SERVER%" %PORT% %MODE%

for /l %%i in (1,1,6) do (
    ping -n 2 127.0.0.1 >nul
    call :portup
    if "!UP!"=="1" goto srvok
)
echo [server-5g] ����ʧ�ܣ��˿� %PORT% δ����
echo          �ֶ��Ų�: python "%SERVER%" %PORT% %MODE%
exit /b 1

:srvok
echo [server-5g] ���������˿� %PORT%
if /i "%MODE%"=="rand" (
    echo [auto]      �ѿ����������� 3~10 ��
) else (
    echo [auto]      �ѿ������̶���� %MODE% ��
)

if not "%PHONEIP%"=="" (
    echo [phone]     ��� %PHONEIP% ...
    ping -n 1 -w 1200 %PHONEIP% >nul 2>&1
    if errorlevel 1 (
        echo [phone]     ���ɴ���ܲ���ͬһ���磬���ֻ�δ�� Wi-Fi
    ) else (
        echo [phone]     ����
    )
)

echo.
curl.exe -s "http://127.0.0.1:%PORT%/info"
echo.
echo ״̬: ctl_5g.bat status    ֹͣ: ctl_5g.bat stop
exit /b 0

rem ==================== stop ====================
:stop
set "FOUND=0"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%p >nul 2>&1
    echo [server-5g] ��ֹͣ PID=%%p
    set "FOUND=1"
)
if "!FOUND!"=="0" echo [server-5g] δ������
call :portup
if "!UP!"=="0" echo [server-5g] �˿� %PORT% ���ͷ�
exit /b 0

rem ==================== status ====================
:status
call :portup
if "!UP!"=="1" (echo [server-5g] �����У��˿� %PORT%) else (echo [server-5g] δ����)
if "!UP!"=="1" (
    curl.exe -s "http://127.0.0.1:%PORT%/info"
    echo ---- �Զ��ϻ�״̬ ----
    curl.exe -s "http://127.0.0.1:%PORT%/auto/status"
    echo.
    echo ---- ��� 6 ���ֻ��ر� ----
    curl.exe -s "http://127.0.0.1:%PORT%/tail?n=6"
)
exit /b 0

rem ==================== �ӹ��� ====================
:parseargs
set "MODE=%~1"
set "PHONEIP=%~2"
if "%MODE%"=="" set "MODE=rand"
if "%MODE%"=="" goto phdef
echo %MODE%|findstr /r "\." >nul
if errorlevel 1 goto phdef
set "PHONEIP=%MODE%"
set "MODE=rand"
:phdef
if "%PHONEIP%"=="" set "PHONEIP=%DEFPHONE%"
exit /b 0

:portup
set "UP=0"
for /f "tokens=*" %%l in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do set "UP=1"
exit /b 0
