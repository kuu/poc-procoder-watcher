const debug = require('debug')('procoder-watcher');

const {iterate} = require('./libs/log');
const request = require('./libs/request');
const util = require('./libs/util');
const {renameFiles} = require('./libs/rename');

const {path} = util.getConfig();
const TIMEOUT = 1000;

function checkPath() {
  if (!util.checkPathExistance(path.ediusOutputFolder)) {
    throw new Error(`Invalid EDIUS Output Folder: ${path.ediusOutputFolder}`);
  }

  if (!util.checkPathExistance(path.procoderInputFolderSD)) {
    throw new Error(`Invalid ProCoder Input Folder (SD): ${path.procoderInputFolderSD}`);
  }

  if (!util.checkPathExistance(path.procoderInputFolderHD)) {
    throw new Error(`Invalid ProCoder Input Folder (HD): ${path.procoderInputFolderHD}`);
  }

  if (!util.checkPathExistance(path.procoderLogsFolder)) {
    throw new Error(`Invalid ProCoder Logs Folder: ${path.procoderLogsFolder}`);
  }

  if (!util.checkPathExistance(path.publishInputFolder)) {
    throw new Error(`Invalid Publish Input Folder: ${path.publishInputFolder}`);
  }

  if (!util.checkPathExistance(path.sourceCopyFolder)) {
    throw new Error(`Invalid Source Copy Folder: ${path.sourceCopyFolder}`);
  }

  if (!util.checkPathExistance(path.flexImportFolder)) {
    throw new Error(`Invalid Flex Import Folder: ${path.flexImportFolder}`);
  }

  debug('All paths are valid');
}

function checkFiles() {
  return Promise.all([
    checkEdiusOutput(),
    checkProcoderLogs(),
    checkPublishInput()
  ]);
}

const procoderInputFilesToDelete = {};
let pendingFiles = [];

function checkEdiusOutput() {
  const fileList = util.getFileList(path.ediusOutputFolder, 'avi');
  if (fileList.length === 0) {
    return Promise.resolve([]);
  }
  const promises = [];
  for (const file of fileList) {
    const title = util.getFileBaseName(file, util.SEP);
    if (!title) {
      continue;
    }
    promises.push(
      request.getMetadata(title).then(({resolution}) => {
        let destination;
        if (resolution === 'HD') {
          destination = path.procoderInputFolderHD;
        } else {
          destination = path.procoderInputFolderSD;
        }
        util.moveFile(
          `${path.ediusOutputFolder}/${file}`,
          `${destination}/${title}.avi`
        );
        debug(`Moved ${title}.avi to Procoder's ${resolution} folder`);
        procoderInputFilesToDelete[title] = `${destination}/${title}.avi`;
        return resolution;
      })
    );
  }
  return Promise.all(promises);
}

function deleteProcoderInputFile(title) {
  const path = procoderInputFilesToDelete[title];
  if (!path) {
    return false;
  }
  pendingFiles.push(path);
  delete procoderInputFilesToDelete[title];
  return true;
}

function deletePendingFiles() {
  const unableToDelete = [];
  for (const path of pendingFiles) {
    try {
      util.deleteFile(path);
    } catch (_) {
      unableToDelete.push(path);
    }
  }
  pendingFiles = unableToDelete;
}

function checkProcoderLogs() {
  const updateList = iterate(path.procoderLogsFolder);
  const promises = [];
  for (const job of updateList) {
    const title = job.source.slice(0, -4);
    if (job.status === 'completed' || job.status === 'failed') {
      if (!deleteProcoderInputFile(title)) {
        continue;
      }
      debug(`Job ${job.status}: ${title}`);
      promises.push(
        request.launchImportWorkflow(title, job)
      );
    } else {
      debug(`Job updated: ${title}  progress=${job.progress}`);
      promises.push(
        request.updateMetadata(title, {
          state: 'transcoding',
          'transcoding-progress': job.progress
        })
      );
    }
  }
  deletePendingFiles();
  return Promise.all(promises);
}

function copySourceFile(title) {
  return request.getMetadata(title)
    .then(({destination}) => {
      for (const dest of destination) {
        const fileName = dest['output-filename'];
        if (!fileName.endsWith('.mxf')) {
          continue;
        }
        // Windows-dependent code
        const driveNames = ['/E/', '/F/', '/G/'];
        for (const root of driveNames) {
          const list = util.findFile(fileName, root);
          if (list.length > 0) {
            util.copyFile(list[0], path.sourceCopyFolder);
            return true;
          }
        }
      }
      return false;
    });
}

async function checkPublishInput() {
  const fileList = util.getFileList(path.publishInputFolder, 'm2t');
  if (fileList.length === 0) {
    return Promise.resolve([]);
  }
  const promises = [];
  for (const file of fileList) {
    const title = util.getFileBaseName(file, util.SEP);
    if (!title) {
      continue;
    }
    debug(`Rename: ${title}`);
    promises.push(
      copySourceFile(title)
        .then(() => renameFiles(title))
        .then(() => request.removeAssetIdCache(title))
    );
  }
  return Promise.all(promises);
}

function callback() {
  return checkFiles()
    .then(() => {
      setTimeout(callback, TIMEOUT);
    })
    .catch(err => {
      console.error(err.stack);
      setTimeout(callback, TIMEOUT);
    });
}

checkPath();

setTimeout(callback, 0);
