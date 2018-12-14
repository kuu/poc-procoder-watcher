const util = require('./util');
const request = require('./request');

const {sourceCopyFolder, publishInputFolder, publishOutputFolder} = util.getConfig().path;

function renameFiles(title) {
  return request.getMetadata(title)
    .then(({filename, destination}) => {
      const deliveryFolderName = filename;
      for (const item of destination) {
        const dirPath = `${publishOutputFolder}/${item.name}/${deliveryFolderName}/`;
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
    });
}

module.exports = {
  renameFiles
};
