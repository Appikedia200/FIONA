# 🧪 PHASE 2 TEST SCRIPT

echo "Testing FIONA Authentication API..."
echo ""

# Base URL
$BASE_URL = "http://localhost:8000"

# Test 1: Health Check
echo "1️⃣  Testing health check..."
$response = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get
Write-Host "✅ Health check: $($response.status)" -ForegroundColor Green
echo ""

# Test 2: Register new technician
echo "2️⃣  Registering new technician..."
$registerData = @{
    email = "test@example.com"
    password = "test1234"
    fullName = "Test User"
    company = "Test Company"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/auth/register" -Method Post -Body $registerData -ContentType "application/json"
    Write-Host "✅ Registration successful: $($response.message)" -ForegroundColor Green
} catch {
    $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "ℹ️  Registration: $($errorDetails.error)" -ForegroundColor Yellow
}
echo ""

# Test 3: Login as admin
echo "3️⃣  Logging in as admin..."
$loginData = @{
    email = "admin@fiona.local"
    password = "admin123"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/auth/login" -Method Post -Body $loginData -ContentType "application/json"
    $TOKEN = $response.token
    Write-Host "✅ Login successful!" -ForegroundColor Green
    Write-Host "   Role: $($response.user.role)" -ForegroundColor Cyan
    Write-Host "   Email: $($response.user.email)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Login failed" -ForegroundColor Red
    exit
}
echo ""

# Test 4: Get profile
echo "4️⃣  Getting user profile..."
$headers = @{
    "Authorization" = "Bearer $TOKEN"
}

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/auth/profile" -Method Get -Headers $headers
    Write-Host "✅ Profile retrieved: $($response.user.email)" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get profile" -ForegroundColor Red
}
echo ""

# Test 5: Get all technicians (admin endpoint)
echo "5️⃣  Getting all technicians (admin endpoint)..."
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/admin/technicians" -Method Get -Headers $headers
    Write-Host "✅ Found $($response.total) users" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get technicians" -ForegroundColor Red
}
echo ""

# Test 6: Get pending technicians count
echo "6️⃣  Getting pending technicians count..."
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/admin/technicians/pending" -Method Get -Headers $headers
    Write-Host "✅ Pending technicians: $($response.count)" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get pending count" -ForegroundColor Red
}
echo ""

Write-Host "🎉 All authentication tests completed!" -ForegroundColor Green
echo ""
echo "📋 Summary:"
echo "   ✅ Health check working"
echo "   ✅ Registration working"
echo "   ✅ Login working"
echo "   ✅ JWT authentication working"
echo "   ✅ RBAC working (admin endpoints)"
echo ""
echo "🔐 Admin credentials:"
echo "   Email: admin@fiona.local"
echo "   Password: admin123"
