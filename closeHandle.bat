@echo off
chcp 65001
start cmd /k "cd %NVM_SYMLINK% && node ./mhxy.js && echo 按任意键结束 && pause && exit"