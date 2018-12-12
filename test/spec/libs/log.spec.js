const proxyquire = require('proxyquire');
const test = require('ava');

const dirSnapshots = [
  ['xxx.pws'],
  ['xxx.pws', 'yyy.pws'],
  ['xxx.pws', 'yyy.pws', 'zzz.pws'],
  ['xxx.pws', 'yyy.pws', 'zzz.pws'],
  ['xxx.pws', 'yyy.pws', 'zzz.pws']
];

function jobTemplate(source, queuedTime, error = '', progress = 0, destination = '', fileSize = 0) {
  return `
  <?xml version="1.0" encoding="UTF-8"?>
  <cnpsXML
    TypeName="TRANSCODINGJOB"
    PROGRESS.DWD="${progress}">
    <JobSubmitInfo 
      Name="Job (${queuedTime.toLocaleString()})" />
    <Failures><Warnings/><Errors>${error}</Errors></Failures>
    <WorkerData>
      <Sources Duration.QWD="20980159201">
        <SourceFiles File_0="/path/from/${source}"/>
      </Sources>
      <Destinations>
        <Module_0>
          <TargetFiles 
            File_0="/path/to/${destination}" 
            FileSize_0.QWD="${fileSize}" />
        </Module_0>
      </Destinations>
    </WorkerData>
  </cnpsXML>
  `;
}

const iterateCounter = {
  all: 0,
  xxx: 0,
  yyy: 0,
  zzz: 0
};

const mockFs = {
  readdirSync: () => {
    return dirSnapshots[iterateCounter.all++];
  },
  statSync: filePath => {
    let mtime = 0;
    if (filePath.endsWith('xxx.pws')) {
      mtime = 1000;
    } else if (filePath.endsWith('yyy.pws')) {
      mtime = 2000;
    } else if (filePath.endsWith('zzz.pws')) {
      mtime = 3000;
    }
    return {
      isFile: () => {
        return true;
      },
      mtime: new Date(mtime)
    };
  },
  readFileSync: filePath => {
    if (filePath.endsWith('xxx.pws')) {
      switch (iterateCounter.xxx++) {
        case 0:
          return jobTemplate('xxx.avi', new Date(0));
        case 1:
          return jobTemplate('xxx.avi', new Date(0), '', 50);
        case 2:
          return jobTemplate('xxx.avi', new Date(0), '', 100, 'xxx.mp4', 1000);
        default:
          return jobTemplate('xxx.avi', new Date(0), '', 100, 'xxx.mp4', 1000);
      }
    } else if (filePath.endsWith('yyy.pws')) {
      switch (iterateCounter.yyy++) {
        case 0:
          return jobTemplate('yyy.avi', new Date(1000));
        case 1:
          return jobTemplate('yyy.avi', new Date(1000), '', 50);
        case 2:
          return jobTemplate('yyy.avi', new Date(1000), '', 100, 'yyy.mp4', 2000);
        default:
          return jobTemplate('yyy.avi', new Date(1000), '', 100, 'yyy.mp4', 2000);
      }
    } else if (filePath.endsWith('zzz.pws')) {
      switch (iterateCounter.zzz++) {
        case 0:
          return jobTemplate('zzz.avi', new Date(2000));
        case 1:
          return jobTemplate('zzz.avi', new Date(2000), '', 50);
        case 2:
          return jobTemplate('zzz.avi', new Date(2000), '<Error1 />');
        default:
          return jobTemplate('zzz.avi', new Date(2000), '<Error1 />');
      }
    }
  }
};

const mockUtil = proxyquire('../../../libs/util', {fs: mockFs});
const {iterate, get} = proxyquire('../../../libs/log', {'./util': mockUtil});

test('log:parse', t => {
  // 1st iteration
  iterate('/path/to');
  let list = get(3);
  t.is(list.length, 1);
  t.is(list[0].status, 'started');
  t.is(list[0].source, 'xxx.avi');
  t.is(list[0].queuedTime.getTime(), 0);
  t.is(list[0].error, null);
  t.is(list[0].progress, 0);
  // 2nd iteration
  iterate('/path/to');
  list = get(3);
  t.is(list.length, 2);
  t.is(list[0].status, 'started');
  t.is(list[0].source, 'yyy.avi');
  t.is(list[0].queuedTime.getTime(), 1000);
  t.is(list[0].error, null);
  t.is(list[0].progress, 0);
  t.is(list[1].status, 'started');
  t.is(list[1].source, 'xxx.avi');
  t.is(list[1].queuedTime.getTime(), 0);
  t.is(list[1].error, null);
  t.is(list[1].progress, 50);

  // 3rd iteration
  iterate('/path/to');
  list = get(3);
  t.is(list.length, 3);
  t.is(list[0].status, 'started');
  t.is(list[0].source, 'zzz.avi');
  t.is(list[0].queuedTime.getTime(), 2000);
  t.is(list[0].error, null);
  t.is(list[0].progress, 0);
  t.is(list[1].status, 'started');
  t.is(list[1].source, 'yyy.avi');
  t.is(list[1].queuedTime.getTime(), 1000);
  t.is(list[1].error, null);
  t.is(list[1].progress, 50);
  t.is(list[2].status, 'completed');
  t.is(list[2].source, 'xxx.avi');
  t.is(list[2].queuedTime.getTime(), 0);
  t.is(list[2].error, null);
  t.is(list[2].progress, 100);
  t.is(list[2].destination, 'xxx.mp4');
  t.is(list[2].endTime.getTime(), 1000);
  t.is(list[2].fileSize, 1000);

  // 4th iteration
  iterate('/path/to');
  list = get(3);
  t.is(list.length, 3);
  t.is(list[0].status, 'started');
  t.is(list[0].source, 'zzz.avi');
  t.is(list[0].queuedTime.getTime(), 2000);
  t.is(list[0].error, null);
  t.is(list[0].progress, 50);
  t.is(list[1].status, 'completed');
  t.is(list[1].source, 'yyy.avi');
  t.is(list[1].queuedTime.getTime(), 1000);
  t.is(list[1].error, null);
  t.is(list[1].progress, 100);
  t.is(list[1].destination, 'yyy.mp4');
  t.is(list[1].endTime.getTime(), 2000);
  t.is(list[1].fileSize, 2000);
  t.is(list[2].status, 'completed');
  t.is(list[2].source, 'xxx.avi');
  t.is(list[2].queuedTime.getTime(), 0);
  t.is(list[2].error, null);
  t.is(list[2].progress, 100);
  t.is(list[2].destination, 'xxx.mp4');
  t.is(list[2].endTime.getTime(), 1000);
  t.is(list[2].fileSize, 1000);

  // 5th iteration
  iterate('/path/to');
  list = get(3);
  t.is(list.length, 3);
  t.is(list[0].status, 'failed');
  t.is(list[0].source, 'zzz.avi');
  t.is(list[0].queuedTime.getTime(), 2000);
  t.not(list[0].error, null);
  t.is(list[1].status, 'completed');
  t.is(list[1].source, 'yyy.avi');
  t.is(list[1].queuedTime.getTime(), 1000);
  t.is(list[1].error, null);
  t.is(list[1].progress, 100);
  t.is(list[1].destination, 'yyy.mp4');
  t.is(list[1].endTime.getTime(), 2000);
  t.is(list[1].fileSize, 2000);
  t.is(list[2].status, 'completed');
  t.is(list[2].source, 'xxx.avi');
  t.is(list[2].queuedTime.getTime(), 0);
  t.is(list[2].error, null);
  t.is(list[2].progress, 100);
  t.is(list[2].destination, 'xxx.mp4');
  t.is(list[2].endTime.getTime(), 1000);
  t.is(list[2].fileSize, 1000);
});
