/**
 * Copyright reelyActive 2024
 * We believe in an open Internet of Things
 */


const opcua = require('node-opcua-server');


const DEFAULT_PORT = 4343;
const DEFAULT_PRINT_ERRORS = false;


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

    this.server = new opcua.OPCUAServer({
      port: options.port || DEFAULT_PORT,
      resourcePath: "/UA/ParetoAnywhere"
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
    // TODO:
    // device = namespace.addObject({ });
    // namespace.addVariable({});
  }

}


module.exports = BarnaclesOPCUA;
