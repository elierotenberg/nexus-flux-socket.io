"use strict";

var _interopRequire = function (obj) { return obj && obj.__esModule ? obj["default"] : obj; };

var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

var _get = function get(object, property, receiver) { var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc && desc.writable) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _inherits = function (subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

require("babel/polyfill");
var _ = require("lodash");
var should = require("should");
var Promise = (global || window).Promise = require("bluebird");
var __DEV__ = process.env.NODE_ENV !== "production";
var __PROD__ = !__DEV__;
var __BROWSER__ = typeof window === "object";
var __NODE__ = !__BROWSER__;
if (__DEV__) {
  Promise.longStackTraces();
  Error.stackTraceLimit = Infinity;
}
var _nexusFlux = require("nexus-flux");

var Client = _nexusFlux.Client;
var Server = _nexusFlux.Server;
var Link = Server.Link;
var express = _interopRequire(require("express"));

var createError = _interopRequire(require("http-errors"));

var cors = _interopRequire(require("cors"));

var http = _interopRequire(require("http"));

var IOServer = _interopRequire(require("socket.io"));

var DEFAULT_SALT = require("./common").DEFAULT_SALT;


function isSocket(obj) {
  // ducktype-check
  return _.isObject(obj) && _.isFunction(obj.emit) && _.isFunction(obj.addListener) && _.isFunction(obj.removeListener);
}

var SocketIOLink = (function (Link) {
  function SocketIOLink(socket) {
    var _this = this;
    var salt = arguments[1] === undefined ? DEFAULT_SALT : arguments[1];
    _classCallCheck(this, SocketIOLink);

    if (__DEV__) {
      isSocket(socket).should.be["true"];
      salt.should.be.a.String;
    }
    this._socket = socket;
    this._salt = salt;
    _get(Object.getPrototypeOf(SocketIOLink.prototype), "constructor", this).call(this);
    _.bindAll(this, ["sendToClient", "receiveFromSocket"]);
    socket.on(this._salt, this.receiveFromSocket);
    socket.on("disconnect", this.lifespan.release);
    this.lifespan.onRelease(function () {
      socket.disconnect();
      _this._socket = null;
    });
  }

  _inherits(SocketIOLink, Link);

  _prototypeProperties(SocketIOLink, null, {
    sendToClient: {
      value: function sendToClient(ev) {
        if (__DEV__) {
          ev.should.be.an.instanceOf(Server.Event);
        }
        this._socket.emit(this._salt, ev.toJSON());
      },
      writable: true,
      configurable: true
    },
    receiveFromSocket: {
      value: function receiveFromSocket(json) {
        if (__DEV__) {
          json.should.be.a.String;
        }
        var ev = Client.Event.fromJSON(json);
        if (__DEV__) {
          ev.should.be.an.instanceOf(Client.Event);
        }
        this.receiveFromClient(ev);
      },
      writable: true,
      configurable: true
    }
  });

  return SocketIOLink;
})(Link);

/**
 * @abstract
 */
var SocketIOServer = (function (Server) {
  // port is the port to listen to
  // salt is a disambiguation salt to allow multiplexing
  // sockOpts is passed to socket.io Server constructor
  // expressOpts is passed to express constructor
  function SocketIOServer(port) {
    var _this = this;
    var salt = arguments[1] === undefined ? DEFAULT_SALT : arguments[1];
    var sockOpts = arguments[2] === undefined ? {} : arguments[2];
    var expressOpts = arguments[3] === undefined ? {} : arguments[3];
    _classCallCheck(this, SocketIOServer);

    if (__DEV__) {
      port.should.be.a.Number.which.is.above(0);
      salt.should.be.a.String;
      sockOpts.should.be.an.Object;
      expressOpts.should.be.an.Object;
      this.constructor.should.not.be.exactly(SocketIOServer); // ensure abstract
      this.serveStore.should.not.be.exactly(SocketIOServer.prototype.serveStore); // ensure virtual
    }
    sockOpts.pingTimeout = sockOpts.pingTimeout || 5000;
    sockOpts.pingInterval = sockOpts.pingInterval || 5000;
    _get(Object.getPrototypeOf(SocketIOServer.prototype), "constructor", this).call(this);

    this._salt = salt;
    var app = express(expressOpts).use(cors());
    var server = http.Server(app);
    var io = IOServer(server, sockOpts);
    server.listen(port);
    app.get("*", function (req, res) {
      return _this.serveStore(req).then(function (json) {
        return res.type("json").send(json);
      })["catch"](function (error) {
        if (error.status !== void 0) {
          res.status(error.status).json(error);
        } else {
          res.status(500).json(error);
        }
      });
    });
    io.on("connection", function (socket) {
      return _this.acceptConnection(socket);
    });

    this.lifespan.onRelease(function () {
      io.close();
      server.close();
    });
  }

  _inherits(SocketIOServer, Server);

  _prototypeProperties(SocketIOServer, null, {
    serveStore: {

      /**
       * @virtual
       */
      value: function serveStore(_ref) {
        var path = _ref.path;
        return Promise["try"](function () {
          if (__DEV__) {
            path.should.be.a.String;
          }
          throw new createError(404, "Virtual method invocation, you have to define serveStore function.");
        });
      },
      writable: true,
      configurable: true
    },
    acceptConnection: {
      value: function acceptConnection(socket) {
        if (__DEV__) {
          isSocket(socket).should.be["true"];
        }
        this.acceptLink(new SocketIOLink(socket, this._salt));
      },
      writable: true,
      configurable: true
    }
  });

  return SocketIOServer;
})(Server);

module.exports = SocketIOServer;