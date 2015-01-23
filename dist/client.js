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
var IOClient = _interopRequire(require("socket.io-client"));

var Client = require("nexus-flux").Client;
var Server = require("nexus-flux").Server;
var Requester = require("immutable-request").Requester;
var DEFAULT_SALT = require("./common").DEFAULT_SALT;


var INT_MAX = 9007199254740992;

var SocketIOClient = (function (Client) {
  // uri is the endpoint which the client will attempt to connect to
  // clientID is a unique client ID, which can be used (hashed as clientHash) by the server-side action dispatchers
  // salt is a disambiguation salt to allow multiplexing
  // sockOpts is passed to socket.io Client constructor
  // reqOpts is passed to Request constructor
  function SocketIOClient(uri) {
    var _this = this;
    var clientID = arguments[1] === undefined ? _.uniqueId("Client" + _.random(1, INT_MAX - 1)) : arguments[1];
    var salt = arguments[2] === undefined ? DEFAULT_SALT : arguments[2];
    var sockOpts = arguments[3] === undefined ? {} : arguments[3];
    var reqOpts = arguments[4] === undefined ? {} : arguments[4];
    return (function () {
      if (__DEV__) {
        uri.should.be.a.String;
        clientID.should.be.a.String;
        sockOpts.should.be.an.Object;
        reqOpts.should.be.an.Object;
      }
      sockOpts.timeout = sockOpts.timeout || 5000;
      _this._io = IOClient(uri, reqOpts);
      _this._io.on(_this._salt, _this.receiveFromSocket);
      _this._requester = new Requester(uri, reqOpts);
      _get(Object.getPrototypeOf(SocketIOClient.prototype), "constructor", _this).call(_this, clientID);
      _this.lifespan.onRelease(function () {
        _this._io.off(_this._salt, _this.receiveFromSocket);
        _this._io.reconnection(false);
        _this._io.disconnect();
        _this._io = null;
        _this._requester.cancelAll(new Error("Client lifespan released"));
        _this._requester.reset();
        _this._requester = null;
      });
    })();
  }

  _inherits(SocketIOClient, Client);

  _prototypeProperties(SocketIOClient, null, {
    fetch: {
      value: function fetch(path) {
        var hash = arguments[1] === undefined ? null : arguments[1];
        if (__DEV__) {
          path.should.be.a.String;
          (hash === null || _.isString(hash)).should.be["true"];
        }
        if (hash !== null) {
          path = path + (path.indexOf("?") === -1 ? "?" : "&") + "h=" + hash;
        }
        return this._requester.GET(path);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    sendToServer: {
      value: function sendToServer(ev) {
        if (__DEV__) {
          ev.should.be.an.instanceOf(Client.Event);
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
        var ev = Server.Event.fromJSON(json);
        if (__DEV__) {
          ev.should.be.an.instanceOf(Server.Event);
        }
        this.receiveFromServer(ev);
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return SocketIOClient;
})(Client);

module.exports = SocketIOClient;