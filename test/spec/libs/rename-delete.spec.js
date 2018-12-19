const proxyquire = require('proxyquire');
const test = require('ava');
const sinon = require('sinon');

const mockConfig = {
  path: {
    publishInputFolder: '/path/to/publishInputFolder',
    publishOutputFolder: '/path/to/publishOutputFolder',
    flexImportFolder: '/path/to/flexImportFolder'
  },
  auth: {
    user: 'test',
    pass: 'test'
  },
  api: {
    baseUri: 'base-uri',
    workspace: 123,
    metadataDefinition: 345,
    notificationWorkflow: 567,
    importWorkflow: 789,
    purgeWorkflow: 999
  }
};

const mockFs = {
  existsSync: path => {
    if (path === '/fake/path') {
      return false;
    }
    if (mockFs.unlinkList.includes(path)) {
      return false;
    }
    if (path.startsWith('E:\\')) {
      return false;
    }
    return true;
  },
  mkdirSync: () => {
    // NOP
  },
  copyFileSync: () => {
    // NOP
  },
  renameSync: () => {
    // NOP
  },

  unlinkList: [],

  readdirSync: () => {
    return ['myFile', 'myDir', 'myFile.abc', '.myFile.abc'];
  },
  statSync: path => {
    return {
      isFile: () => {
        if (path.endsWith('myDir')) {
          return false;
        }
        return true;
      },
      mtime: new Date(10000)
    };
  },
  readFileSync: () => {
    return 'abcdef';
  },

  unlinkSync: path => {
    mockFs.unlinkList.push(path);
  }
};

const spyCopy = sinon.spy(mockFs, 'copyFileSync');
const spyRename = sinon.spy(mockFs, 'renameSync');
const spyUnlink = sinon.spy(mockFs, 'unlinkSync');

const {
  publishInputFolder,
  publishOutputFolder,
  flexImportFolder
} = mockConfig.path;

const mockPath = {
  join: (a, b) => {
    return `${a}/${b}`;
  },
  sep: '/'
};

const metadataInstances = {
  abc: {
    title: 'abc',
    state: 'transcoded',
    filename: 'some.xls',
    resolution: 'SD',
    destination: [
      {name: 'A', 'output-filename': 'Output-A.m2t'},
      {name: 'B', 'output-filename': 'Output-B.mxf'},
      {name: 'C:D', 'output-filename': 'Output-C-D.m2t'}
    ]
  }
};

const {
  baseUri,
  workspace,
  metadataDefinition
} = mockConfig.api;

const mockFetch = (url, params) => {
  // console.log(`[${params.method}] ${url}`);
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
  if (params.method === 'POST' && url === `${baseUri}/workflows`) {
    return Promise.resolve({
      json: () => {
        return {
          id: 'abc'
        };
      }
    });
  }
  if (params.method === 'GET' && url.startsWith(`${baseUri}/workflows/`)) {
    return Promise.resolve({
      json: () => {
        return {
          status: 'Completed'
        };
      }
    });
  }
  return Promise.resolve({});
};

const mockUtil = proxyquire('../../../libs/util', {
  fs: mockFs,
  path: mockPath,
  config: mockConfig,
  'node-fetch': mockFetch
});

const mockRequest = proxyquire('../../../libs/request', {'./util': mockUtil});

const {renameFiles} = proxyquire(
  '../../../libs/rename', {
    './util': mockUtil,
    './request': mockRequest
  });

const {deleteFiles} = proxyquire(
  '../../../libs/delete', {
    './util': mockUtil,
    './request': mockRequest
  });

test('rename-delete', async t => {
  const title = 'abc';
  const {filename, destination} = metadataInstances[title];

  await renameFiles(title);
  t.is(spyCopy.callCount, destination.length);
  const srcTS = `${publishInputFolder}/${title}.mpg`;
  const srcMXF = `F:\\${title}.mxf`;
  t.is(spyCopy.getCall(0).calledWithExactly(srcTS, `${publishOutputFolder}/${destination[0].name}/${filename}/${destination[0]['output-filename']}`), true);
  t.is(spyCopy.getCall(1).calledWithExactly(srcMXF, `${publishOutputFolder}/${destination[1].name}/${filename}/${destination[1]['output-filename']}`), true);
  t.is(spyCopy.getCall(2).calledWithExactly(srcTS, `${publishOutputFolder}/${destination[2].name.replace(/:/g, '-')}/${filename}/${destination[2]['output-filename']}`), true);
  t.is(spyRename.callCount, 1);
  t.is(spyRename.getCall(0).calledWithExactly(srcTS, `${flexImportFolder}/${title}.mpg`), true);

  await deleteFiles(title);
  t.is(spyUnlink.callCount, destination.length);
  t.is(spyUnlink.getCall(0).calledWithExactly(`${publishOutputFolder}/${destination[0].name}/${filename}/${destination[0]['output-filename']}`), true);
  t.is(spyUnlink.getCall(1).calledWithExactly(`${publishOutputFolder}/${destination[1].name}/${filename}/${destination[1]['output-filename']}`), true);
  t.is(spyUnlink.getCall(2).calledWithExactly(`${publishOutputFolder}/${destination[2].name.replace(/:/g, '-')}/${filename}/${destination[2]['output-filename']}`), true);
});
