@echo off
setlocal
set "SRC=%~dp0moi"
set "DST=%~dp0..\frontend"
copy /y "%SRC%\public\logo-co-lien-hiep.png" "%DST%\public\logo-co-lien-hiep.png" >nul || goto loi
copy /y "%SRC%\public\logo-ngang-co-lien-hiep.png" "%DST%\public\logo-ngang-co-lien-hiep.png" >nul || goto loi
copy /y "%SRC%\public\logo-ngang.png" "%DST%\public\logo-ngang.png" >nul || goto loi
copy /y "%SRC%\public\logo.png" "%DST%\public\logo.png" >nul || goto loi
copy /y "%SRC%\src\app\_home\HomeV7.tsx" "%DST%\src\app\_home\HomeV7.tsx" >nul || goto loi
copy /y "%SRC%\src\app\_home\v7.css" "%DST%\src\app\_home\v7.css" >nul || goto loi
copy /y "%SRC%\src\app\admin\admin.css" "%DST%\src\app\admin\admin.css" >nul || goto loi
copy /y "%SRC%\src\app\admin\page.tsx" "%DST%\src\app\admin\page.tsx" >nul || goto loi
copy /y "%SRC%\src\app\layout.tsx" "%DST%\src\app\layout.tsx" >nul || goto loi
copy /y "%SRC%\src\app\theme-gradient.css" "%DST%\src\app\theme-gradient.css" >nul || goto loi
copy /y "%SRC%\src\components\admin\AuditLogView.tsx" "%DST%\src\components\admin\AuditLogView.tsx" >nul || goto loi
copy /y "%SRC%\src\components\admin\ImageSetting.tsx" "%DST%\src\components\admin\ImageSetting.tsx" >nul || goto loi
copy /y "%SRC%\src\components\admin\useCardTables.ts" "%DST%\src\components\admin\useCardTables.ts" >nul || goto loi
copy /y "%SRC%\src\components\site\SiteNav.tsx" "%DST%\src\components\site\SiteNav.tsx" >nul || goto loi
copy /y "%SRC%\src\components\site\site-nav.css" "%DST%\src\components\site\site-nav.css" >nul || goto loi
copy /y "%SRC%\src\lib\siteHeader.ts" "%DST%\src\lib\siteHeader.ts" >nul || goto loi
echo Da chuyen sang giao dien moi - mau do.
echo Mo trang web va bam Ctrl+F5.
pause
exit /b 0
:loi
echo LOI: khong chep duoc file.
pause
exit /b 1
