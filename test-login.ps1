$body = @{
    email = 'admin@fiona.test'
    password = 'password123'
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri 'http://localhost:8000/api/auth/login' -Method Post -Body $body -ContentType 'application/json'
$response | ConvertTo-Json -Depth 10
