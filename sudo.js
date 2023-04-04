const path = require('path');
const fs = require('fs');
const child_process = require('child_process');
const tmpDir = require('os').tmpdir();

class Exec {
  constructor() {
    this.fileNames = ['cmd.bat', 'exec.bat', 'out', 'err', 'stat'];
    this.startCmd = null;
    this.init();
  }
  init() {
    this.setFilesPath();
    this.writeFile();
    this.startCmd = `powershell.exe Start-Process -FilePath "${this.execP}" -WindowStyle hidden -Verb runAs`;
  }
  setFilesPath() {
    const dirName = String(Date.now()) + Math.random().toString(16).substring(2, 6);
    this.dirPath = path.join(tmpDir, dirName);
    [this.cmdP, this.execP, this.outP, this.errP, this.statP] = this.fileNames.map(name => path.join(this.dirPath, name));
  }
  writeFile() {
    fs.mkdirSync(this.dirPath);

    const execCmds = [
      'call "' + this.cmdP + '" > "' + this.outP + '" 2> "' + this.errP + '"',
      '(echo %ERRORLEVEL%) > "' + this.statP + '"'
    ].join('\r\n');
    fs.writeFileSync(this.execP, execCmds);
  }
  checkStatus(cb) {
    fs.stat(this.statP, (err, stat) => {
      if ((err && err.code === 'ENOENT') || stat.size < 2) {
        setTimeout(() => this.checkStatus(cb), 1000);
      } else if (err) {
        throw new Error(err);
      } else {
        cb();
      }
    });
  }
  exec(command, once = false) {
    if (!this.startCmd) this.init();
    fs.writeFileSync(this.statP, '');
    return new Promise((resolve, reject) => {
      const cmd = ['@echo off', 'chcp 65001>nul', command].join('\r\n');
      fs.writeFileSync(this.cmdP, cmd);
      child_process.exec(this.startCmd, (err) => {
        this.checkStatus(() => {
          let code = fs.readFileSync(this.statP, 'utf-8');
          code = parseInt(code.trim(), 10);
          if (code === 0) {
            const result = fs.readFileSync(this.outP, 'utf-8');
            resolve(result);
          } else {
            const error = fs.readFileSync(this.errP, 'utf-8');
            reject(error);
          }
          if (once) {
            this.startCmd = null;
            this.close();
          }
        });
      });
    });
  }
  execOnce(command) {
    return this.exec(command, true);
  }
  close() {
    child_process.exec('rmdir /s /q "' + this.dirPath + '"');
  }
}

module.exports = new Exec();