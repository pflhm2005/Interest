const sudo = require('sudo-prompt');

async function closeHandle(cmd) {
  return new Promise((resolve, reject) => {sudo.exec(cmd,{ name: 'admin'}, (err) => {
      if (err) reject(err);
      resolve();
    });
  });
}

function go() {
  return new Promise((resolve, reject) => {
    sudo.exec('handle -a -vt -p mh', { name: 'admin'}, function (err, stdout) {
      if (err) reject(err);
      const ar = stdout.split('\n').filter(v => v).reduce((acc, cur) => {
        if (cur.includes('BaseNamedObjects\\mhxy') || cur.includes('BaseNamedObjects\\MHXY')) {
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
        const cmds = ar.map(v => `handle -c ${v.handle} -p ${v.pid} -y`);
        (async () => {
          for(const cmd of cmds) {
            console.log('正在处理: ' + cmd + '...');
            await closeHandle(cmd);
          }
          console.log('处理完毕\n');
        })();
        resolve('处理完毕');
      }
      reject('未找到对应进程，请确认游戏正常打开');
    });
  }).catch(e => {
    console.log(e);
  });
}

go();