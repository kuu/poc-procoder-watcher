const proxyquire = require('proxyquire');
const test = require('ava');

const mockConfig = {
  path: {
    ediusOutputFolder: '/path/to/ediusOutputFolder',
    procoderInputFolderSD: '/path/to/procoderInputFolderSD',
    procoderInputFolderHD: '/path/to/procoderInputFolderHD',
    procoderLogsFolder: '/path/to/procoderLogsFolder',
    publishInputFolder: '/path/to/publishInputFolder'
  },
  auth: {
    user: 'test',
    pass: 'test'
  },
  api: {
    baseUri: 'base-uri',
    workspace: 123,
    medatadaDefinition: 345,
    notificationWorkflow: 567,
    importWorkflow: 789,
    purgeWorkflow: 999
  }
};

const mockFs = {
  unlinkList: [],
  existsSync: path => {
    if (path === '/fake/path') {
      return false;
    }
    if (mockFs.unlinkList.includes(path)) {
      return false;
    }
    return true;
  },
  readdirSync: dir => {
    if (dir === '/empty/dir') {
      return ['.dotfile'];
    }
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
  copyFileSync: () => {
    // NOP
  },
  renameSync: () => {
    // NOP
  },
  unlinkSync: path => {
    mockFs.unlinkList.push(path);
  }
};

const mockPath = {
  join: (a, b) => {
    return `${a}/${b}`;
  },
  sep: '/'
};

const mockFetch = (url, params) => {
  if (url === 'bad-url') {
    return Promise.reject(new Error('error'));
  }
  return Promise.resolve({
    json: () => {
      return params;
    }
  });
};

const util = proxyquire('../../../libs/util', {
  fs: mockFs,
  path: mockPath,
  'node-fetch': mockFetch,
  config: mockConfig
});

test('util:checkPathExistance', t => {
  t.is(util.checkPathExistance('/real/path'), true);
  t.is(util.checkPathExistance('/fake/path'), false);
});

test('util:getFileList', t => {
  let list = util.getFileList('/path/to', 'abc');
  t.is(list.length, 1);
  t.is(list[0], 'myFile.abc');
  list = util.getFileList('/path/to', '.abc');
  t.is(list.length, 1);
  t.is(list[0], 'myFile.abc');
});

test('util:isEmptyDir', t => {
  t.is(util.isEmptyDir('/empty/dir'), true);
  t.is(util.isEmptyDir('/not/empty/dir'), false);
});

test('util:getFileData', t => {
  const data = util.getFileData('/path/to/file');
  t.is(data, 'abcdef');
});

test('util:getFileTimestamp', t => {
  const date = util.getFileTimestamp('/path/to/file');
  t.is(date.getTime(), 10000);
});

test('util:getFileName', t => {
  const fileName = util.getFileName('/path/to/file.ext', '/');
  t.is(fileName, 'file.ext');
});

test('util:getFileBaseName', t => {
  const baseName = util.getFileBaseName('/path/to/file.ext', '/');
  t.is(baseName, 'file');
});

test('util:copyFile', t => {
  const src = '/src/path';
  const dest = '/dest/path';
  util.copyFile(src, dest);
  t.is(util.checkPathExistance(dest), true);
});

test('util:moveFile', t => {
  const oldPath = '/fake/path';
  const newPath = '/real/path';
  util.moveFile(oldPath, newPath);
  t.is(util.checkPathExistance(oldPath), false);
  t.is(util.checkPathExistance(newPath), true);
});

test('util:deleteFile', t => {
  const path = '/file/to/delete';
  t.is(util.checkPathExistance(path), true);
  util.deleteFile(path);
  t.is(util.checkPathExistance(path), false);
});

test('util:getConfig', t => {
  t.is(util.getConfig().path.procoderLogsFolder, '/path/to/procoderLogsFolder');
  t.is(util.getConfig().auth.pass, 'test');
  t.is(util.getConfig().api.medatadaDefinition, 345);
});

test('util:SEP', t => {
  t.is(util.SEP, '/');
});

test('util:makeRequest', async t => {
  const hash = Buffer.from('test:test').toString('base64');
  let res = await util.makeRequest('good-url');
  t.is(res.method, 'GET');
  t.is(res.body, undefined);
  t.is(res.headers.Authorization, `Basic ${hash}`);
  res = await util.makeRequest('good-url', 'POST', {user: 'test'});
  t.is(res.method, 'POST');
  t.is(res.body, '{"user":"test"}');
  t.is(res.headers['Content-Type'], 'application/vnd.nativ.mio.v1+json');
  t.is(res.headers.Authorization, `Basic ${hash}`);
  res = await util.makeRequest('bad-url');
  t.is(res, null);
});
