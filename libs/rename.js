const debug = require('debug')('procoder-watcher');

const util = require('./util');
const request = require('./request');

const {
  publishInputFolder,
  publishOutputFolder,
  flexImportFolder
} = util.getConfig().path;

function copySourceFile(fileName, dest) {
  // TODO: Windows dependent code
  const driveNames = ['E:\\', 'F:\\', 'G:\\'];
  for (const root of driveNames) {
    const src = `${root}\\${fileName}`;
    if (!util.checkPathExistance(src)) {
      debug(`No such path - ${src}`);
      continue;
    }
    util.copyFile(src, dest);
    return true;
  }
  return false;
}

function renameFiles(title) {
  return request.getMetadata(title)
    .then(({filename, destination, resolution}) => {
      const deliveryFolderName = filename;
      const ext = resolution === 'HD' ? 'm2t' : 'mpg';
      for (const item of destination) {
        let platformName = item.name;
        if (platformName.indexOf(':') !== -1) {
          platformName = platformName.replace(/:/g, '-');
        }
        const dirPath = `${publishOutputFolder}/${platformName}/${deliveryFolderName}/`;
        if (!util.checkPathExistance(dirPath)) {
          util.mkdir(dirPath);
        }
        const outputFilename = item['output-filename'];
        if (outputFilename.endsWith('.mxf')) {
          copySourceFile(outputFilename, `${dirPath}/${outputFilename}`);
        } else {
          util.copyFile(`${publishInputFolder}/${title}.${ext}`, `${dirPath}/${title}.${ext}`);
        }
      }
      util.moveFile(`${publishInputFolder}/${title}.${ext}`, `${flexImportFolder}/${title}.${ext}`);
    })
    .then(() => request.updateMetadata(title, {state: 'published'}));
}

module.exports = {
  renameFiles
};
