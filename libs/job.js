const {xml2js} = require('xml-js');
const {getFileName, SEP} = require('./util');

class Job {
  constructor(id, type, source, queuedTime) {
    this.id = id;
    this.type = type;
    this.source = source;
    this.queuedTime = queuedTime;
    this.status = 'queued';
    this.error = null;
    this.progress = 0;
    this.destination = '';
    this.endTime = null;
    this.fileSize = 0;
  }
}

function parseJob(id, data) {
  const job = xml2js(data, {compact: true});
  const {cnpsXML} = job;
  if (!cnpsXML) {
    return null;
  }

  const type = cnpsXML._attributes.TypeName;
  if (type !== 'TRANSCODINGJOB' || !cnpsXML.WorkerData || !cnpsXML.JobSubmitInfo) {
    return null;
  }

  const [filePath, queued] = getSourceFilePath(cnpsXML.WorkerData.Sources);
  if (!filePath) {
    return null;
  }

  const source = getFileName(filePath, SEP);
  const queuedTime = getQueuedTime(cnpsXML.JobSubmitInfo._attributes.Name);
  const res = new Job(id, type, source, queuedTime);

  const error = checkError(cnpsXML.Failures.Errors);
  if (error) {
    res.status = 'failed';
    res.error = error;
    return res;
  }

  const progress = parseInt(cnpsXML._attributes['PROGRESS.DWD'], 10);
  res.progress = progress;
  if (progress < 100) {
    res.status = queued ? 'queued' : 'started';
    return res;
  }

  res.status = 'completed';
  res.destination = cnpsXML.WorkerData.Destinations.Module_0.TargetFiles._attributes.File_0;
  res.fileSize = parseInt(cnpsXML.WorkerData.Destinations.Module_0.TargetFiles._attributes['FileSize_0.QWD'], 10);
  return res;
}

function getSourceFilePath(sources) {
  if (sources.SourceFiles) {
    return [sources.SourceFiles._attributes.File_0, false];
  }
  if (sources.Module_0._attributes.Filename) {
    return [sources.Module_0._attributes.Filename, false];
  }
  return [sources.Module_0.ModuleData.SourceModules.MultiSrcModule_0._attributes.Filename, true];
}

function checkError(obj) {
  if (!obj || Object.keys(obj).length === 0) {
    return null;
  }
  return obj;
}

function getQueuedTime(name) {
  const left = name.indexOf('(');
  const right = name.indexOf(')');
  if (left === -1 || right === -1 || left >= right) {
    return null;
  }
  return new Date(name.slice(left + 1, right));
}

exports.parse = parseJob;
