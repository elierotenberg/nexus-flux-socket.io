'use strict';

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _get = require('babel-runtime/helpers/get')['default'];

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _Object$defineProperty = require('babel-runtime/core-js/object/define-property')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

_Object$defineProperty(exports, '__esModule', {
  value: true
});

var _nexusFlux = require('nexus-flux');

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _httpErrors = require('http-errors');

var _httpErrors2 = _interopRequireDefault(_httpErrors);

var _cors = require('cors');

var _cors2 = _interopRequireDefault(_cors);

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _socketIo = require('socket.io');

var _socketIo2 = _interopRequireDefault(_socketIo);

var _common = require('./common');

var _ = require('lodash');
var should = require('should');
var Promise = (global || window).Promise = require('bluebird');
var __DEV__ = process.env.NODE_ENV !== 'production';
var __PROD__ = !__DEV__;
var __BROWSER__ = typeof window === 'object';
var __NODE__ = !__BROWSER__;
if (__DEV__) {
  Promise.longStackTraces();
  Error.stackTraceLimit = Infinity;
}
var Link = _nexusFlux.Server.Link;

// ducktype-check
function isSocket(obj) {
  return _.isObject(obj) && _.isFunction(obj.emit) && _.isFunction(obj.addListener) && _.isFunction(obj.removeListener);
}

var SocketIOLink = (function (_Link) {
  function SocketIOLink(socket) {
    var _this = this;

    var salt = arguments[1] === undefined ? _common.DEFAULT_SALT : arguments[1];

    _classCallCheck(this, SocketIOLink);

    _get(Object.getPrototypeOf(SocketIOLink.prototype), 'constructor', this).call(this);
    if (__DEV__) {
      isSocket(socket).should.be['true'];
      salt.should.be.a.String;
    }
    this._socket = socket;
    this._salt = salt;
    _.bindAll(this, ['sendToClient', 'receiveFromSocket']);
    socket.on(this._salt, this.receiveFromSocket);
    socket.on('disconnect', this.lifespan.release);
    this.lifespan.onRelease(function () {
      try {
        socket.disconnect();
      } catch (err) {
        console.warn(err);
      }
      _this._socket = null;
    });
  }

  _inherits(SocketIOLink, _Link);

  _createClass(SocketIOLink, [{
    key: 'sendToClient',
    value: function sendToClient(ev) {
      if (__DEV__) {
        ev.should.be.an.instanceOf(_nexusFlux.Server.Event);
      }
      this._socket.emit(this._salt, ev.toJSON());
    }
  }, {
    key: 'receiveFromSocket',
    value: function receiveFromSocket(json) {
      if (__DEV__) {
        json.should.be.a.String;
      }
      var ev = _nexusFlux.Client.Event.fromJSON(json);
      if (__DEV__) {
        ev.should.be.an.instanceOf(_nexusFlux.Client.Event);
      }
      this.receiveFromClient(ev);
    }
  }]);

  return SocketIOLink;
})(Link);

/**
 * @abstract
 */

var SocketIOServer = (function (_Server) {
  // port is the port to listen to
  // salt is a disambiguation salt to allow multiplexing
  // sockOpts is passed to socket.io Server constructor
  // expressOpts is passed to express constructor

  function SocketIOServer(port) {
    var salt = arguments[1] === undefined ? _common.DEFAULT_SALT : arguments[1];

    var _this2 = this;

    var sockOpts = arguments[2] === undefined ? {} : arguments[2];
    var expressOpts = arguments[3] === undefined ? {} : arguments[3];

    _classCallCheck(this, SocketIOServer);

    _get(Object.getPrototypeOf(SocketIOServer.prototype), 'constructor', this).call(this);
    if (__DEV__) {
      port.should.be.a.Number.which.is.above(0);
      salt.should.be.a.String;
      sockOpts.should.be.an.Object;
      expressOpts.should.be.an.Object;
      // ensure abstract
      this.constructor.should.not.be.exactly(SocketIOServer);
      // ensure virtual
      this.serveStore.should.not.be.exactly(SocketIOServer.prototype.serveStore);
    }
    sockOpts.pingTimeout = sockOpts.pingTimeout || 5000;
    sockOpts.pingInterval = sockOpts.pingInterval || 5000;

    this._salt = salt;
    var app = (0, _express2['default'])(expressOpts).use((0, _cors2['default'])());
    /* eslint-disable new-cap */
    var server = _http2['default'].Server(app);
    /* eslint-enable new-cap */
    var io = new _socketIo2['default'](server, sockOpts);
    server.listen(port);
    app.get('*', function (req, res) {
      return _this2.serveStore(req).then(function (json) {
        return res.type('json').send(json);
      })['catch'](function (error) {
        if (error.status !== void 0) {
          res.status(error.status).json(error);
        } else {
          res.status(500).json(error);
        }
      });
    });
    io.on('connection', function (socket) {
      return _this2.acceptConnection(socket);
    });

    this.lifespan.onRelease(function () {
      io.close();
    });
  }

  _inherits(SocketIOServer, _Server);

  _createClass(SocketIOServer, [{
    key: 'serveStore',
    value: function serveStore(_ref) {
      var path = _ref.path;

      return Promise['try'](function () {
        if (__DEV__) {
          path.should.be.a.String;
        }
        throw (0, _httpErrors2['default'])(404, 'Virtual method invocation, you have to define serveStore function.');
      });
    }
  }, {
    key: 'acceptConnection',
    value: function acceptConnection(socket) {
      if (__DEV__) {
        isSocket(socket).should.be['true'];
      }
      this.acceptLink(new SocketIOLink(socket, this._salt));
    }
  }]);

  return SocketIOServer;
})(_nexusFlux.Server);

exports['default'] = SocketIOServer;
module.exports = exports['default'];