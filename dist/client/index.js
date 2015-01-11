"use strict";

var _inherits = function (child, parent) {
  if (typeof parent !== "function" && parent !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof parent);
  }
  child.prototype = Object.create(parent && parent.prototype, {
    constructor: {
      value: child,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (parent) child.__proto__ = parent;
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
var SocketIOClient = _interopRequire(require("socket.io-client"));

var Client = require("nexus-flux").Client;
var Server = require("nexus-flux").Server;
var Requester = require("immutable-request").Requester;
var through = _interopRequire(require("through2"));

var CLIENT_EVENT = require("../constants").CLIENT_EVENT;
var SERVER_EVENT = require("../constants").SERVER_EVENT;


var ClientAdapterDuplex = through.ctor({ objectMode: true, allowHalfOpen: false }, function receiveFromClient(ev, enc, done) {
  // Client -> Adapter
  try {
    if (__DEV__) {
      ev.should.be.an.instanceOf(Client.Event);
    }
    this._socket.emit(CLIENT_EVENT, ev.toJSON()); // Adapter -> Link
  } catch (err) {
    return done(err);
  }
  return done(null);
}, function flush(done) {
  try {
    if (this._socket !== null) {
      this._socket.disconnect();
      this._socket = null;
      this._requester.cancelAll();
      this._requester.reset();
      this._requester = null;
    }
  } catch (err) {
    return done(err);
  }
  return done(null);
});

var ClientAdapter = (function () {
  var _ClientAdapterDuplex = ClientAdapterDuplex;
  var ClientAdapter = function ClientAdapter(url) {
    var socketOpts = arguments[1] === undefined ? {} : arguments[1];
    var requesterOpts = arguments[2] === undefined ? {} : arguments[2];
    // https://github.com/automattic/socket.io-client#managerurlstring-optsobject
    socketOpts.timeout = socketOpts.timeout || 2000; // default timeout to 2000ms.
    if (__DEV__) {
      url.should.be.a.String;
      socketOpts.should.be.an.Object;
      requesterOpts.should.be.an.Object;
    }
    _.bindAll(this);
    Object.assign(this, {
      _socket: SocketIOClient(url, socketOpts),
      _requester: new Requester(url, requesterOpts) });
    this._socket.on(SERVER_EVENT, this._receiveFromSocket);
  };

  _inherits(ClientAdapter, _ClientAdapterDuplex);

  ClientAdapter.prototype.fetch = function (path) {
    var hash = arguments[1] === undefined ? null : arguments[1];
    if (__DEV__) {
      path.should.be.a.String;
      (hash === null || _.isString(hash)).should.be["true"];
    }
    if (hash) {
      if (path.indexOf("?") === -1) {
        path = "" + path + "?v=" + hash;
      } else {
        path = "" + path + "&v=" + hash;
      }
    }
    return this._requester.GET(path);
  };

  ClientAdapter.prototype._receiveFromSocket = function (json) {
    if (__DEV__) {
      json.should.be.a.String;
    }
    var ev = Server.Event.fromJSON(json);
    if (__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    this.push(ev);
  };

  return ClientAdapter;
})();

module.exports = ClientAdapter;