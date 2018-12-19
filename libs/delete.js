const util = require('./util');
const request = require('./request');

const {
  publishOutputFolder
} = util.getConfig().path;

function deleteFiles(title) {
  return request.getMetadata(title)
    .then(({filename, destination}) => {
      for (const item of destination) {
        let platformName = item.name;
        if (platformName.indexOf(':') !== -1) {
          platformName = platformName.replace(/:/g, '-');
        }
        const path = `${publishOutputFolder}/${platformName}/${filename}/${item['output-filename']}`;
        if (!util.checkPathExistance(path)) {
          continue;
        }
        util.deleteFile(path);
      }
      request.launchPurgeWorkflow(title);
    });
}

module.exports = {
  deleteFiles
};
