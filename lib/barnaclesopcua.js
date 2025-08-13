/**
 * Copyright reelyActive 2024-2025
 * We believe in an open Internet of Things
 */


const fs = require('fs');
const path = require('path');
const opcua = require('node-opcua');


const DEFAULT_PORT = 4840;
const DEFAULT_PRINT_ERRORS = false;
const CONFIG_PATH = 'config';
const DYNAMB_PROCESSORS = new Map([
    [ "accelerationTimeSeries", { update: updateAccelerationTimeSeries } ],
    [ "batteryPercentage", { update: updateBatteryPercentage } ],
    [ "batteryVoltage", { update: updateBatteryVoltage } ],
    [ "carbonDioxideConcentration",
      { update: updateCarbonDioxideConcentration } ],
    [ "illuminance", { update: updateIlluminance } ],
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
      self.server.start(() => {
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
 * Create the OPC UA server with the given options.
 * https://node-opcua.github.io/api_doc/2.132.0/classes/node_opcua_server.OPCUAServer.html
 * @param {Object} options The configuration options.
 */
function createServer(options) {
  let serverOptions = {
    port: options.port || DEFAULT_PORT,
    resourcePath: "/UA/ParetoAnywhere",
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
 * Update the batteryPercentage variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateBatteryPercentage(dynamb, device, namespace) {
  let data = { value: dynamb.batteryPercentage,
               dataType: opcua.DataType.Double };

  if(!device.nodes.hasOwnProperty('batteryPercentage')) {
    device.nodes.batteryPercentage = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: "BatteryPercentage",
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

  if(!device.nodes.hasOwnProperty('batteryVoltage')) {
    device.nodes.batteryVoltage = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: "BatteryVoltage",
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

  if(!device.nodes.hasOwnProperty('carbonDioxideConcentration')) {
    device.nodes.carbonDioxideConcentration = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: "CarbonDioxideConcentration",
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

  if(!device.nodes.hasOwnProperty('illuminance')) {
    device.nodes.illuminance = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: "Illuminance",
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
 * Update the levelPercentage variable of the given device.
 * @param {Object} dynamb The dynamb data.
 * @param {Object} device The OPC-UA device instance and nodes.
 * @param {Namespace} namespace The OPC-UA namespace.
 */
function updateLevelPercentage(dynamb, device, namespace) {
  let data = { value: dynamb.levelPercentage, dataType: opcua.DataType.Double };

  if(!device.nodes.hasOwnProperty('levelPercentage')) {
    device.nodes.levelPercentage = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: "LevelPercentage",
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

  if(!device.nodes.hasOwnProperty('luminousFlux')) {
    device.nodes.luminousFlux = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: "LuminousFlux",
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

  if(!device.nodes.hasOwnProperty('pm1.0')) {
    device.nodes['pm1.0'] = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: "PM1.0",
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

  if(!device.nodes.hasOwnProperty('pm2.5')) {
    device.nodes['pm2.5'] = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: "PM2.5",
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

  if(!device.nodes.hasOwnProperty('pm10')) {
    device.nodes['pm10'] = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: "PM10",
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

  if(!device.nodes.hasOwnProperty('pressure')) {
    device.nodes.pressure = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: "Pressure",
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

  if(!device.nodes.hasOwnProperty('soundPressure')) {
    device.nodes.soundPressure = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: "SoundPressure",
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

  if(!device.nodes.hasOwnProperty('relativeHumidity')) {
    device.nodes.relativeHumidity = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: "RelativeHumidity",
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

  if(!device.nodes.hasOwnProperty('temperature')) {
    device.nodes.temperature = namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: "Temperature",
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

  if(!device.nodes.hasOwnProperty('volatileOrganicCompoundsConcentration')) {
    device.nodes.volatileOrganicCompoundsConcentration =
                                                  namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: "VolatileOrganicCompoundsConcentration",
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
    nodes.push(namespace.addYArrayItem({
      componentOf: device.instance,
      browseName: ACCELERATION_TIME_SERIES_BROWSE_NAMES[index],
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
    nodes.push(namespace.addAnalogDataItem({
      componentOf: device.instance,
      browseName: VELOCITY_OVERALL_BROWSE_NAMES[index],
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
