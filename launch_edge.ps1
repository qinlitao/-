# 启动Edge浏览器并打开LinkedIn
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$linkedinUrl = "https://www.linkedin.com"

Write-Host "正在启动Edge浏览器..."
Start-Process $edgePath -ArgumentList $linkedinUrl

Write-Host "Edge浏览器已启动，正在打开LinkedIn..."
Write-Host "请在浏览器中登录LinkedIn，登录完成后按Enter继续..."
Read-Host