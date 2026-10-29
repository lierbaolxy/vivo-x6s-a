# List open Explorer windows and their folder, to find the one browsing the phone
$shell = New-Object -ComObject Shell.Application
$wins = @($shell.Windows())
Write-Output ('WIN_COUNT: ' + $wins.Count)
foreach ($w in $wins) {
    try {
        $loc = ''
        try { $loc = $w.LocationURL } catch {}
        $name = ''
        try { $name = $w.Document.Folder.Title } catch {}
        $cnt = -1
        try { $cnt = @($w.Document.Folder.Items()).Count } catch {}
        Write-Output ('WIN: Name=[' + $name + '] URL=[' + $loc + '] Items=' + $cnt + ' HWND=' + $w.HWND)
    } catch {
        Write-Output ('WIN_ERR: ' + $_.Exception.Message)
    }
}
