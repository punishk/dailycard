@echo off
REM ============================================================
REM  데일리 카드 - 뉴스/상식 자동 수집
REM  Windows 작업 스케줄러에 이 파일을 등록해 두면
REM  매일 정해진 시각에 새 카드를 받아옵니다.
REM  자세한 등록 방법은 README.md 를 보세요.
REM ============================================================

cd /d "%~dp0"

echo. >> fetch.log
echo ==== %DATE% %TIME% ==== >> fetch.log

call npm run fetch >> fetch.log 2>&1

if %ERRORLEVEL% NEQ 0 (
  echo [실패] 수집 중 오류가 발생했습니다. fetch.log 를 확인하세요. >> fetch.log
  exit /b %ERRORLEVEL%
)

echo [성공] 수집 완료 >> fetch.log
exit /b 0
