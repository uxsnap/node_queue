require('systemd');
require('autoquit');

const { v4: uuidv4 } = require('uuid');

const Queue = require('./src/queue.js');

const q = new Queue(uuidv4());

q.process(function(job, done) {
  done(job);
});

q.simpleAdd('node test.js');
q.simpleAdd('node test.js');


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


