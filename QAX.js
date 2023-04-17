const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const dir = path.parse(process.cwd()).root;
cp.exec(`dir ${dir}EntBase.dat /s/b `, (err, filePaths) => {
  if (err) throw new Error(err);
  const filePath = filePaths.split('\r\n').filter(p => p.includes('QAX'))[0];
  const content = fs.readFileSync(filePath, {encoding:'utf8'});

  let ar = content.split('\r\n');
  let str = ar.map(v => {
    if (v.startsWith('uipass=')) {
      return 'uipass=';
    }
    if (v.startsWith('qtpass=')) {
      return 'qtpass=';
    }
    return v;
  }).join('\r\n');

  fs.writeFileSync(filePath, str);
});
