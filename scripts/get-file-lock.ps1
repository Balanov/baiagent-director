param([Parameter(Mandatory=$true)][string]$Path)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class RestartManager {
  [StructLayout(LayoutKind.Sequential)] public struct RM_UNIQUE_PROCESS { public int dwProcessId; public System.Runtime.InteropServices.ComTypes.FILETIME ProcessStartTime; }
  public enum RM_APP_TYPE { RmUnknownApp=0, RmMainWindow=1, RmOtherWindow=2, RmService=3, RmExplorer=4, RmConsole=5, RmCritical=1000 }
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct RM_PROCESS_INFO {
    public RM_UNIQUE_PROCESS Process;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=256)] public string strAppName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=64)] public string strServiceShortName;
    public RM_APP_TYPE ApplicationType; public uint AppStatus; public uint TSSessionId;
    [MarshalAs(UnmanagedType.Bool)] public bool bRestartable;
  }
  [DllImport("rstrtmgr.dll", CharSet=CharSet.Unicode)] public static extern int RmStartSession(out uint handle, int flags, string key);
  [DllImport("rstrtmgr.dll", CharSet=CharSet.Unicode)] public static extern int RmRegisterResources(uint handle, uint files, string[] names, uint apps, RM_UNIQUE_PROCESS[] processes, uint services, string[] serviceNames);
  [DllImport("rstrtmgr.dll")] public static extern int RmGetList(uint handle, out uint needed, ref uint count, [In, Out] RM_PROCESS_INFO[] info, ref uint rebootReasons);
  [DllImport("rstrtmgr.dll")] public static extern int RmEndSession(uint handle);
}
'@
$resolved = (Resolve-Path -LiteralPath $Path).Path
$handle = 0
$key = [Guid]::NewGuid().ToString('N')
$result = [RestartManager]::RmStartSession([ref]$handle, 0, $key)
if ($result -ne 0) { throw "RmStartSession: $result" }
try {
  $result = [RestartManager]::RmRegisterResources($handle, 1, @($resolved), 0, $null, 0, $null)
  if ($result -ne 0) { throw "RmRegisterResources: $result" }
  $needed = 0; $count = 0; $reasons = 0
  $result = [RestartManager]::RmGetList($handle, [ref]$needed, [ref]$count, $null, [ref]$reasons)
  if ($result -eq 0) { Write-Output '[]'; exit 0 }
  if ($result -ne 234) { throw "RmGetList(size): $result" }
  $info = New-Object 'RestartManager+RM_PROCESS_INFO[]' $needed
  $count = $needed
  $result = [RestartManager]::RmGetList($handle, [ref]$needed, [ref]$count, $info, [ref]$reasons)
  if ($result -ne 0) { throw "RmGetList: $result" }
  $info | Select-Object @{Name='ProcessId';Expression={$_.Process.dwProcessId}},strAppName,strServiceShortName,ApplicationType,bRestartable | ConvertTo-Json -Depth 3
} finally { [void][RestartManager]::RmEndSession($handle) }
