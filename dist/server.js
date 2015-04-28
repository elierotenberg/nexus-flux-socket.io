'use strict';

var _interopRequireDefault = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(object, property, receiver) { var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _inherits = function (subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _Client$Server = require('nexus-flux');

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _createError = require('http-errors');

var _createError2 = _interopRequireDefault(_createError);

var _cors = require('cors');

var _cors2 = _interopRequireDefault(_cors);

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _IOServer = require('socket.io');

var _IOServer2 = _interopRequireDefault(_IOServer);

var _DEFAULT_SALT = require('./common');

require('babel/polyfill');
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
var Link = _Client$Server.Server.Link;

function isSocket(obj) {
  // ducktype-check
  return _.isObject(obj) && _.isFunction(obj.emit) && _.isFunction(obj.addListener) && _.isFunction(obj.removeListener);
}

var SocketIOLink = (function (_Link) {
  function SocketIOLink(socket) {
    var _this = this;

    var salt = arguments[1] === undefined ? _DEFAULT_SALT.DEFAULT_SALT : arguments[1];

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
        ev.should.be.an.instanceOf(_Client$Server.Server.Event);
      }
      this._socket.emit(this._salt, ev.toJSON());
    }
  }, {
    key: 'receiveFromSocket',
    value: function receiveFromSocket(json) {
      if (__DEV__) {
        json.should.be.a.String;
      }
      var ev = _Client$Server.Client.Event.fromJSON(json);
      if (__DEV__) {
        ev.should.be.an.instanceOf(_Client$Server.Client.Event);
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
    var _this2 = this;

    var salt = arguments[1] === undefined ? _DEFAULT_SALT.DEFAULT_SALT : arguments[1];
    var sockOpts = arguments[2] === undefined ? {} : arguments[2];
    var expressOpts = arguments[3] === undefined ? {} : arguments[3];

    _classCallCheck(this, SocketIOServer);

    _get(Object.getPrototypeOf(SocketIOServer.prototype), 'constructor', this).call(this);
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

    this._salt = salt;
    var app = _express2['default'](expressOpts).use(_cors2['default']());
    var server = _http2['default'].Server(app); // eslint-disable-line new-cap
    var io = new _IOServer2['default'](server, sockOpts);
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

    /**
     * @virtual
     */
    value: function serveStore(_ref) {
      var path = _ref.path;

      return Promise['try'](function () {
        if (__DEV__) {
          path.should.be.a.String;
        }
        throw _createError2['default'](404, 'Virtual method invocation, you have to define serveStore function.');
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
})(_Client$Server.Server);

exports['default'] = SocketIOServer;
module.exports = exports['default'];