const debug = require('debug')('procoder-watcher');

const util = require('./util');

const {api} = util.getConfig();

const {
  baseUri,
  workspace,
  metadataDefinition,
  notificationWorkflow,
  importWorkflow,
  purgeWorkflow
} = api;

const assetIdCache = new Map();

function getAssets(state) {
  return util.makeRequest(`${baseUri}/assets;workspaceId=${workspace};metadataDefinitionId=${metadataDefinition};searchText="${state}";includeMetadata=true`)
    .then(res => {
      if (!res || !res.assets) {
        throw new Error(`No asset (state = ${state}) found`);
      }
      return res.assets.filter(({metadata}) => metadata.instance.state === state).map(({metadata}) => metadata.instance);
    });
}

function getAssetId(title) {
  if (assetIdCache.has(title)) {
    return Promise.resolve(assetIdCache.get(title));
  }
  return util.makeRequest(`${baseUri}/assets;workspaceId=${workspace};metadataDefinitionId=${metadataDefinition};searchText="${title}"`)
    .then(res => {
      if (!res || !res.assets) {
        throw new Error(`No asset (title = ${title}) found`);
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

function launchNotificationWorkflow(title, job) {
  const state = job.status === 'completed' ? 'transcoded' : 'transcoding-failed';
  const variables = {state};
  if (state === 'transcoded') {
    variables.reviewFilePath = job.destination;
  }
  return launchWorkflow(notificationWorkflow, title, variables);
}

function launchImportWorkflow(title) {
  return getMetadata(title)
    .then(({resolution}) => {
      const ext = resolution === 'HD' ? 'm2t' : 'mpg';
      return launchWorkflow(importWorkflow, title, {resourceItemName: `${title}.${ext}`});
    });
}

function launchPurgeWorkflow(title) {
  return launchWorkflow(purgeWorkflow, title)
    .then(() => assetIdCache.delete(title));
}

module.exports = {
  getAssets,
  getMetadata,
  updateMetadata,
  launchNotificationWorkflow,
  launchImportWorkflow,
  launchPurgeWorkflow
};
