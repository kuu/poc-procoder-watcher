const util = require('./util');
const request = require('./request');

const {
  sourceCopyFolder,
  publishInputFolder,
  publishOutputFolder,
  flexImportFolder
} = util.getConfig().path;

function renameFiles(title) {
  return request.getMetadata(title)
    .then(({filename, destination}) => {
      const deliveryFolderName = filename;
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
          // Move MXF files
          util.moveFile(`${sourceCopyFolder}/${outputFilename}`, dest);
        } else {
          util.copyFile(`${publishInputFolder}/${title}.m2t`, dest);
        }
      }
      util.moveFile(`${publishInputFolder}/${title}.m2t`, `${flexImportFolder}/${title}.m2t`);
    })
    .then(() => request.updateMetadata(title, {state: 'published'}));
}

module.exports = {
  renameFiles
};
