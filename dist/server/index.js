"use strict";

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
var cors = _interopRequire(require("cors"));

var express = _interopRequire(require("express"));

var http = _interopRequire(require("http"));

var SocketIOServer = _interopRequire(require("socket.io"));

var through = _interopRequire(require("through2"));

var Remutable = _interopRequire(require("remutable"));

var Client = require("nexus-flux").Client;
var Server = require("nexus-flux").Server;
var EventEmitter = require("nexus-flux").EventEmitter;
var CLIENT_EVENT = require("../constants").CLIENT_EVENT;
var SERVER_EVENT = require("../constants").SERVER_EVENT;


var CONNECTION = "c";

function isSocket(sock) {
  // ducktype-check for Socket instance
  return _.isObject(sock) && _.isFunction(sock.on) && _.isFunction(sock.emit) && _.isFunction(sock.disconnect);
}

var LinkDuplex = through.ctor({ objectMode: true, allowHalfOpen: false }, function receiveFromServer(ev, enc, done) {
  try {
    if (__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    // JSON stringification is actually memoized.
    this._socket.emit(SERVER_EVENT, ev.toJSON());
  } catch (err) {
    return done(err);
  }
  return done(null);
}, function flush(done) {
  if (this._socket !== null) {
    this._socket.disconnect();
    this._socket = null;
  }
  return done(null);
});

var Link = (function () {
  var _LinkDuplex = LinkDuplex;
  var Link = function Link(socket) {
    if (__DEV__) {
      isSocket(socket).should.be["true"];
    }
    _get(Object.getPrototypeOf(Link.prototype), "constructor", this).call(this);
    _.bindAll(this);
    Object.assign(this, {
      _socket: socket });
    this._socket.on(CLIENT_EVENT, this._receiveFromSocket);
    this._socket.on("disconnect", this.end);
  };

  _inherits(Link, _LinkDuplex);

  Link.prototype._receiveFromSocket = function (json) {
    if (__DEV__) {
      json.should.be.a.String;
    }
    var ev = Client.Event.fromJSON(json);
    if (__DEV__) {
      ev.should.be.an.instanceOf(Client.Event);
    }
    this.push(ev);
  };

  return Link;
})();

var ServerAdapter = (function () {
  var _Server$Adapter = Server.Adapter;
  var ServerAdapter = function ServerAdapter(port) {
    var _this = this;
    var socketOpts = arguments[1] === undefined ? {} : arguments[1];
    var expressOpts = arguments[2] === undefined ? {} : arguments[2];
    if (__DEV__) {
      port.should.be.a.Number;
      socketOpts.should.be.an.Object;
      expressOpts.should.be.an.Object;
    }
    _get(Object.getPrototypeOf(ServerAdapter.prototype), "constructor", this).call(this);
    _.bindAll(this);
    var app = express(expressOpts);
    var server = http.Server(app);
    app.use(cors());
    var io = SocketIOServer(server); // bind socket.io handlers first
    Object.assign(this, {
      _port: port,
      _app: app,
      _server: server,
      _io: io,
      _published: {},
      _events: new EventEmitter() });

    app.get("*", function (_ref, res) {
      var path = _ref.path;
      // then bind get default handler
      if (_this._published[path] === void 0) {
        return res.status(404).json({ err: "Unknown path: " + path });
      }
      // JSON stringification is actually memoized.
      return res.status(200).json(_this._published[path].toJSON());
    });
    io.on("connection", function (socket) {
      return _this._events.emit(CONNECTION, new Link(socket));
    });

    server.listen(port);
  };

  _inherits(ServerAdapter, _Server$Adapter);

  ServerAdapter.prototype.publish = function (path, consumer) {
    if (__DEV__) {
      path.should.be.a.String;
      consumer.should.be.an.instanceOf(Remutable.Consumer);
    }
    this._published[path] = consumer;
  };

  ServerAdapter.prototype.onConnection = function (accept, lifespan) {
    if (__DEV__) {
      accept.should.be.a.Function;
      lifespan.should.have.property("then").which.is.a.Function;
    }
    this._events.addListener(CONNECTION, accept, lifespan);
  };

  return ServerAdapter;
})();

module.exports = {
  Adapter: ServerAdapter };
// 'nexus-flux-socket.io/dist/server'.