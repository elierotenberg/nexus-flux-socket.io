"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var _get = function get(object, property, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc && desc.writable) {
    return desc.value;
  } else {
    var getter = desc.get;
    if (getter === undefined) {
      return undefined;
    }
    return getter.call(receiver);
  }
};

var _inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }
  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) subClass.__proto__ = superClass;
};

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

require("6to5/polyfill");
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
var Client = require("nexus-flux").Client;
var Server = require("nexus-flux").Server;
var Link = Server.Link;
var express = _interopRequire(require("express"));

var cors = _interopRequire(require("cors"));

var http = _interopRequire(require("http"));

var IOServer = _interopRequire(require("socket.io"));

var Remutable = _interopRequire(require("remutable"));

var DEFAULT_SALT = require("./common").DEFAULT_SALT;


function isSocket(obj) {
  // ducktype-check
  return _.isObject(obj) && _.isFunction(obj.emit) && _.isFunction(obj.addListener) && _.isFunction(obj.removeListener);
}

var SocketIOLink = (function (Link) {
  function SocketIOLink(io) {
    var _this = this;
    var salt = arguments[1] === undefined ? DEFAULT_SALT : arguments[1];
    return (function () {
      if (__DEV__) {
        isSocket(io).should.be["true"];
        salt.should.be.a.String;
      }
      _this._io = io;
      _this._salt = salt;
      var nsp = io.of("/");
      nsp.addListener(_this._salt, _this.receiveFromSocket);
      _get(Object.getPrototypeOf(SocketIOLink.prototype), "constructor", _this).call(_this);
      nsp.addListener("disconnect", _this.lifespan.release);
      _this.lifespan.onRelease(function () {
        nsp.removeListener(_this._salt, _this.receiveFromSocket);
        nsp.removeListener("disconnect", _this.lifespan.release);
        _this._io.disconnect();
        _this._io = null;
      });
    })();
  }

  _inherits(SocketIOLink, Link);

  _prototypeProperties(SocketIOLink, null, {
    sendToClient: {
      value: function sendToClient(ev) {
        if (__DEV__) {
          ev.should.be.an.instanceOf(Server.Event);
        }
        this._io.emit(this._salt, ev.toJSON());
      },
      writable: true,
      enumerable: true,
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
      enumerable: true,
      configurable: true
    }
  });

  return SocketIOLink;
})(Link);

var SocketIOServer = (function (Server) {
  // port is the port to listen to
  // salt is a disambiguation salt to allow multiplexing
  // sockOpts is passed to socket.io Server constructor
  // expressOpts is passed to express constructor
  function SocketIOServer(port) {
    var _this2 = this;
    var salt = arguments[1] === undefined ? DEFAULT_SALT : arguments[1];
    var sockOpts = arguments[2] === undefined ? {} : arguments[2];
    var expressOpts = arguments[3] === undefined ? {} : arguments[3];
    return (function () {
      if (__DEV__) {
        port.should.be.a.Number.which.is.above(0);
        salt.should.be.a.String;
        sockOpts.should.be.an.Object;
        expressOpts.should.be.an.Object;
      }
      sockOpts.pingTimeout = sockOpts.pingTimeout || 5000;
      sockOpts.pingInterval = sockOpts.pingInterval || 5000;
      _this2._port = port;
      _this2._salt = salt;
      _this2._app = express(expressOpts);
      _this2._http = http.Server(_this2._app);
      _this2._app.use(cors());
      _this2._io = IOServer(_this2._http, sockOpts);
      var nsp = _this2._io.of("/");
      _this2._public = {};
      _this2._app.get("*", function (_ref, res) {
        var path = _ref.path;
        if (_this2._public[path] === void 0) {
          return res.status(404).json({ err: "Unknown path: " + path });
        }
        return res.status(200).json(_this2._public[path].toJSON());
      });

      nsp.addListener("connection", _this2.acceptConnection);

      _this2.lifespan.onRelease(function () {
        nsp.removeListener("connection", _this2.acceptConnection);
        _this2._io.close();
        _this2._io = null;
        _this2._http.close();
        _this2._app = null;
        _this2._http = null;
        _this2._public = null;
      });

      _get(Object.getPrototypeOf(SocketIOServer.prototype), "constructor", _this2).call(_this2);

      _this2._app.listen(_this2._port);
    })();
  }

  _inherits(SocketIOServer, Server);

  _prototypeProperties(SocketIOServer, null, {
    publish: {
      value: function publish(path, remutableConsumer) {
        if (__DEV__) {
          path.should.be.a.String;
          remutableConsumer.should.be.an.instanceOf(Remutable.Consumer);
        }
        this._public[path] = remutableConsumer;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    acceptConnection: {
      value: function acceptConnection(io) {
        if (__DEV__) {
          isSocket(io).should.be["true"];
        }
        this.acceptLink(new SocketIOLink(io, this._salt));
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return SocketIOServer;
})(Server);

module.exports = SocketIOServer;