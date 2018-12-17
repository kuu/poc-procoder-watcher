const util = require('./util');
const request = require('./request');

const {
  publishInputFolder,
  publishOutputFolder,
  flexImportFolder
} = util.getConfig().path;

function copySourceFile(fileName, dest) {
  // Windows-dependent code
  const driveNames = ['E:\\', 'F:\\', 'G:\\'];
  for (const root of driveNames) {
    const list = util.findFile(fileName, root);
    if (list.length > 0) {
      util.copyFile(list[0], dest);
      return true;
    }
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
        const dest = `${dirPath}/${outputFilename}`;
        if (outputFilename.endsWith('.mxf')) {
          copySourceFile(outputFilename, dest);
        } else {
          util.copyFile(`${publishInputFolder}/${title}.${ext}`, dest);
        }
      }
      util.moveFile(`${publishInputFolder}/${title}.${ext}`, `${flexImportFolder}/${title}.${ext}`);
    })
    .then(() => request.updateMetadata(title, {state: 'published'}));
}

module.exports = {
  renameFiles
};
