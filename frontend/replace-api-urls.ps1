# PowerShell script to replace all hardcoded localhost:3007 with API_BASE_URL from config

$files = Get-ChildItem -Path app,components,hooks,lib -Recurse -Include *.ts,*.tsx | Where-Object { $_.FullName -notmatch '\.next' }

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw

    if ($content -match 'localhost:3007') {
        # Replace const API_BASE_URL declarations
        $content = $content -replace "const API_BASE_URL = 'http://localhost:3007';", "import { API_BASE_URL } from '@/lib/config';"

        # Replace hardcoded URLs with template literals
        $content = $content -replace "'http://localhost:3007'", '`${API_BASE_URL}`'
        $content = $content -replace '"http://localhost:3007"', '`${API_BASE_URL}`'

        # Save the file
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "Updated: $($file.Name)"
    }
}

Write-Host "`nDone! All files updated."
