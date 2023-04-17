@echo off
chcp 65001
start cmd /k "node %cd%/mhxy.js && echo 按任意键结束 && pause && exit"