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
const { v4 : uuidv4 } = require('uuid');
const { createRedisUri } = require('./utils');

module.exports = class Queue {
  constructor(queueServer = null) {
    this.isExecuting = false;

    this.jobCount = 0;

    this.name = uuidv4();
    this.client = null;
    this.queueServer = queueServer
      ? createRedisUri(queueServer)
      : process.env.REDIS_SERVER;
    
  }

  obtainTask(job) {
    const returnRes = {
      'string': { task: job, priority: 1 },
      'object': { task: job.task, priority: job.priority }
    };
    return returnRes[job.length ? 'string' : 'object'];
  }


  // add(job) {
  //   const innerJob = new Job(job);
  //   if (innerJob.checkJobParams())
  //     // this.queue.push(innerJob);
  // }

  /*
    Job : { taks: string, priority: number }
  */

  // Adding job to queue that immediatelly invokes
  async simpleAdd(job) {
    if (!this.client)
      return;
    
    const { task, priority } = this.obtainTask(job);

    if (this.isExecuting) {
      this.client.zadd(this.name, priority, task);
      return;
    }
    
    this.isExecuting = true;
    const { stdout, stderr } = await exec(task);
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
    if (this.client) return;
    // if (this.hasOwnProperty('queue')) return;

    // Object.defineProperty(this, 'queue', {
    //   get() {
    //     return this.queue
    //   }
    // });

    return new Promise((res, rej) => {
      this.client = redis.createClient(process.env.REDIS_SERVER);
      // Callback must have job and done func

      this.client.on("error", (error) => {
        this.handleError('Redis', 'Cannot connect to redis');
        rej(error);
      });

      globalListener.on('process_event', ({job, output, error, index}) => {
        callback(job, () => {
          console.log(`Job №${index} is done with output: ${output}`);  
        });
        this.client.zrange(this.name, 0, -1, (err, result) => {
          if (err) 
            return this.handleError('ZRANGE', 'Error occured when obtaining set');
          if (!result.length) return;
          // this.client.zpopmax(this.name, (err, reply) => {
            // console.log(err, reply)
            // if (err)
              // return this.handleError('ZPOPMAX', 'Cannot obtain element from set');
          const curJob = result[0];
          this.client.zremrangebyrank(this.name, 0, 0);
          this.simpleAdd(curJob);
          // });
          // callback(job, () => {
          //   console.log(`Job №${index} is done`);  
          // });
        });
      });
    });
  }
}