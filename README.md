barnacles-opcua
===============

OPC-UA interface for barnacles.


Quick Start
-----------

Clone this repository and install dependencies with `npm install`.  Start the OPC-UA server with `npm start` and connect an OPC-UA client on port 4840 and resource path /UA/ParetoAnywhere.


Simulated Data
--------------

The following simulated devices/sensors are supported for interface testing.

### Sensor-Works BluVib

Start __barnacles-opcua__ with the command `npm run sensorworks-bluvib` to simulate a [Sensor-Works BluVib](https://www.sensor-works.com/products/) industrial vibration sensor with `browseName = "5e4504b1071b/3"`, exposing the following variables:

| browseName     | dataType       |
|:---------------|:---------------|
| Temperature    | AnalogDataItem |
| accelerationsX | YArrayItem     |
| accelerationsY | YArrayItem     |
| accelerationsZ | YArrayItem     |


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