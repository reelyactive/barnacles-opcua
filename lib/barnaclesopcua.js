/**
 * Copyright reelyActive 2024-2026
 * We believe in an open Internet of Things
 */


const fs = require('fs');
const path = require('path');
const opcua = require('node-opcua');


const DEFAULT_PORT = 4840;
const DEFAULT_PRINT_ERRORS = false;
const CONFIG_PATH = 'config';
const DEVICES_NODEID = 'devices';
const DYNAMB_PROCESSORS = new Map([
    [ "accelerationTimeSeries", { update: updateAccelerationTimeSeries } ],
    [ "batteryPercentage", { update: updateBatteryPercentage } ],
    [ "batteryVoltage", { update: updateBatteryVoltage } ],
    [ "carbonDioxideConcentration",
      { update: updateCarbonDioxideConcentration } ],
    [ "illuminance", { update: updateIlluminance } ],
    [ "isButtonPressed", { update: updateIsButtonPressed } ],
    [ "isButtonPressedCycle", { update: updateIsButtonPressedCycle } ],
    [ "isContactDetected", { update: updateIsContactDetected } ],
    [ "isContactDetectedCycle", { update: updateIsContactDetectedCycle } ],
    [ "isInputDetected", { update: updateIsInputDetected } ],
    [ "isInputDetectedCycle", { update: updateIsInputDetectedCycle } ],
    [ "isLightDetected", { update: updateIsLightDetected } ],
    [ "isLightDetectedCycle", { update: updateIsLightDetectedCycle } ],
    [ "isLiquidDetected", { update: updateIsLiquidDetected } ],
    [ "isLiquidDetectedCycle", { update: updateIsLiquidDetectedCycle } ],
    [ "isMotionDetected", { update: updateIsMotionDetected } ],
    [ "isMotionDetectedCycle", { update: updateIsMotionDetectedCycle } ],
    [ "isOccupancyDetected", { update: updateIsOccupancyDetected } ],
    [ "isOccupancyDetectedCycle", { update: updateIsOccupancyDetectedCycle } ],
    [ "isTamperDetected", { update: updateIsTamperDetected } ],
    [ "isTamperDetectedCycle", { update: updateIsTamperDetectedCycle } ],
    [ "levelPercentage", { update: updateLevelPercentage } ],
    [ "luminousFlux", { update: updateLuminousFlux } ],
    [ "pm1.0", { update: updatePM1p0 } ],
    [ "pm2.5", { update: updatePM2p5 } ],
    [ "pm10", { update: updatePM10 } ],
    [ "pressure", { update: updatePressure } ],
    [ "relativeHumidity", { update: updateRelativeHumidity } ],
    [ "soundPressure", { update: updateSoundPressure } ],
    [ "temperature", { update: updateTemperature } ],
    [ "velocityOverall", { update: updateVelocityOverall } ],
    [ "volatileOrganicCompoundsConcentration",
      { update: updateVolatileOrganicCompoundsConcentration } ]
]);
const ACCELERATION_TIME_SERIES_BROWSE_NAMES = [ "AccelerationTimeSeriesX",
                                                "AccelerationTimeSeriesY",
                                                "AccelerationTimeSeriesZ" ];
const VELOCITY_OVERALL_BROWSE_NAMES = [ "VelocityOverallX", "VelocityOverallY",
                                        "VelocityOverallZ" ];


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

    this.server = createServer(options);
    this.server.initialize(() => {
      self.namespace = self.server.engine.addressSpace.getOwnNamespace();
	    self.devicesFolder = self.namespace.addFolder(
	                          self.server.engine.addressSpace.rootFolder.objects,
	                          { browseName: "Devices",
                              nodeId: generateNodeId(self.namespace, null,
                                                     DEVICES_NODEID) });
      self.server.start(() => { });
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
 * Create the OPC UA server with the given options.
 * https://node-opcua.github.io/api_doc/2.132.0/classes/node_opcua_server.OPCUAServer.html
 * @param {Object} options The configuration options.
 */
function createServer(options) {
  let serverOptions = {
    port: options.port || DEFAULT_PORT,
    resourcePath: "/UA/ParetoAnywhere",
    buildInfo: { productName: "barnacles-opcua",
                 manufacturerName: "reelyActive" },
    securityPolicies: [ opcua.SecurityPolicy.None,
                        opcua.SecurityPolicy.Basic256Sha256 ]
  };

  let certificateFile = options.certificateFile || 
                        path.resolve(CONFIG_PATH  + '/certificate.pem');
  let privateKeyFile = options.privateKeyFile || 
                       path.resolve(CONFIG_PATH  + '/key.pem');

  // Specify the certificate and private key only if the files exist
  try {
    fs.accessSync(certificateFile, fs.constants.R_OK);
    fs.accessSync(privateKeyFile, fs.constants.R_OK);
    serverOptions.certificateFile = certificateFile;
    serverOptions.privateKeyFile = privateKeyFile;
  }
  catch(err) {
    console.log('barnacles-opcua: security certificate/key not provided');
  }

  return new opcua.OPCUAServer(serverOptions);
}


/**
 * Generate a NodeId from the device signature and/or name.
 * @param {Object} namespace The namespace object.
 * @param {String} deviceSignature The optional device signature.
 * @param {String} name The optional name.
 */
function generateNodeId(namespace, deviceSignature, name) {
  let nodeId = 'ns=' + namespace.index + ';s=';

  if(deviceSignature) {
    nodeId += DEVICES_NODEID + '/' + deviceSignature;
    if(name) { nodeId += '/' + name; }
  }
  else { nodeId += name || ''; }

  return nodeId;
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
      organizedBy: instance.devicesFolder,
      browseName: deviceSignature,
      nodeId: generateNodeId(instance.namespace, deviceSignature)
    });
    device = { instance: object, nodes: {}, signature: deviceSignature };
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
 * Update the batteryPercentage variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateBatteryPercentage(dynamb, device, namespace) {
  let data = { value: dynamb.batteryPercentage,
               dataType: opcua.DataType.Double };
  let browseName = 'BatteryPercentage';

  if(!device.nodes.hasOwnProperty('batteryPercentage')) {
    device.nodes.batteryPercentage = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: opcua.standardUnits.percent,
      engineeringUnitsRange: { low: 0, high: 100 },
      minimumSamplingInterval: 1000,
      dataType: "Double"
    });
  }

  device.nodes.batteryPercentage.setValueFromSource(data,
                                                    opcua.StatusCodes.Good,
                                                    new Date(dynamb.timestamp));
}


/**
 * Update the batteryVoltage variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateBatteryVoltage(dynamb, device, namespace) {
  let data = { value: dynamb.batteryVoltage, dataType: opcua.DataType.Double };
  let browseName = 'BatteryVoltage';

  if(!device.nodes.hasOwnProperty('batteryVoltage')) {
    device.nodes.batteryVoltage = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: opcua.standardUnits.volt,
      engineeringUnitsRange: { low: 0, high: 1022 }, // From BLE GATT
      minimumSamplingInterval: 1000,
      dataType: "Double"
    });
  }

  device.nodes.batteryVoltage.setValueFromSource(data, opcua.StatusCodes.Good,
                                                 new Date(dynamb.timestamp));
}


/**
 * Update the carbonDioxideConcentration variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateCarbonDioxideConcentration(dynamb, device, namespace) {
  let data = { value: dynamb.carbonDioxideConcentration,
               dataType: opcua.DataType.Double };
  let browseName = 'CarbonDioxideConcentration';

  if(!device.nodes.hasOwnProperty('carbonDioxideConcentration')) {
    device.nodes.carbonDioxideConcentration = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: opcua.standardUnits.part_per_million,
      engineeringUnitsRange: { low: 0, high: 65534 }, // From BLE GATT
      minimumSamplingInterval: 1000,
      dataType: "Double"
    });
  }

  device.nodes.carbonDioxideConcentration.setValueFromSource(data,
                           opcua.StatusCodes.Good, new Date(dynamb.timestamp));
}


/**
 * Update the illuminance variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateIlluminance(dynamb, device, namespace) {
  let data = { value: dynamb.illuminance, dataType: opcua.DataType.Double };
  let browseName = 'Illuminance';

  if(!device.nodes.hasOwnProperty('illuminance')) {
    device.nodes.illuminance = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: { unitId: 5002584, displayName: { text: "lux" } },
      engineeringUnitsRange: { low: 0, high: 167772.14 }, // From BLE GATT
      minimumSamplingInterval: 1000,
      dataType: "Double"
    });
  }

  device.nodes.illuminance.setValueFromSource(data, opcua.StatusCodes.Good,
                                              new Date(dynamb.timestamp));
}


/**
 * Update the isButtonPressed variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateIsButtonPressed(dynamb, device, namespace) {
  let value = dynamb.isButtonPressed.some(value => (value === true));
  let data = { value: value, dataType: opcua.DataType.Boolean };
  let browseName = 'IsButtonPressed';

  if(!device.nodes.hasOwnProperty('isButtonPressed')) {
    device.nodes.isButtonPressed = namespace.addTwoStateDiscrete({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      minimumSamplingInterval: 0,
      dataType: "Boolean",
      trueState: "PRESSED",
      falseState: "RELEASED"
    });
  }

  device.nodes.isButtonPressed.setValueFromSource(data, opcua.StatusCodes.Good,
                                                  new Date(dynamb.timestamp));
}


/**
 * Update the isButtonPressedCycle variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateIsButtonPressedCycle(dynamb, device, namespace) {
  let data = { value: dynamb.isButtonPressedCycle,
               dataType: opcua.DataType.UInt32 };
  let browseName = 'IsButtonPressedCycle';

  if(!device.nodes.hasOwnProperty('isButtonPressedCycle')) {
    device.nodes.isButtonPressedCycle = namespace.addVariable({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: { unitId: 95, displayName: { text: "cycles" } },
      minimumSamplingInterval: 0,
      dataType: "Integer"
    });
  }

  device.nodes.isButtonPressedCycle.setValueFromSource(data,
                           opcua.StatusCodes.Good, new Date(dynamb.timestamp));
}


/**
 * Update the isContactDetected variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateIsContactDetected(dynamb, device, namespace) {
  let value = dynamb.isContactDetected.some(value => (value === true));
  let data = { value: value, dataType: opcua.DataType.Boolean };
  let browseName = 'IsContactDetected';

  if(!device.nodes.hasOwnProperty('isContactDetected')) {
    device.nodes.isContactDetected = namespace.addTwoStateDiscrete({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      minimumSamplingInterval: 0,
      dataType: "Boolean",
      trueState: "DETECTED",
      falseState: "UNDETECTED"
    });
  }

  device.nodes.isContactDetected.setValueFromSource(data,
                           opcua.StatusCodes.Good, new Date(dynamb.timestamp));
}


/**
 * Update the isContactDetectedCycle variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateIsContactDetectedCycle(dynamb, device, namespace) {
  let data = { value: dynamb.isContactDetectedCycle,
               dataType: opcua.DataType.UInt32 };
  let browseName = 'IsContactDetectedCycle';

  if(!device.nodes.hasOwnProperty('isContactDetectedCycle')) {
    device.nodes.isContactDetectedCycle = namespace.addVariable({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: { unitId: 95, displayName: { text: "cycles" } },
      minimumSamplingInterval: 0,
      dataType: "Integer"
    });
  }

  device.nodes.isContactDetectedCycle.setValueFromSource(data,
                           opcua.StatusCodes.Good, new Date(dynamb.timestamp));
}


/**
 * Update the isInputDetected variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateIsInputDetected(dynamb, device, namespace) {
  let value = dynamb.isInputDetected.some(value => (value === true));
  let data = { value: value, dataType: opcua.DataType.Boolean };
  let browseName = 'IsInputDetected';

  if(!device.nodes.hasOwnProperty('isInputDetected')) {
    device.nodes.isInputDetected = namespace.addTwoStateDiscrete({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      minimumSamplingInterval: 0,
      dataType: "Boolean",
      trueState: "DETECTED",
      falseState: "UNDETECTED"
    });
  }

  device.nodes.isInputDetected.setValueFromSource(data, opcua.StatusCodes.Good,
                                                  new Date(dynamb.timestamp));
}


/**
 * Update the isInputDetectedCycle variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateIsInputDetectedCycle(dynamb, device, namespace) {
  let data = { value: dynamb.isInputDetectedCycle,
               dataType: opcua.DataType.UInt32 };
  let browseName = 'IsInputDetectedCycle';

  if(!device.nodes.hasOwnProperty('isInputDetectedCycle')) {
    device.nodes.isInputDetectedCycle = namespace.addVariable({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: { unitId: 95, displayName: { text: "cycles" } },
      minimumSamplingInterval: 0,
      dataType: "Integer"
    });
  }

  device.nodes.isInputDetectedCycle.setValueFromSource(data,
                           opcua.StatusCodes.Good, new Date(dynamb.timestamp));
}


/**
 * Update the isLightDetected variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateIsLightDetected(dynamb, device, namespace) {
  let value = dynamb.isLightDetected.some(value => (value === true));
  let data = { value: value, dataType: opcua.DataType.Boolean };
  let browseName = 'IsLightDetected';

  if(!device.nodes.hasOwnProperty('isLightDetected')) {
    device.nodes.isLightDetected = namespace.addTwoStateDiscrete({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      minimumSamplingInterval: 0,
      dataType: "Boolean",
      trueState: "DETECTED",
      falseState: "UNDETECTED"
    });
  }

  device.nodes.isLightDetected.setValueFromSource(data, opcua.StatusCodes.Good,
                                                  new Date(dynamb.timestamp));
}


/**
 * Update the isLightDetectedCycle variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateIsLightDetectedCycle(dynamb, device, namespace) {
  let data = { value: dynamb.isLightDetectedCycle,
               dataType: opcua.DataType.UInt32 };
  let browseName = 'IsLightDetectedCycle';

  if(!device.nodes.hasOwnProperty('isLightDetectedCycle')) {
    device.nodes.isLightDetectedCycle = namespace.addVariable({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: { unitId: 95, displayName: { text: "cycles" } },
      minimumSamplingInterval: 0,
      dataType: "Integer"
    });
  }

  device.nodes.isLightDetectedCycle.setValueFromSource(data,
                           opcua.StatusCodes.Good, new Date(dynamb.timestamp));
}


/**
 * Update the isLiquidDetected variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateIsLiquidDetected(dynamb, device, namespace) {
  let value = dynamb.isLiquidDetected.some(value => (value === true));
  let data = { value: value, dataType: opcua.DataType.Boolean };
  let browseName = 'IsLiquidDetected';

  if(!device.nodes.hasOwnProperty('isLiquidDetected')) {
    device.nodes.isLiquidDetected = namespace.addTwoStateDiscrete({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      minimumSamplingInterval: 0,
      dataType: "Boolean",
      trueState: "DETECTED",
      falseState: "UNDETECTED"
    });
  }

  device.nodes.isLiquidDetected.setValueFromSource(data, opcua.StatusCodes.Good,
                                                   new Date(dynamb.timestamp));
}


/**
 * Update the isLiquidDetectedCycle variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateIsLiquidDetectedCycle(dynamb, device, namespace) {
  let data = { value: dynamb.isLiquidDetectedCycle,
               dataType: opcua.DataType.UInt32 };
  let browseName = 'IsLiquidDetectedCycle';

  if(!device.nodes.hasOwnProperty('isLiquidDetectedCycle')) {
    device.nodes.isLiquidDetectedCycle = namespace.addVariable({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: { unitId: 95, displayName: { text: "cycles" } },
      minimumSamplingInterval: 0,
      dataType: "Integer"
    });
  }

  device.nodes.isLiquidDetectedCycle.setValueFromSource(data,
                           opcua.StatusCodes.Good, new Date(dynamb.timestamp));
}


/**
 * Update the isMotionDetected variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateIsMotionDetected(dynamb, device, namespace) {
  let value = dynamb.isMotionDetected.some(value => (value === true));
  let data = { value: value, dataType: opcua.DataType.Boolean };
  let browseName = 'IsMotionDetected';

  if(!device.nodes.hasOwnProperty('isMotionDetected')) {
    device.nodes.isMotionDetected = namespace.addTwoStateDiscrete({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      minimumSamplingInterval: 0,
      dataType: "Boolean",
      trueState: "DETECTED",
      falseState: "UNDETECTED"
    });
  }

  device.nodes.isMotionDetected.setValueFromSource(data, opcua.StatusCodes.Good,
                                                   new Date(dynamb.timestamp));
}


/**
 * Update the isMotionDetectedCycle variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateIsMotionDetectedCycle(dynamb, device, namespace) {
  let data = { value: dynamb.isMotionDetectedCycle,
               dataType: opcua.DataType.UInt32 };
  let browseName = 'IsMotionDetectedCycle';

  if(!device.nodes.hasOwnProperty('isMotionDetectedCycle')) {
    device.nodes.isMotionDetectedCycle = namespace.addVariable({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: { unitId: 95, displayName: { text: "cycles" } },
      minimumSamplingInterval: 0,
      dataType: "Integer"
    });
  }

  device.nodes.isMotionDetectedCycle.setValueFromSource(data,
                           opcua.StatusCodes.Good, new Date(dynamb.timestamp));
}


/**
 * Update the isOccupancyDetected variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateIsOccupancyDetected(dynamb, device, namespace) {
  let value = dynamb.isOccupancyDetected.some(value => (value === true));
  let data = { value: value, dataType: opcua.DataType.Boolean };
  let browseName = 'IsOccupancyDetected';

  if(!device.nodes.hasOwnProperty('isOccupancyDetected')) {
    device.nodes.isOccupancyDetected = namespace.addTwoStateDiscrete({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      minimumSamplingInterval: 0,
      dataType: "Boolean",
      trueState: "DETECTED",
      falseState: "UNDETECTED"
    });
  }

  device.nodes.isOccupancyDetected.setValueFromSource(data,
                           opcua.StatusCodes.Good, new Date(dynamb.timestamp));
}


/**
 * Update the isOccupancyDetectedCycle variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateIsOccupancyDetectedCycle(dynamb, device, namespace) {
  let data = { value: dynamb.isOccupancyDetectedCycle,
               dataType: opcua.DataType.UInt32 };
  let browseName = 'IsOccupancyDetectedCycle';

  if(!device.nodes.hasOwnProperty('isOccupancyDetectedCycle')) {
    device.nodes.isOccupancyDetectedCycle = namespace.addVariable({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: { unitId: 95, displayName: { text: "cycles" } },
      minimumSamplingInterval: 0,
      dataType: "Integer"
    });
  }

  device.nodes.isOccupancyDetectedCycle.setValueFromSource(data,
                           opcua.StatusCodes.Good, new Date(dynamb.timestamp));
}


/**
 * Update the isTamperDetected variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateIsTamperDetected(dynamb, device, namespace) {
  let value = dynamb.isTamperDetected.some(value => (value === true));
  let data = { value: value, dataType: opcua.DataType.Boolean };
  let browseName = 'IsTamperDetected';

  if(!device.nodes.hasOwnProperty('isTamperDetected')) {
    device.nodes.isTamperDetected = namespace.addTwoStateDiscrete({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      minimumSamplingInterval: 0,
      dataType: "Boolean",
      trueState: "DETECTED",
      falseState: "UNDETECTED"
    });
  }

  device.nodes.isTamperDetected.setValueFromSource(data, opcua.StatusCodes.Good,
                                                   new Date(dynamb.timestamp));
}


/**
 * Update the isTamperDetectedCycle variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateIsTamperDetectedCycle(dynamb, device, namespace) {
  let data = { value: dynamb.isTamperDetectedCycle,
               dataType: opcua.DataType.UInt32 };
  let browseName = 'IsTamperDetectedCycle';

  if(!device.nodes.hasOwnProperty('isTamperDetectedCycle')) {
    device.nodes.isTamperDetectedCycle = namespace.addVariable({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: { unitId: 95, displayName: { text: "cycles" } },
      minimumSamplingInterval: 0,
      dataType: "Integer"
    });
  }

  device.nodes.isTamperDetectedCycle.setValueFromSource(data,
                           opcua.StatusCodes.Good, new Date(dynamb.timestamp));
}


/**
 * Update the levelPercentage variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateLevelPercentage(dynamb, device, namespace) {
  let data = { value: dynamb.levelPercentage, dataType: opcua.DataType.Double };
  let browseName = 'LevelPercentage';

  if(!device.nodes.hasOwnProperty('levelPercentage')) {
    device.nodes.levelPercentage = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: opcua.standardUnits.percent,
      engineeringUnitsRange: { low: 0, high: 100 },
      minimumSamplingInterval: 1000,
      dataType: "Double"
    });
  }

  device.nodes.levelPercentage.setValueFromSource(data, opcua.StatusCodes.Good,
                                                  new Date(dynamb.timestamp));
}


/**
 * Update the luminousFlux variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateLuminousFlux(dynamb, device, namespace) {
  let data = { value: dynamb.luminousFlux, dataType: opcua.DataType.Double };
  let browseName = 'LuminousFlux';

  if(!device.nodes.hasOwnProperty('luminousFlux')) {
    device.nodes.luminousFlux = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: { unitId: 5002573, displayName: { text: "lm" } },
      engineeringUnitsRange: { low: 0, high: 65534 }, // From BLE GATT
      minimumSamplingInterval: 1000,
      dataType: "Double"
    });
  }

  device.nodes.luminousFlux.setValueFromSource(data, opcua.StatusCodes.Good,
                                               new Date(dynamb.timestamp));
}


/**
 * Update the pm1.0 variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updatePM1p0(dynamb, device, namespace) {
  let data = { value: dynamb['pm1.0'], dataType: opcua.DataType.Double };
  let browseName = 'PM1.0';

  if(!device.nodes.hasOwnProperty('pm1.0')) {
    device.nodes['pm1.0'] = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: { unitId: 18257, displayName: { text: "µg/m³" } },
      engineeringUnitsRange: { low: 0, high: 1000 },
      minimumSamplingInterval: 1000,
      dataType: "Double"
    });
  }

  device.nodes['pm1.0'].setValueFromSource(data, opcua.StatusCodes.Good,
                                           new Date(dynamb.timestamp));
}


/**
 * Update the pm2.5 variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updatePM2p5(dynamb, device, namespace) {
  let data = { value: dynamb['pm2.5'], dataType: opcua.DataType.Double };
  let browseName = 'PM2.5';

  if(!device.nodes.hasOwnProperty('pm2.5')) {
    device.nodes['pm2.5'] = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: { unitId: 18257, displayName: { text: "µg/m³" } },
      engineeringUnitsRange: { low: 0, high: 1000 },
      minimumSamplingInterval: 1000,
      dataType: "Double"
    });
  }

  device.nodes['pm2.5'].setValueFromSource(data, opcua.StatusCodes.Good,
                                           new Date(dynamb.timestamp));
}


/**
 * Update the pm10 variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updatePM10(dynamb, device, namespace) {
  let data = { value: dynamb['pm10'], dataType: opcua.DataType.Double };
  let browseName = 'PM10';

  if(!device.nodes.hasOwnProperty('pm10')) {
    device.nodes['pm10'] = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: { unitId: 18257, displayName: { text: "µg/m³" } },
      engineeringUnitsRange: { low: 0, high: 1000 },
      minimumSamplingInterval: 1000,
      dataType: "Double"
    });
  }

  device.nodes['pm10'].setValueFromSource(data, opcua.StatusCodes.Good,
                                           new Date(dynamb.timestamp));
}


/**
 * Update the pressure variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updatePressure(dynamb, device, namespace) {
  let data = { value: dynamb.pressure, dataType: opcua.DataType.Double };
  let browseName = 'Pressure';

  if(!device.nodes.hasOwnProperty('pressure')) {
    device.nodes.pressure = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: opcua.standardUnits.pascal,
      engineeringUnitsRange: { low: 0, high: 429496729.6 }, // From BLE GATT
      minimumSamplingInterval: 1000,
      dataType: "Double"
    });
  }

  device.nodes.pressure.setValueFromSource(data, opcua.StatusCodes.Good,
                                           new Date(dynamb.timestamp));
}


/**
 * Update the soundPressure variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateSoundPressure(dynamb, device, namespace) {
  let data = { value: dynamb.soundPressure, dataType: opcua.DataType.Double };
  let browseName = 'SoundPressure';

  if(!device.nodes.hasOwnProperty('soundPressure')) {
    device.nodes.soundPressure = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: { unitId: 12878, displayName: { text: "dB" } },
      engineeringUnitsRange: { low: 0, high: 194 },
      minimumSamplingInterval: 1000,
      dataType: "Double"
    });
  }

  device.nodes.soundPressure.setValueFromSource(data, opcua.StatusCodes.Good,
                                                new Date(dynamb.timestamp));
}


/**
 * Update the relativeHumidity variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateRelativeHumidity(dynamb, device, namespace) {
  let data = { value: dynamb.relativeHumidity,
               dataType: opcua.DataType.Double };
  let browseName = 'RelativeHumidity';

  if(!device.nodes.hasOwnProperty('relativeHumidity')) {
    device.nodes.relativeHumidity = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: opcua.standardUnits.percent,
      engineeringUnitsRange: { low: 0, high: 100 },
      minimumSamplingInterval: 1000,
      dataType: "Double"
    });
  }

  device.nodes.relativeHumidity.setValueFromSource(data, opcua.StatusCodes.Good,
                                                   new Date(dynamb.timestamp));
}


/**
 * Update the temperature variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateTemperature(dynamb, device, namespace) {
  let data = { value: dynamb.temperature, dataType: opcua.DataType.Double };
  let browseName = 'Temperature';

  if(!device.nodes.hasOwnProperty('temperature')) {
    device.nodes.temperature = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: opcua.standardUnits.degree_celsius,
      engineeringUnitsRange: { low: -40, high: 125 },
      minimumSamplingInterval: 1000,
      dataType: "Double"
    });
  }

  device.nodes.temperature.setValueFromSource(data, opcua.StatusCodes.Good,
                                              new Date(dynamb.timestamp));
}


/**
 * Update the volatileOrganicCompoundsConcentration variable of the given
 * device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateVolatileOrganicCompoundsConcentration(dynamb, device,
                                                     namespace) {
  let data = { value: dynamb.volatileOrganicCompoundsConcentration,
               dataType: opcua.DataType.Double };
  let browseName = 'VolatileOrganicCompoundsConcentration';

  if(!device.nodes.hasOwnProperty('volatileOrganicCompoundsConcentration')) {
    device.nodes.volatileOrganicCompoundsConcentration =
                                                  namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: opcua.standardUnits.part_per_million,
      engineeringUnitsRange: { low: 0, high: 65.534 }, // From BLE GATT
      minimumSamplingInterval: 1000,
      dataType: "Double"
    });
  }

  device.nodes.volatileOrganicCompoundsConcentration.setValueFromSource(data,
                           opcua.StatusCodes.Good, new Date(dynamb.timestamp));
}


/**
 * Add an acceleration time series variable to the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Device} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function addAccelerationTimeSeries(dynamb, device, namespace) {
  let nodes = [];

  dynamb.accelerationTimeSeries.forEach((axisTimeSeries, index) => {
    let sampleLengthMicroseconds = 1000000 * (axisTimeSeries.length - 1) /
                                   dynamb.accelerationSamplingRate;
    let browseName = ACCELERATION_TIME_SERIES_BROWSE_NAMES[index];
    nodes.push(namespace.addYArrayItem({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: opcua.standardUnits.metre_per_second_squared,
      engineeringUnitsRange: { low: -64, high: 64 },
      axisScaleType: "Linear",
      valueRank: 1,
      arrayDimensions: [ axisTimeSeries.length ],
      xAxisDefinition: {
        engineeringUnits: opcua.standardUnits.microsecond,
        euRange: { low: 0, high: sampleLengthMicroseconds },
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
  let isValidSamplingRate = Number.isFinite(dynamb.accelerationSamplingRate) &&
                            (dynamb.accelerationSamplingRate > 0);

  // TODO: better handle case where numberOfAxes changes?
  if((!Array.isArray(device.nodes.accelerationTimeSeries) ||
      (device.nodes.accelerationTimeSeries.length !== numberOfAxes)) &&
      isValidSamplingRate) {
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


/**
 * Add a velocity overall variable to the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Device} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function addVelocityOverall(dynamb, device, namespace) {
  let nodes = [];

  dynamb.velocityOverall.forEach((value, index) => {
    let browseName = VELOCITY_OVERALL_BROWSE_NAMES[index];

    nodes.push(namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: browseName,
      nodeId: generateNodeId(namespace, device.signature, browseName),
      engineeringUnits: opcua.standardUnits.metre_per_second,
      engineeringUnitsRange: { low: -1, high: 1 },
      minimumSamplingInterval: 1000,
      dataType: "Double"
    }));
  });

  return nodes;
}


/**
 * Update the velocity overall variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateVelocityOverall(dynamb, device, namespace) {
  let numberOfAxes = dynamb.velocityOverall.length;

  // TODO: better handle case where numberOfAxes changes?
  if(!Array.isArray(device.nodes.velocityOverall) ||
     (device.nodes.velocityOverall.length !== numberOfAxes)) {
    device.nodes.velocityOverall = addVelocityOverall(dynamb, device,
                                                      namespace);
  }

  device.nodes.velocityOverall.forEach((node, axisIndex) => {
    let data = { value: dynamb.velocityOverall[axisIndex],
                 dataType: opcua.DataType.Double };

    node.setValueFromSource(data, opcua.StatusCodes.Good,
                            new Date(dynamb.timestamp));
  });
}


module.exports = BarnaclesOPCUA;
