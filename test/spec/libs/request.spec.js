const proxyquire = require('proxyquire');
const test = require('ava');
const sinon = require('sinon');

const mockConfig = {
  auth: {
    user: 'test',
    pass: 'test'
  },
  api: {
    baseUri: 'base-uri',
    workspace: 123,
    metadataDefinition: 345,
    notifyWorkflow: 567,
    importWorkflow: 789
  }
};

test('request:getMetadata', async t => {
  const stateMap = {
    abc: 'waiting-for-media',
    def: 'transcoding',
    ghi: 'published'
  };

  const spyObj = {
    fetch: (/* url, params */) => {
      // console.log(url, JSON.stringify(params, null, 2));
    }
  };

  const mockFetch = (url, params) => {
    spyObj.fetch(url, params);
    const {
      baseUri,
      workspace,
      metadataDefinition
    } = mockConfig.api;

    let prefix = `${baseUri}/assets;workspaceId=${workspace};metadataDefinitionId=${metadataDefinition};searchText="`;
    let suffix = '"';
    if (params.method === 'GET' && url.startsWith(prefix)) {
      const title = url.slice(prefix.length, -(suffix.length));
      return Promise.resolve({
        json: () => {
          return {
            assets: [
              {name: title, id: title}
            ]
          };
        }
      });
    }
    prefix = `${baseUri}/assets/`;
    suffix = '/metadata';
    if (params.method === 'GET' && url.startsWith(prefix) && url.endsWith(suffix)) {
      const title = url.slice(prefix.length, -(suffix.length));
      return Promise.resolve({
        json: () => {
          return {
            instance: {
              state: stateMap[title]
            }
          };
        }
      });
    }
    return Promise.resolve();
  };

  const mockUtil = proxyquire('../../../libs/util', {
    'node-fetch': mockFetch,
    config: mockConfig
  });

  const request = proxyquire('../../../libs/request', {'./util': mockUtil});

  const spy = sinon.spy(spyObj, 'fetch');

  let metadata = await request.getMetadata('abc');
  t.is(metadata.state, 'waiting-for-media');
  metadata = await request.getMetadata('def');
  t.is(metadata.state, 'transcoding');
  metadata = await request.getMetadata('ghi');
  t.is(metadata.state, 'published');
  t.is(spy.callCount, 6);
  metadata = await request.getMetadata('abc');
  t.is(metadata.state, 'waiting-for-media');
  metadata = await request.getMetadata('def');
  t.is(metadata.state, 'transcoding');
  metadata = await request.getMetadata('ghi');
  t.is(metadata.state, 'published');
  t.is(spy.callCount, 9);
});

test('request:updateMetadata', async t => {
  const metadataInstances = {
    abc: {
      title: 'abc',
      state: 'transcoding',
      progress: 75
    }
  };

  const spyObj = {
    fetch: (/* url, params */) => {
      // console.log(url, JSON.stringify(params, null, 2));
    }
  };

  const {
    baseUri,
    workspace,
    metadataDefinition
  } = mockConfig.api;

  const mockFetch = (url, params) => {
    spyObj.fetch(url, params);

    let prefix = `${baseUri}/assets;workspaceId=${workspace};metadataDefinitionId=${metadataDefinition};searchText="`;
    let suffix = '"';
    if (params.method === 'GET' && url.startsWith(prefix)) {
      const title = url.slice(prefix.length, -(suffix.length));
      return Promise.resolve({
        json: () => {
          return {
            assets: [
              {name: title, id: title}
            ]
          };
        }
      });
    }
    prefix = `${baseUri}/assets/`;
    suffix = '/metadata';
    if (url.startsWith(prefix) && url.endsWith(suffix)) {
      const title = url.slice(prefix.length, -(suffix.length));
      if (params.method === 'PUT') {
        metadataInstances[title] = JSON.parse(params.body);
      }
      return Promise.resolve({
        json: () => {
          return {
            instance: metadataInstances[title]
          };
        }
      });
    }
    return Promise.resolve();
  };

  const mockUtil = proxyquire('../../../libs/util', {
    'node-fetch': mockFetch,
    config: mockConfig
  });

  const request = proxyquire('../../../libs/request', {'./util': mockUtil});

  const spy = sinon.spy(spyObj, 'fetch');

  let metadata = await request.getMetadata('abc');
  t.is(metadata.state, 'transcoding');

  const newMetadata = {state: 'transcoded', progress: 100};
  await request.updateMetadata('abc', newMetadata);

  metadata = await request.getMetadata('abc');
  t.is(metadata.title, 'abc');
  t.is(metadata.state, 'transcoded');
  t.is(metadata.progress, 100);

  const hash = Buffer.from('test:test').toString('base64');
  const headers = {
    'Content-Type': 'application/vnd.nativ.mio.v1+json',
    Authorization: `Basic ${hash}`
  };

  const params = {
    method: 'PUT',
    body: JSON.stringify(metadata),
    headers
  };
  t.is(spy.getCall(3).calledWithExactly(`${baseUri}/assets/abc/metadata`, params), true);
});
