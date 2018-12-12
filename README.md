# procoder-watcher

# Install

```
$ git clone https://github.com/kuu/poc-procoder-watcher.git
$ cd procoder-watcher
$ npm install
```

# Configure

```
$ mkdir config
$ vi config/default.json
{
  "path": {
    "ediusOutputFolder": "/path/to/EDIUS Output Folder",
    "procoderLogsFolder": "/path/to/ProCoder Logs Folder",
    "publishInputFolder": "/path/to/Publish Input Folder"
  }
}
```

# Run / Stop

```
$ npm start
$ npm stop
```

# Enable logs

```
$ export DEBUG=procoder-watcher
$ npm start
$ tail -f error.log
```
