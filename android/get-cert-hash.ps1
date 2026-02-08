# Simple PowerShell script to get certificate hash
$hostname = "emi-secure-system.onrender.com"
$port = 443

try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient($hostname, $port)
    $sslStream = New-Object System.Net.Security.SslStream($tcpClient.GetStream(), $false)
    $sslStream.AuthenticateAsClient($hostname)
    $cert = $sslStream.RemoteCertificate
    
    $publicKey = $cert.GetPublicKey()
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $hash = $sha256.ComputeHash($publicKey)
    $base64Hash = [Convert]::ToBase64String($hash)
    
    Write-Output "sha256/$base64Hash"
    
    $sslStream.Close()
    $tcpClient.Close()
} catch {
    Write-Error $_.Exception.Message
}
