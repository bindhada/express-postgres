
$base = "http://localhost:3000"
$passed = 0
$failed = 0

function Test-Request {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Path,
        [int]$Expected,
        $Body = $null
    )

    try {
        $params = @{
            Uri = "$base$Path"
            Method = $Method
            UseBasicParsing = $true
        }

        if ($null -ne $Body) {
            $params.ContentType = "application/json"
            $params.Body = $Body | ConvertTo-Json -Compress
        }

        $response = Invoke-WebRequest @params
        $actual = [int]$response.StatusCode
    }
    catch {
        if ($_.Exception.Response) {
            $actual = [int]$_.Exception.Response.StatusCode
        } else {
            Write-Host "ERROR: $Name - $($_.Exception.Message)" -ForegroundColor Red
            $script:failed++
            return
        }
    }

    if ($actual -eq $Expected) {
        Write-Host "PASS: $Name ($actual)" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "FAIL: $Name - expected $Expected, got $actual" -ForegroundColor Red
        $script:failed++
    }
}

# Exercise 1 and 2
Test-Request "Get all books" GET "/books" 200
Test-Request "Invalid book ID" GET "/books/abc" 400
Test-Request "Missing title" POST "/books" 400 @{}

# Exercise 3 and 4
Test-Request "Filter and sort books" GET "/books?genre=dystopian&sort=title" 200
Test-Request "Reject invalid sort" GET "/books?sort=password" 400

# Exercise 5: use book ID 1 if it exists
Test-Request "PATCH book genre" PATCH "/books/1" 200 @{
    genre = "classic"
}

# Exercise 6
Test-Request "Get authors" GET "/authors" 200
Test-Request "Get books by author" GET "/authors/1/books" 200

# Exercise 7
Test-Request "Get statistics" GET "/stats" 200

Write-Host "`nResults: $passed passed, $failed failed" -ForegroundColor Cyan