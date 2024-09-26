barnacles-opcua
===============

__barnacles-opcua__ is an OPC UA server of IoT data from ambient wireless sensors.  [reelyActive](https://www.reelyactive.com) is an [OPC UA logo member](https://opcfoundation.org/members/view/7804).

![Overview of barnacles-opcua](https://reelyactive.github.io/barnacles-opcua/images/overview.png)

__barnacles-opcua__ ingests a real-time stream of _dynamb_ objects from [barnacles](https://github.com/reelyactive/barnacles/), converting their properties into standard OPC UA format.  It couples seamlessly with reelyActive's [Pareto Anywhere](https://www.reelyactive.com/pareto/anywhere/) open source IoT middleware.

__barnacles-opcua__ is a lightweight [Node.js package](https://www.npmjs.com/package/barnacles-opcua) that can run on resource-constrained edge devices as well as on powerful cloud servers and anything in between.


Pareto Anywhere integration
---------------------------

A common application of __barnacles-opcua__ is to publish IoT data from [pareto-anywhere](https://github.com/reelyactive/pareto-anywhere) via an OPC UA server.  Simply follow our [Create a Pareto Anywhere startup script](https://reelyactive.github.io/diy/pareto-anywhere-startup-script/) tutorial using the script below:

```javascript
#!/usr/bin/env node

const ParetoAnywhere = require('../lib/paretoanywhere.js');

// Edit the options to customise the server
const BARNACLES_OPCUA_OPTIONS = {};

// ----- Exit gracefully if the optional dependency is not found -----
let BarnaclesOPCUA;
try {
  BarnaclesOPCUA = require('barnacles-opcua');
}
catch(err) {
  console.log('This script requires barnacles-opcua.  Install with:');
  console.log('\r\n    "npm install barnacles-opcua"\r\n');
  return console.log('and then run this script again.');
}
// -------------------------------------------------------------------

let pa = new ParetoAnywhere();
pa.barnacles.addInterface(BarnaclesOPCUA, BARNACLES_OPCUA_OPTIONS);
```

Supported Properties
--------------------

__barnacles-opcua__ currently supports the following properties:

| OPC UA browseName       | OPC UA dataType | dynamb property        |
|:------------------------|:----------------|:-----------------------|
| Temperature             | AnalogDataItem  | temperature            |
| AccelerationTimeSeriesX | YArrayItem      | accelerationTimeSeries |
| AccelerationTimeSeriesY | YArrayItem      | accelerationTimeSeries |
| AccelerationTimeSeriesZ | YArrayItem      | accelerationTimeSeries |

Additional [dynamb properties](https://reelyactive.github.io/diy/cheatsheet/#dynamb) will be added in future.


Quick Start
-----------

Clone this repository, then from its root folder, install dependencies with `npm install`.  Start the OPC-UA server with the following command:

    npm start

and connect an OPC-UA client (see examples below) on port __4840__ and resource path __/UA/ParetoAnywhere__.  Note that no device data will be available without a source of [dynamb](https://reelyactive.github.io/diy/cheatsheet/#dynamb) data, for example from [Pareto Anywhere](https://www.reelyactive.com/pareto/anywhere/) open source IoT middleware.

To validate _secure_ communication, simply provide a certificate and private key as [config files](#config-files).


Simulated Data
--------------

The following simulated devices/sensors are supported for interface testing.

### Sensor-Works BluVib

To simulate a [Sensor-Works BluVib](https://www.sensor-works.com/products/) industrial vibration sensor, start __barnacles-opcua__ with the following command:

    npm run sensorworks-bluvib

Simulated sensor `browseName = "5e4504b1071b/3"` will expose the following variables:

| OPC UA browseName       | OPC UA dataType |
|:------------------------|:----------------|
| Temperature             | AnalogDataItem  |
| AccelerationTimeSeriesX | YArrayItem      |
| AccelerationTimeSeriesY | YArrayItem      |
| AccelerationTimeSeriesZ | YArrayItem      |


Observing Data with opcua-commander
-----------------------------------

The [opcua-commander](https://github.com/node-opcua/opcua-commander) CLI, based on the same [node-opcua](https://github.com/node-opcua/node-opcua) open source package used by __barnacles-opcua__, provides a simple means of browsing and monitoring the OPC-UA data.

After installing [opcua-commander](https://github.com/node-opcua/opcua-commander), open a terminal and browse to the __barnacles-opcua__ server with the following command:

    opcua-commander -e opc.tcp://localhost:4840

Use the arrow keys and the t / l / i / c / u / s / a keys to navigate through the CLI interface, and use the x key to close.


Observing Data with UaExpert
----------------------------

Unified Automation offers [UaExpert](https://www.unified-automation.com/products/development-tools/uaexpert.html), a full-featured Windows/Linux OPC UA client, for [free download](https://www.unified-automation.com/downloads/opc-ua-clients.html), with registration.


Config Files
------------

The __/config__ folder accepts the following run-time configuration files:
- __certificate.pem__ (security certificate)
- __key.pem__ (private key)

Alternatively, these can be specified in the [Options](#Options).


Options
-------

__barnacles-opcua__ supports the following options:

| Property        | Default                    | Description                   | 
|:----------------|:---------------------------|:------------------------------|
| port            | 4840                       | OPC UA Server port            |
| certificateFile | config/certificate.pem     | Path to optional certificate  |
| privateKeyFile  | config/key.pem             | Path to optional key          |


Acknowledgements
----------------

__barnacles-opcua__ is based on the [Node-OPCUA](https://node-opcua.github.io/) open source project, maintained by [Sterfive](https://www.sterfive.com), which we invite you to consider sponsoring at [opencollective.com/node-opcua](https://opencollective.com/node-opcua).


Contributing
------------

Discover [how to contribute](CONTRIBUTING.md) to this open source project which upholds a standard [code of conduct](CODE_OF_CONDUCT.md).


Security
--------

Consult our [security policy](SECURITY.md) for best practices using this open source software and to report vulnerabilities.


License
-------

MIT License

Copyright (c) 2024 [reelyActive](https://www.reelyactive.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN 
THE SOFTWARE.