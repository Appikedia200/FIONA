$body = @{
    email = 'admin@fiona.local'
    password = 'Admin123!'
    name = 'Admin'
    setupKey = 'your-super-secret-admin-key-2026'
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri 'http://localhost:8000/api/setup/create-admin' -Method Post -Body $body -ContentType 'application/json'
$response | ConvertTo-Json -Depth 10
