# Smart Assistance - Disaster Recovery REV2

## Scopo

Questa procedura consente di ripristinare Smart Assistance in caso di:

- rottura del PC;
- perdita dati;
- reinstallazione Windows/Docker;
- migrazione su un nuovo server.

## Script principali

Tutti gli script sono in:

```powershell
C:\SmartAssistance\scripts
```

Script REV2:

```text
sa-backup.ps1
sa-restore.ps1
sa-check.ps1
sa-install-backup-task.ps1
```

## Backup manuale completo

```powershell
powershell.exe -ExecutionPolicy Bypass -File "C:\SmartAssistance\scripts\sa-backup.ps1"
```

Output:

```text
C:\SmartAssistance\backup\smartassistance-full-YYYYMMDD-HHMMSS.zip
C:\SmartAssistance\backup\smartassistance-full-YYYYMMDD-HHMMSS.zip.sha256
```

## Cosa contiene il backup

- dump SQL PostgreSQL;
- file `.env` se presenti;
- docker-compose se presente;
- package.json frontend/backend;
- cartella `scripts`;
- cartella `docs`;
- cartella `storage` se presente;
- diagnostica Docker;
- branch/commit Git.

Nota: il backup può contenere dati clienti e segreti. Va conservato in modo sicuro.

## Backup automatico

```powershell
powershell.exe -ExecutionPolicy Bypass -File "C:\SmartAssistance\scripts\sa-install-backup-task.ps1"
```

Default:

- nome task: `SmartAssistance Full Backup REV2`
- orario: 03:15
- retention: 30 giorni

## Check sistema

```powershell
powershell.exe -ExecutionPolicy Bypass -File "C:\SmartAssistance\scripts\sa-check.ps1"
```

Controlla:

- container Docker;
- backend health;
- frontend locale;
- sito pubblico;
- database;
- statistiche API;
- backup recenti;
- task pianificato;
- stato Git.

## Restore database

```powershell
powershell.exe -ExecutionPolicy Bypass -File "C:\SmartAssistance\scripts\sa-restore.ps1" -BackupZip "C:\SmartAssistance\backup\NOME-BACKUP.zip"
```

Prima del restore viene creato un backup SQL di sicurezza, salvo usare `-SkipSafetyBackup`.

## Restore database + file progetto

Usare su nuovo PC o migrazione:

```powershell
powershell.exe -ExecutionPolicy Bypass -File "C:\SmartAssistance\scripts\sa-restore.ps1" -BackupZip "C:\SmartAssistance\backup\NOME-BACKUP.zip" -RestoreProjectFiles
```

## Restore database + file progetto + storage

```powershell
powershell.exe -ExecutionPolicy Bypass -File "C:\SmartAssistance\scripts\sa-restore.ps1" -BackupZip "C:\SmartAssistance\backup\NOME-BACKUP.zip" -RestoreProjectFiles -RestoreStorage
```

## Procedura nuovo PC

1. Installare Docker Desktop.
2. Installare Git.
3. Clonare il repository Smart Assistance.
4. Copiare l'ultimo ZIP di backup in `C:\SmartAssistance\backup`.
5. Avviare i container.
6. Eseguire restore.
7. Eseguire check.

## Comandi finali di verifica

```powershell
powershell.exe -ExecutionPolicy Bypass -File "C:\SmartAssistance\scripts\sa-check.ps1"
Invoke-RestMethod http://localhost:3006/health
Invoke-WebRequest http://localhost:3005 -UseBasicParsing
```
