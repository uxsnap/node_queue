/*
 The Queue keeps 6 data structures:
    - wait (list)
    - active (list)
    - delayed (zset)
    - priority (zset)
    - completed (zset)
    - failed (zset)
 * */

const util = require('util');
const exec = util.promisify(require('child_process').exec);
const redis = require('redis');
const { globalListener } = require('./globalListener');
const Job = require('./job');
const uuid = require('uuid');
const { createRedisUri } = require('./utils');

module.exports = class Queue {
  constructor(name, queueServer = null) {
    this.isExecuting = false;

    this.jobCount = 0;

    this.name = name;
    this.client = null;
    this.queueServer = queueServer
      ? createRedisUri(queueServer)
      : process.env.REDIS_SERVER;
    
  }

  // add(job) {
  //   const innerJob = new Job(job);
  //   if (innerJob.checkJobParams())
  //     // this.queue.push(innerJob);
  // }

  // Adding job to queue that immediatelly invokes
  async simpleAdd(job) {
    if (!this.client)
      return;
    

    if (this.isExecuting) {
      this.client.rpush(this.name, job);
      return;
    }
    
    this.isExecuting = true;
    const { stdout, stderr } = await exec(job);
    this.isExecuting = false;
    globalListener.emit('process_event', {
      job,
      output: stdout,
      error: stderr,
      index: ++this.jobCount
    });
  }

  handleError(type, message) {
    console.error(`${type}: ${message}`);
  }

  process(callback) {
    // if (this.hasOwnProperty('queue')) return;

    // Object.defineProperty(this, 'queue', {
    //   get() {
    //     return this.queue
    //   }
    // });

    return new Promise((res, rej) => {
      this.client = redis.createClient(process.env.REDIS_SERVER);

      function done(jobName, action = '') {
        if (typeof action === 'function')
          action()
        else console.log(action.length ? action : `Job ${jobName} is done.`);
      }

      // Callback must have job and done func

      this.client.on("error", (error) => {
        this.handleError('Redis', 'Cannot connect to redis');
        rej(error);
      });

      globalListener.on('process_event', ({job, output, error, index}) => {
        if (this.client.llen(this.name)) {
          this.client.lpop(this.name, (err, reply) => {
            if (err)
              this.handleError('Lpop', 'Cannot obtain element from list');
            return reply && this.simpleAdd(reply);
          });
        }
        callback(job, () => {
          console.log(`Job is №${index} done`);  
        });
      });
    });
  }
}