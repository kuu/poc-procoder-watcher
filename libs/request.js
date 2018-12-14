const debug = require('debug')('procoder-watcher');

const util = require('./util');

const {api, path} = util.getConfig();

const {
  baseUri,
  workspace,
  metadataDefinition,
  importWorkflow,
  publishWorkflow
} = api;

const {sourceCopyFolder} = path;

const assetIdCache = new Map();

function getAssetId(title) {
  if (assetIdCache.has(title)) {
    return Promise.resolve(assetIdCache.get(title));
  }
  return util.makeRequest(`${baseUri}/assets;workspaceId=${workspace};metadataDefinitionId=${metadataDefinition};searchText="${title}"`)
    .then(res => {
      if (!res || !res.assets) {
        throw new Error(`No asset (${title}) found`);
      }
      const {id} = res.assets.find(asset => asset.name === title);
      assetIdCache.set(title, id);
      return id;
    });
}

function getMetadata(title) {
  return getAssetId(title)
    .then(id => {
      return util.makeRequest(`${baseUri}/assets/${id}/metadata`)
        .then(({instance}) => instance);
    });
}

function putMetadata(title, metadata) {
  return getAssetId(title)
    .then(id => {
      return util.makeRequest(`${baseUri}/assets/${id}/metadata`, 'PUT', metadata)
        .then(({instance}) => instance);
    });
}

function updateMetadata(title, newMetadata) {
  return getMetadata(title)
    .then(metadata => {
      for (const key of Object.keys(newMetadata)) {
        metadata[key] = newMetadata[key];
      }
      return putMetadata(title, metadata);
    });
}

function launchWorkflow(definitionId, title, variables = {}) {
  return getAssetId(title)
    .then(assetId => {
      return util.makeRequest(`${baseUri}/workflows`, 'POST', {
        definitionId,
        workspaceId: workspace,
        assetId,
        stringVariables: variables
      })
        .then(async res => {
          while (!(await checkIfWorkflowCompleted(res.id))) {
            await util.waitFor(1000);
          }
        });
    });
}

function checkIfWorkflowCompleted(instanceId) {
  return util.makeRequest(`${baseUri}/workflows/${instanceId}`)
    .then(({status}) => {
      debug(`Workflow (id=${instanceId}): ${status}`);
      return status === 'Completed' || status === 'Failed';
    });
}

function launchImportWorkflow(title, job) {
  const state = job.status === 'completed' ? 'transcoded' : 'transcoding-failed';
  const variables = {state};
  if (state === 'transcoded') {
    variables.reviewFilePath = job.destination;
  }
  return launchWorkflow(importWorkflow, title, variables)
    .then(() => {
      if (state === 'transcoding-failed') {
        assetIdCache.delete(title);
      }
    });
}

function copySourceFile(title) {
  return getMetadata(title)
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
            util.copyFile(list[0], sourceCopyFolder);
            return true;
          }
        }
      }
      return false;
    });
}

function launchPublishWorkflow(title) {
  return copySourceFile(title)
    .then(() => launchWorkflow(publishWorkflow, title, {resourceItemName: `${title}.m2t`}))
    .then(() => assetIdCache.delete(title));
}

module.exports = {
  getMetadata,
  updateMetadata,
  launchImportWorkflow,
  launchPublishWorkflow
};
