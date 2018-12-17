# procoder-watcher

# Install

```
$ git clone https://github.com/kuu/poc-procoder-watcher.git
$ cd poc-procoder-watcher
$ npm install
```

# Configure

```
$ mkdir config
$ vi config/default.json
{
  "path": {
    "ediusOutputFolder": "Path to Edius output folder",
    "procoderInputFolder": "Path to ProCoder input folder",
    "procoderLogsFolder": "Path to Procoder log output folder",
    "publishInputFolder": "Path to Publish input folder"
  },
  "auth": {
    "user": "Flex user",
    "pass": "Passwrod for the user"
  },
  "api": {
    "baseUri": "Flex base path e.g. https://xxx.com/api",
    "workspace": {Workspace id in integer},
    "metadataDefinition": {Metadata Definition id in integer},
    "notifyWorkflow": {Import workflow id in integer},
    "importWorkflow": {Publish workflow id in integer}
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
