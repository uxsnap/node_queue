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
// const { spawn } = require('child_process');
const redis = require('redis');
const EventEmitter = require('events');
const { v4 : uuidv4 } = require('uuid');
const { createRedisUri } = require('./utils');

module.exports = class Queue {
  constructor(queueServer = null) {
    this.isExecuting = false;
    this.stopExecuting = false;
    this.jobCount = 0;

    this.emitter = new EventEmitter();

    this.name = uuidv4();
    this.client = null;
    this.queueServer = queueServer
      ? createRedisUri(queueServer)
      : process.env.REDIS_SERVER;

    this.emitter.on('pause', () => {
      this.stopExecuting = true;
    });

    this.emitter.on('resume', () => {
      this.stopExecuting = false;
    });
    
    this.emitter.emit('created');
  }

  _obtainTask(job) {
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
    if (!this.client) {
      this.emitter.emit('error', (callback) => {
        this._handleError('Process', 'Process is not executed');
        callback();
      });
      return;
    }

    const { task, priority, delay } = this._obtainTask(job);
    
    if (this.isExecuting) {
      this.client.zadd(this.name, priority, `${task}&${delay}`);
      return;
    }
    
    this.isExecuting = true;
    setTimeout(async () => {
      await this._handleProc(task);
      this.isExecuting = false;
      this.emitter.emit('process_event', {
        job,
        index: ++this.jobCount
      });
    }, delay);
  }

  _handleError(type, message) {
    console.error(`${type}: ${message}`);
  }

  _handleProc(task) {
    return exec(task);
  }

  // Global events
  on(eventName, eventCallback) {
    switch (eventName) {
      case 'completed':
      case 'error':
        return this.emitter.on(eventName, eventCallback);
    }
  }

  // Pause with the last task going back to queue
  pause() {
    return new Promise((res, rej) => {
      this.emitter.emit('pause');
      res();
    })
  }
  
  // Resume queue
  resume() {
    return new Promise((res, rej) => {
      this.emitter.emit('resume');
      res();
    });
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
        this.emitter.emit('error', (callback) => {
          this._handleError('Redis', 'Cannot connect to redis');
          callback();
        });
        rej(error);
        this.client.end(true);
      });


      this.emitter.on('process_event', ({
        job,
        output,
        error,
        index
      }) => {
        if (this.stopExecuting) return;
        callback(job, () => {
          console.log(`${this.name}: Job №${index} is done with output: ${output}`);  
        });
        this.client.zrange(this.name, 0, -1, (err, result) => {
          if (!result.length) {
            this.client.end(true);
            this.emitter.emit('completed');
            return;
          }
          if (err) {
            this.emitter.emit('error', (callback) => {
              this._handleError('ZRANGE', 'Cannot obtain element from set');
              callback();
            });
            return;
          }
          const [job, delay] = result[0].split('&');
          this.client.zremrangebyrank(this.name, 0, 0);
          this.simpleAdd({task: job, priority: 1, delay});
        });
      });
    });
  }
}