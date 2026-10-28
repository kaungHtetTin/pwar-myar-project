const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { normalizeConfig } = require('./printer-config.cjs');

function runSerial(operation, request = {}, { spawnProcess = spawn, scriptPath = path.join(__dirname, 'serial-print.ps1'), readScript = file => fs.readFileSync(file, 'utf8') } = {}) {
  return new Promise((resolve, reject) => {
    if (!['list', 'test', 'send'].includes(operation)) throw new Error('Invalid serial operation.');
    const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    // Only bundled, trusted code goes in the command. Device settings and receipt
    // bytes stay in stdin as JSON; no user string is interpolated into executable code.
    // This runs without changing the computer's PowerShell execution policy.
    const command = Buffer.from(`$ProgressPreference = 'SilentlyContinue'\n[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)\n& {\n${readScript(scriptPath)}\n} -Operation '${operation}'`, 'utf16le').toString('base64');
    const child = spawnProcess(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-OutputFormat', 'Text', '-EncodedCommand', command], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', error = '', settled = false;
    const finish = (problem, value) => { if (settled) return; settled = true; clearTimeout(timer); problem ? reject(problem) : resolve(value); };
    const timer = setTimeout(() => {
      child.kill();
      finish(new Error('Bluetooth operation timed out. Check pairing, the outgoing COM port, and printer output before retrying.'));
    }, (request.transfer?.timeoutMs || 15000) + 5000);
    child.stdout.on('data', (chunk) => { output += chunk; if (output.length > 100000) { child.kill(); finish(new Error('Unexpected serial helper output.')); } });
    child.stderr.on('data', (chunk) => { error = (error + chunk).slice(0, 2000); });
    child.on('error', (err) => finish(new Error(`Cannot start Windows Bluetooth serial helper: ${err.message}`)));
    child.on('close', (code) => {
      if (code !== 0) return finish(new Error(`Bluetooth serial operation failed: ${error.trim() || 'helper stopped'}. Check pairing and the outgoing COM port; check printer output before retrying.`));
      try { finish(null, JSON.parse(output)); } catch { finish(new Error('Invalid response from Bluetooth serial helper.')); }
    });
    child.stdin.on('error', (err) => finish(new Error(`Cannot pass data to Bluetooth helper: ${err.message}`)));
    child.stdin.end(JSON.stringify(request));
  });
}
function serialRequest(config, data) {
  const clean = normalizeConfig({ ...config, connection: 'bluetooth' });
  return { serial: clean.bluetooth, transfer: clean.thermal, ...(data ? { data: data.toString('base64') } : {}) };
}
module.exports = { runSerial, serialRequest };
