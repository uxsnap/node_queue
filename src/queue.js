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
const EventEmitter = require('events');
const Job = require('./job');
const { v4 : uuidv4 } = require('uuid');
const { createRedisUri } = require('./utils');

module.exports = class Queue {
  constructor(queueServer = null) {
    this.isExecuting = false;

    this.jobCount = 0;

    this.emitter = new EventEmitter();

    this.name = uuidv4();
    this.client = null;
    this.queueServer = queueServer
      ? createRedisUri(queueServer)
      : process.env.REDIS_SERVER;
    
  }

  obtainTask(job) {
    const returnRes = {
      'string': { task: job, priority: 1, delay: 0 },
      'object': {
        task: job.task,
        priority: job.priority,
        delay: job.delay
      }
    };
    return returnRes[job.length ? 'string' : 'object'];
  }


  // add(job) {
  //   const innerJob = new Job(job);
  //   if (innerJob.checkJobParams())
  //     // this.queue.push(innerJob);
  // }

  /*
    Job : { taks: string, priority: number, delay: time ( only in seconds by now ) }
  */

  // Adding job to queue that immediatelly invokes
  simpleAdd(job) {
    if (!this.client)
      return;
    
    const { task, priority, delay } = this.obtainTask(job);

    if (this.isExecuting) {
      this.client.zadd(this.name, priority, `${task}&${delay}`);
      return;
    }
    
    this.isExecuting = true;
    setTimeout(async () => {
      const { stdout, stderr } = await exec(task);
      this.isExecuting = false;
      this.emitter.emit('process_event', {
        job,
        output: stdout,
        error: stderr,
        index: ++this.jobCount
      });
    }, delay);
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

      this.emitter.on('process_event', ({
        job,
        output,
        error,
        index
      }) => {
        callback(job, () => {
          console.log(`${this.name}: Job №${index} is done with output: ${output}`);  
        });
        this.client.zrange(this.name, 0, -1, (err, result) => {
          if (!result.length) {
            this.client.end(true);
            return;
          }
          if (err)
            return this.handleError('ZRANGE', 'Cannot obtain element from set');
          const [job, delay] = result[0].split('&');
          this.client.zremrangebyrank(this.name, 0, 0);
          this.simpleAdd({task: job, priority: 1, delay});
        });
      });
    });
  }
}