/**
 * Copyright reelyActive 2024
 * We believe in an open Internet of Things
 */


const opcua = require('node-opcua');


const DEFAULT_PORT = 4840;
const DEFAULT_PRINT_ERRORS = false;
const DYNAMB_PROCESSORS = new Map([
    [ "temperature", { update: updateTemperature } ],
    [ "accelerationTimeSeries", { update: updateAccelerationTimeSeries } ]
]);
const ACCELERATION_TIME_SERIES_BROWSE_NAMES = [ "AccelerationTimeSeriesX",
                                                "AccelerationTimeSeriesY",
                                                "AccelerationTimeSeriesZ" ];


/**
 * BarnaclesOPCUA Class
 * Implements a OPC-UA server.
 */
class BarnaclesOPCUA {

  /**
   * BarnaclesOPCUA constructor
   * @param {Object} options The options as a JSON object.
   * @constructor
   */
  constructor(options) {
    let self = this;
    options = options || {};

    this.printErrors = options.printErrors || DEFAULT_PRINT_ERRORS;

    this.devices = new Map();

    this.server = new opcua.OPCUAServer({
      port: options.port || DEFAULT_PORT,
      resourcePath: "/UA/ParetoAnywhere",
      securityPolicies: [ opcua.SecurityPolicy.None ]
    });

    this.server.initialize(() => {
      self.namespace = self.server.engine.addressSpace.getOwnNamespace();
      self.server.start(() => {
        console.log("barnacles-opcua OPC-UA server running");
      });
    });
  }

  /**
   * Handle an outbound event.
   * @param {String} name The event name.
   * @param {Object} data The outbound event data.
   */
  handleEvent(name, data) {
    let self = this;

    if(name === 'dynamb') {
      return handleDynamb(self, data);
    }
  }

}


/**
 * Handle the given dynamb by serving it over OPC-UA.
 * @param {BarnaclesOPCUA} instance The BarnaclesOPCUA instance.
 * @param {Object} dynamb The dynamb data.
 */
function handleDynamb(instance, dynamb) {
  if(!isSupportedPropertyPresent(dynamb)) {
    return;
  }

  let deviceSignature = dynamb.deviceId + '/' + dynamb.deviceIdType;
  let device = instance.devices.get(deviceSignature);

  // New device, create its OPC-UA object
  if(!instance.devices.has(deviceSignature)) {
    let object = instance.namespace.addObject({
      organizedBy: instance.server.engine.addressSpace.rootFolder.objects,
      browseName: deviceSignature
    });
    device = { instance: object, nodes: {} };
    instance.devices.set(deviceSignature, device);
  }

  // Update all supported dynamb properties
  for(const property in dynamb) {
    if(DYNAMB_PROCESSORS.has(property)) {
      DYNAMB_PROCESSORS.get(property).update(dynamb, device, instance.namespace);
    }
  }
}


/**
 * Determine if the given dynamb includes a property supported over OPC-UA.
 * @param {Object} dynamb The dynamb data.
 */
function isSupportedPropertyPresent(dynamb) {
  for(const property in dynamb) {
    if(DYNAMB_PROCESSORS.has(property)) {
      return true;
    }
  }

  return false;
}


/**
 * Add a temperature variable to the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Device} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function addTemperature(dynamb, device, namespace) {
  return namespace.addAnalogDataItem({
    componentOf: device.instance,
    browseName: "Temperature",
    engineeringUnits: opcua.standardUnits.degree_celsius,
    engineeringUnitsRange: { low: -40, high: 125 },
    minimumSamplingInterval: 1000,
    dataType: "Double"
  });
}


/**
 * Update the temperature variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateTemperature(dynamb, device, namespace) {
  let data = { value: dynamb.temperature, dataType: opcua.DataType.Double };

  if(!device.nodes.hasOwnProperty('temperature')) {
    device.nodes.temperature = addTemperature(dynamb, device, namespace);
  }

  device.nodes.temperature.setValueFromSource(data, opcua.StatusCodes.Good,
                                              new Date(dynamb.timestamp));
}


/**
 * Add an acceleration time series variable to the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Device} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function addAccelerationTimeSeries(dynamb, device, namespace) {
  let nodes = [];
  // TODO: Use dynamb.accelerationSamplingRate
  dynamb.accelerationTimeSeries.forEach((axisTimeSeries, index) => {
    nodes.push(namespace.addYArrayItem({
      componentOf: device.instance,
      browseName: ACCELERATION_TIME_SERIES_BROWSE_NAMES[index],
      engineeringUnits: opcua.standardUnits.metre_per_second_squared,
      engineeringUnitsRange: { low: -64, high: 64 },
      axisScaleType: "Linear",
      xAxisDefinition: {
        engineeringUnits: opcua.standardUnits.microsecond,
        euRange: { low: 0, high: 2520 }, // TODO
        axisScaleType: opcua.EnumAxisScale.Linear
      },
      dataType: opcua.DataType.Double
    }));
  });

  return nodes;
}


/**
 * Update the acceleration time series variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateAccelerationTimeSeries(dynamb, device, namespace) {
  let numberOfAxes = dynamb.accelerationTimeSeries.length;

  // TODO: better handle case where numberOfAxes changes?
  if(!Array.isArray(device.nodes.accelerationTimeSeries) ||
     (device.nodes.accelerationTimeSeries.length !== numberOfAxes)) {
    device.nodes.accelerationTimeSeries =
                          addAccelerationTimeSeries(dynamb, device, namespace);
  }

  device.nodes.accelerationTimeSeries.forEach((node, axisIndex) => {
    let data = {
        value: new Float64Array(dynamb.accelerationTimeSeries[axisIndex]),
        dataType: opcua.DataType.Double,
        arrayType: opcua.VariantArrayType.Array
    };
    node.setValueFromSource(data, opcua.StatusCodes.Good,
                            new Date(dynamb.timestamp));
  });
}


module.exports = BarnaclesOPCUA;
