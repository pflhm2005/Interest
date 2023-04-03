const sudo = require('sudo-prompt');

async function closeHandle(cmd) {
  return new Promise((resolve, reject) => {sudo.exec(cmd, { name: 'admin' }, (err) => {
      if (err) reject(err);
      resolve();
    });
  });
}

function go() {
  return new Promise((resolve, reject) => {
    sudo.exec('handle -a -vt -p mhmain', { name: 'admin' }, function (err, stdout) {
      if (err) reject(err);
      const ar = stdout.split('\n').filter(v => v).reduce((acc, cur) => {
        if (cur.includes('BaseNamedObjects\\mhxy')) {
          const arr = cur.split(/\s+/);
          acc.push({
            process: arr[0],
            pid: arr[1],
            user: arr[2],
            handle: arr[3],
            type: arr[4],
            flags: arr[5],
          });
        }
        return acc;
      }, []);
      if (ar.length) {
        const pid = ar[0].pid;
        const cmds = ar.map(v => v.handle);
        (async () => {
          for(const cmd of cmds) {
            console.log('正在处理handle' + cmd + '...');
            await closeHandle(`handle -c ${cmd} -p ${pid} -y`);
          }
        })();
        resolve('处理完毕');
      }
      reject('未找到对应进程');
    });
  });
}

go();