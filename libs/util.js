const fs = require('fs');
const path = require('path');
const config = require('config');
const fetch = require('node-fetch');
const debug = require('debug')('procoder-watcher');

const hash = Buffer.from(`${config.auth.user}:${config.auth.pass}`).toString('base64');

function checkPathExistance(path) {
  return fs.existsSync(path);
}

function getFileList(dir, extension) {
  return fs.readdirSync(dir).filter(file => {
    if (!fs.statSync(path.join(dir, file)).isFile()) {
      return false;
    }
    if (file.startsWith('.')) {
      // Ignore dot files
      return false;
    }
    if (!extension.startsWith('.')) {
      extension = `.${extension}`;
    }
    if (!file.endsWith(extension)) {
      return false;
    }
    return true;
  });
}

function getFileData(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function getFileTimestamp(filePath) {
  return new Date(fs.statSync(filePath).mtime);
}

function getFileName(filePath, sep) {
  const arr = filePath.split(sep);
  if (arr.length === 0) {
    return null;
  }
  return arr[arr.length - 1];
}

function getFileBaseName(filePath, sep) {
  const fileName = getFileName(filePath, sep);
  if (!fileName) {
    return null;
  }
  const index = fileName.lastIndexOf('.');
  if (index === -1) {
    return fileName;
  }
  return fileName.slice(0, index);
}

function moveFile(oldPath, newPath) {
  debug(`util.moveFile: ${oldPath} => ${newPath}`);
  fs.renameSync(oldPath, newPath);
}

function deleteFile(path) {
  debug(`util.deleteFile: ${path}`);
  fs.unlinkSync(path);
}

function getConfig() {
  return config;
}

function makeRequest(uri, method = 'GET', data) {
  debug(`util.makeRequest: [${method}] ${uri} ${JSON.stringify(data, null, 2)}`);
  return fetch(uri, {
    method,
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/vnd.nativ.mio.v1+json',
      Authorization: `Basic ${hash}`
    }
  })
    .then(res => {
      if (res.status >= 400) {
        return debug(`${res.status} ${res.statusText} [${method}] ${uri}`);
      }
      return res.json();
    })
    .catch(err => {
      console.error(err.stack);
      return null;
    });
}

function waitFor(milliseconds) {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

module.exports = {
  checkPathExistance,
  getFileList,
  getFileData,
  getFileTimestamp,
  getFileName,
  getFileBaseName,
  moveFile,
  deleteFile,
  getConfig,
  SEP: path.sep,
  makeRequest,
  waitFor
};
