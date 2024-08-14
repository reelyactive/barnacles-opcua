barnacles-opcua
===============

__barnacles-opcua__ is an OPC UA server of data from ambient wireless sensors.

![Overview of barnacles-opcua](https://reelyactive.github.io/barnacles-opcua/images/overview.png)

__barnacles-opcua__ ingests a real-time stream of _dynamb_ objects from [barnacles](https://github.com/reelyactive/barnacles/), converting their properties into standard OPC UA format.  [reelyActive](https://www.reelyactive.com) is an [OPC UA logo member](https://opcfoundation.org/members/view/7804).

__barnacles-opcua__ is a lightweight [Node.js package](https://www.npmjs.com/package/barnacles-opcua) that can run on resource-constrained edge devices as well as on powerful cloud servers and anything in between.


Quick Start
-----------

Clone this repository and install dependencies with `npm install`.  Start the OPC-UA server with `npm start` and connect an OPC-UA client on port 4840 and resource path /UA/ParetoAnywhere.


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


Simulated Data
--------------

The following simulated devices/sensors are supported for interface testing.

### Sensor-Works BluVib

Start __barnacles-opcua__ with the command `npm run sensorworks-bluvib` to simulate a [Sensor-Works BluVib](https://www.sensor-works.com/products/) industrial vibration sensor with `browseName = "5e4504b1071b/3"`, exposing the following variables:

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