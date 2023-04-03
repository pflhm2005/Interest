const sudo = require('sudo-prompt');

async function closeHandle(cmd) {
  return new Promise((resolve, reject) => {sudo.exec(cmd, { name: 'long'}, (err) => {
      if (err) reject(err);
      resolve();
    });
  });
}

sudo.exec('handle -a -vt -p mhmain', { name: 'long' }, function (err, stdout) {
  if (err) console.log(err);
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
  const pid = ar[0].pid;
  const cmds = ar.map(v => v.handle);
  (async () => {
    for(const cmd of cmds) {
      console.log('正在处理handle' + cmd + '...');
      await closeHandle(`handle -c ${cmd} -p ${pid} -y`);
    }
  })();
  console.log('handle处理完毕');
});