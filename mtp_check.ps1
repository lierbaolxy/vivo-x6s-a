$shell = New-Object -ComObject Shell.Application
foreach ($w in @($shell.Windows())) {
    try {
        $t = $w.Document.Folder.Title
        if ($t -like '*存储*' -or $t -eq '5G' -or $t -like '*storage*') {
            Write-Output ('=== WINDOW [' + $t + ']')
            foreach ($i in @($w.Document.Folder.Items())) {
                if ($i.Name -like '*.apk' -or $i.Name -like '*.js' -or $i.Name -like '*autojs*' -or $i.Name -like '*Auto*') {
                    Write-Output ('   [' + $i.Name + ']  size=' + $i.Size + ' bytes')
                }
            }
        }
    } catch {}
}