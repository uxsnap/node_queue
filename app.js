require('systemd');
require('autoquit');

const Queue = require('./src/queue.js');

const q = new Queue();

// const q2 = new Queue();

q.process((job, done) => {
  done(job);
});

// q2.process((job, done) => {
//   done(job);
// });

q.on('completed', () => {
  console.log('YESSSSSS!');
});

q.on('error', () => {
  console.log('meeeh');
});


// q.simpleAdd('node test.js');
q.simpleAdd({ task: 'node test2.js q-1', priority: 4 });
// q2.simpleAdd({ task: 'node test2.js q2-1', priority: 1 });
q.pause()
q.simpleAdd({ task: 'node test2.js q-2', priority: 2 });
q.resume();
// q2.simpleAdd({ task: 'node test2.js q2-2', priority: 3, delay: 3000})

// module.exports.Queue = Queue;

// const Journald = require('systemd-journald');
// const http = require('http');

// const log = new Journald({syslog_identifier: 'my-logger'});
// const server = http.createServer((req, res) => {
//   res.writeHead(200, {'Content-type': 'text/plain'});
//   res.end('Hello world!\n');

//   log.info('first_log', {
//     action: 'sayHello',
//     userId: 'me'
//   })
// });

// server.autoQuit({ timeout: 1800 });
// server.listen(process.env.NODE_ENV === 'production' ? 'systemd' : 3000, () => console.log('Service is working.'));


