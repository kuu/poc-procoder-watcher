const fs = require('fs');
const path = require('path');
const proxyquire = require('proxyquire');
const test = require('ava');

const util = require('../../../libs/util');

util.SEP = '\\';
const {parse} = proxyquire('../../../libs/job', {'./util': util});

const FILE_NAME = '{0E76DB90-843C-43ED-8309-98325F52FBA2}.pws';
let data;

test.before.cb(t => {
  fs.readFile(path.join(__dirname, '../../fixtures/', FILE_NAME), 'utf8', (err, str) => {
    if (err) {
      return t.fail();
    }
    data = str;
    t.end();
  });
});

test('job:parse:invalid', t => {
  const job = parse('xxx', '');
  t.is(job, null);
});

test('job:parse:invalidType', t => {
  const job = parse('xxx', data.replace('TRANSCODINGJOB', 'xxx'));
  t.is(job, null);
});

test('job:parse:failed', t => {
  const job = parse('xxx', data.replace('<Errors/>', '<Errors><dummy /></Errors>'));
  t.is(job.status, 'failed');
  t.not(job.error, null);
});

test('job:parse:started', t => {
  const job = parse('xxx', data.replace('"100"', '"99"'));
  t.is(job.status, 'started');
  t.is(job.progress, 99);
  t.is(job.source, 'cn_gumball_021B.avi');
  t.is(job.queuedTime.getTime(), (new Date('04/17/18 21:14:22')).getTime());
});

test('job:parse:completed', t => {
  const job = parse('xxx', data);
  t.is(job.type, 'TRANSCODINGJOB');
  t.is(job.status, 'completed');
  t.is(job.error, null);
  t.is(job.progress, 100);
  t.is(job.destination, 'D:\\COV\\turner\\cn_gumball_021B.mp4');
  t.is(job.fileSize, 596487805);
});
