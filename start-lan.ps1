#
# start-lan.ps1 - Demarre l'app en mode demo LAN (telephone + serveur sur meme reseau).
#
# Auto-detecte l'IP LAN du serveur et configure :
#   - APP_FRONTEND_URL pour les emails d'invitation
#   - FRONT_ORIGIN_EXTRA pour le CORS du Gateway
#   - ng serve --host 0.0.0.0 pour que le frontend ecoute sur le LAN
#
# Usage :
#   .\start-lan.ps1
#
# Apres lancement, ouvre depuis ton telephone : http://<IP_AFFICHEE>:4200
# Le lien email d'invitation pointera automatiquement vers cette IP.
#

$ErrorActionPreference = "Stop"

# Detecte l'IP LAN active (Wi-Fi ou Ethernet, exclut loopback + APIPA + virtuelles)
function Get-LanIp {
    $candidates = Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $_.IPAddress -notmatch '^(127\.|169\.254\.|0\.0\.0\.0)' -and
            $_.PrefixOrigin -ne 'WellKnown' -and
            $_.SuffixOrigin -ne 'Link'
        } |
        Where-Object {
            # Exclut interfaces VMware/VirtualBox/Hyper-V (preferer Wi-Fi/Ethernet physique)
            $alias = (Get-NetAdapter -InterfaceIndex $_.InterfaceIndex -ErrorAction SilentlyContinue).Name
            $alias -and ($alias -notmatch 'VMware|VirtualBox|vEthernet|Loopback|Bluetooth')
        } |
        Sort-Object -Property InterfaceMetric

    if ($candidates) {
        return $candidates[0].IPAddress
    }
    throw "Aucune IP LAN trouvee. Verifie ta connexion Wi-Fi/Ethernet."
}

$lanIp = Get-LanIp
$frontendUrl = "http://${lanIp}:4200"
$gatewayUrl  = "http://${lanIp}:8084"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " ClubHub - Demo LAN" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  IP LAN detectee : $lanIp" -ForegroundColor Green
Write-Host "  Frontend URL    : $frontendUrl" -ForegroundColor Green
Write-Host "  Gateway URL     : $gatewayUrl" -ForegroundColor Green
Write-Host ""
Write-Host "  Sur ton telephone (meme Wi-Fi), ouvre : $frontendUrl" -ForegroundColor Yellow
Write-Host "  Les emails d'invitation pointeront vers : $frontendUrl" -ForegroundColor Yellow
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Configure les variables d'env globales pour cette session
$env:APP_FRONTEND_URL  = $frontendUrl
$env:FRONT_ORIGIN_EXTRA = $frontendUrl

Write-Host " Variables d'env configurees :" -ForegroundColor Cyan
Write-Host "   APP_FRONTEND_URL  = $env:APP_FRONTEND_URL"
Write-Host "   FRONT_ORIGIN_EXTRA = $env:FRONT_ORIGIN_EXTRA"
Write-Host ""

Write-Host " Etapes manuelles a faire dans 4 terminaux separes :" -ForegroundColor Cyan
Write-Host ""
Write-Host " [1] Frontend (ce shell ou un autre, depuis Frontend/) :" -ForegroundColor Yellow
Write-Host "     ng serve --host 0.0.0.0 --port 4200"
Write-Host ""
Write-Host " [2] Gateway (depuis Gateway/) :" -ForegroundColor Yellow
Write-Host "     `$env:FRONT_ORIGIN_EXTRA = '$frontendUrl'"
Write-Host "     .\mvnw.cmd spring-boot:run"
Write-Host ""
Write-Host " [3] club-service (depuis club-service/) :" -ForegroundColor Yellow
Write-Host "     `$env:APP_FRONTEND_URL = '$frontendUrl'"
Write-Host "     .\mvnw.cmd spring-boot:run"
Write-Host ""
Write-Host " [4] Autres services (user, treasury, voice, cstore, messaging) :" -ForegroundColor Yellow
Write-Host "     .\mvnw.cmd spring-boot:run dans chaque dossier"
Write-Host ""
Write-Host " Tip : pour relancer cette session avec les bonnes vars, source ce fichier :" -ForegroundColor DarkGray
Write-Host "       . .\start-lan.ps1" -ForegroundColor DarkGray
Write-Host ""
