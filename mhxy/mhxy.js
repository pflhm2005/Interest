const E = require('../sudo.js');

function go() {
  E.exec('handle -a -vt -p mh').then(stdout => {
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
          await E.exec(cmd);
        }
        E.close();
        console.log('处理完毕\n');
      })();
    } else {
      E.close();
      console.log('未找到对应进程，请确认游戏正常打开');
    }
  });
}

go();