/*
 * Job options:
 * - job delay
 * - job priority
 * - job path
 * */
// const fs = require('fs');
const http = require('https');
const {
  video,
  audio,
  image,
  text
} = require('./jobTypes');

module.exports = class Job {
  constructor(options) {
    this.options = options;
  }
  checkJobParams(job) {
    const key = Object.keys(job)[0];
    const jobVal = job[key];
    switch (key) {
      case "video":
        return this.handleVideo(jobVal);
      case "audio":
        return this.handleAudio(jobVal);
      case "image":
        return this.handleImage(jobVal);
      case "text":
        return this.handleText(jobVal);
      default:
        return;
    }
  }
  
  handleText() {}
}
