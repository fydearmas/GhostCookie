#define AppName "Asistente de Ghost Cookie"
#define AppPublisher "Franky Solutions"
#define HostFilename "ghostcookie-host.exe"
#define SetupFilename "ghostcookie-setup.exe"

[Setup]
AppId={{D56D243B-DCB7-4FF4-9BD6-4E923D368D97}
AppName={#AppName}
AppVersion={#ReleaseVersion}
AppPublisher={#AppPublisher}
AppPublisherURL=https://frankysolutions.com.br
DefaultDirName={localappdata}\Programs\GhostCookie\Assistant
DisableDirPage=yes
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\{#SetupFilename}
VersionInfoVersion={#ReleaseVersion}
VersionInfoDescription={#AppName}
VersionInfoCompany={#AppPublisher}
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile={#InstallerIcon}
OutputBaseFilename={#InstallerBasename}
#ifdef SignedRelease
SignTool=ghostcookieAuthenticode
SignedUninstaller=yes
#endif

[Languages]
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
Source: "{#PayloadDirectory}\{#HostFilename}"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#PayloadDirectory}\{#SetupFilename}"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#PayloadDirectory}\LICENSE.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#PayloadDirectory}\THIRD-PARTY-NOTICES.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#SetupFilename}"

[Run]
Filename: "{app}\{#SetupFilename}"; Description: "Abrir el asistente de Ghost Cookie"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{app}\{#HostFilename}"; Parameters: "unregister-published"; Flags: runhidden waituntilterminated; RunOnceId: "UnregisterPublishedBrowserHost"
