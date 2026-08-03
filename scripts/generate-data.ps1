# =============================================================================
#  generate-data.ps1
#  Scanne les dossiers d'assets (personnages, armes, armures) et regenere
#  data.js, consomme par index.html.
#
#  A relancer chaque fois que tu ajoutes / retires des images :
#      Clic droit sur le fichier -> "Executer avec PowerShell"
#      ou dans un terminal :   powershell -ExecutionPolicy Bypass -File .\generate-data.ps1
#
#  Aucune dependance. Ne modifie aucune image. Ecrit uniquement data.js.
# =============================================================================

$ErrorActionPreference = 'Stop'
# Ce script vit dans scripts/ ; les dossiers d'images et data.js sont a la
# racine du depot, d'ou le second Split-Path.
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# --- Libelles d'affichage pour les types d'armes (nom de dossier -> libelle) ---
$typeLabels = [ordered]@{
    'Baguette'      = 'Baguette'
    'Baton'         = 'Baton'
    'Bouclier'      = 'Epee & bouclier'
    'Epee 1 main'   = 'Epee a une main'
    'Epee 2 mains'  = 'Epee a deux mains'
    'Epees doubles' = 'Epees doubles'
    'Gantelets'     = 'Gantelets'
    'Hache'         = 'Hache'
    'Lance'         = 'Lance'
    'Livre'         = 'Grimoire'
    'Nunchaku'      = 'Nunchaku'
    'Rapiere'       = 'Rapiere'
}

# --- Emplacements d'armure, dans l'ordre d'affichage voulu ---
$armorSlots = [ordered]@{
    'Haut'        = 'Haut'
    'Bas'         = 'Bas'
    'Bottes'      = 'Bottes'
    'Ceinture'    = 'Ceinture'
    'Armure liee' = 'Armure liee'
}

# --- Emplacements de bijoux, dans l'ordre d'affichage voulu ---
$jewelSlots = [ordered]@{
    'Anneau'           = 'Anneau'
    'Collier'          = 'Collier'
    "Boucle d'oreille" = "Boucle d'oreille"
}

function Get-Webp($dir) {
    if (-not (Test-Path $dir)) { return @() }
    Get-ChildItem -Path $dir -Filter *.webp -File | Sort-Object Name
}

# Transforme "gil-thunder" -> "Gil Thunder"
function Format-CharName($base) {
    ($base -split '-' | ForEach-Object {
        if ($_.Length -gt 0) { $_.Substring(0,1).ToUpper() + $_.Substring(1) } else { $_ }
    }) -join ' '
}

# --- Personnages ---
$personnages = @()
foreach ($f in Get-Webp (Join-Path $root '7ds-personnages')) {
    $base = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
    $personnages += [ordered]@{
        id   = $base
        name = Format-CharName $base
        file = "7ds-personnages/$($f.Name)"
    }
}

# --- Armes, groupees par type ---
$armes = [ordered]@{}
foreach ($folder in $typeLabels.Keys) {
    $items = @()
    foreach ($f in Get-Webp (Join-Path $root "7ds-armes/$folder")) {
        $items += [ordered]@{
            name = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
            file = "7ds-armes/$folder/$($f.Name)"
        }
    }
    if ($items.Count -gt 0) {
        $armes[$typeLabels[$folder]] = $items
    }
}

# --- Armures, groupees par emplacement ---
$armures = [ordered]@{}
foreach ($folder in $armorSlots.Keys) {
    $items = @()
    foreach ($f in Get-Webp (Join-Path $root "7ds-armures-ssr/$folder")) {
        $items += [ordered]@{
            name = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
            file = "7ds-armures-ssr/$folder/$($f.Name)"
        }
    }
    if ($items.Count -gt 0) {
        $armures[$armorSlots[$folder]] = $items
    }
}

# --- Bijoux, groupes par emplacement ---
$bijoux = [ordered]@{}
foreach ($folder in $jewelSlots.Keys) {
    $items = @()
    foreach ($f in Get-Webp (Join-Path $root "7ds-bijoux/$folder")) {
        $items += [ordered]@{
            name = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
            file = "7ds-bijoux/$folder/$($f.Name)"
        }
    }
    # On garde toujours la cle, meme vide, pour que les emplacements existent.
    $bijoux[$jewelSlots[$folder]] = $items
}

$data = [ordered]@{
    generatedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    personnages = $personnages
    armes       = $armes
    armures     = $armures
    bijoux      = $bijoux
}

$json = $data | ConvertTo-Json -Depth 6
$content = "// Genere automatiquement par generate-data.ps1 - NE PAS EDITER A LA MAIN.`r`n" +
           "// Relance le script pour mettre a jour apres ajout/retrait d'images.`r`n" +
           "window.SEVEN_DS_DATA = $json;`r`n"

$outPath = Join-Path $root 'data/data.js'
[System.IO.File]::WriteAllText($outPath, $content, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "OK -> data.js genere" -ForegroundColor Green
Write-Host ("  Personnages : {0}" -f $personnages.Count)
Write-Host ("  Types d'armes : {0}" -f $armes.Count)
Write-Host ("  Emplacements d'armure : {0}" -f $armures.Count)
$bijCount = ($bijoux.Values | ForEach-Object { $_.Count } | Measure-Object -Sum).Sum
Write-Host ("  Bijoux ({0} emplacements) : {1} pieces" -f $bijoux.Count, $bijCount)
