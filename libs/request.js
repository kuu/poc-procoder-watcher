const debug = require('debug')('procoder-watcher');

const {makeRequest, getConfig, waitFor} = require('./util');

const {
  baseUri,
  workspace,
  metadataDefinition,
  importWorkflow,
  publishWorkflow
} = getConfig().api;

const assetIdCache = new Map();

function getAssetId(title) {
  if (assetIdCache.has(title)) {
    return Promise.resolve(assetIdCache.get(title));
  }
  return makeRequest(`${baseUri}/assets;workspaceId=${workspace};metadataDefinitionId=${metadataDefinition};searchText="${title}"`)
    .then(({assets}) => {
      if (!assets) {
        throw new Error(`No asset (${title}) found`);
      }
      const {id} = assets.find(asset => asset.name === title);
      assetIdCache.set(title, id);
      return id;
    });
}

function getMetadata(title) {
  return getAssetId(title)
    .then(id => {
      return makeRequest(`${baseUri}/assets/${id}/metadata`)
        .then(({instance}) => instance);
    });
}

function putMetadata(title, metadata) {
  return getAssetId(title)
    .then(id => {
      return makeRequest(`${baseUri}/assets/${id}/metadata`, 'PUT', metadata)
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
      return makeRequest(`${baseUri}/workflows`, 'POST', {
        definitionId,
        workspaceId: workspace,
        assetId,
        stringVariables: variables
      })
        .then(async res => {
          while (!(await checkIfWorkflowCompleted(res.id))) {
            await waitFor(1000);
          }
        });
    });
}

function checkIfWorkflowCompleted(instanceId) {
  return makeRequest(`${baseUri}/workflows/${instanceId}`)
    .then(({status}) => {
      debug(`Workflow (id=${instanceId}): ${status}`);
      return status === 'Completed' || status === 'Failed';
    });
}

function launchImportWorkflow(title, job) {
  const state = job.status === 'completed' ? 'transcoded' : 'transcoding-failed';
  return launchWorkflow(importWorkflow, title, {state})
    .then(() => {
      if (state === 'transcoding-failed') {
        assetIdCache.delete(title);
      }
    });
}

function launchPublishWorkflow(title) {
  return launchWorkflow(publishWorkflow, title)
    .then(() => {
      assetIdCache.delete(title);
    });
}

module.exports = {
  getMetadata,
  updateMetadata,
  launchImportWorkflow,
  launchPublishWorkflow
};
