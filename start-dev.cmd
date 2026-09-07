@echo off
setlocal
cd /d "%~dp0"
call "%~dp0mvnw.cmd" spring-boot:run
