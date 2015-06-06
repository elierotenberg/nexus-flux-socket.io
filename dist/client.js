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

var _socketIoClient = require('socket.io-client');

var _socketIoClient2 = _interopRequireDefault(_socketIoClient);

var _nexusFlux = require('nexus-flux');

var _immutableRequest = require('immutable-request');

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

var SocketIOClient = (function (_Client) {
  // uri is the endpoint which the client will attempt to connect to
  // salt is a disambiguation salt to allow multiplexing
  // sockOpts is passed to socket.io Client constructor
  // reqOpts is passed to Request constructor

  function SocketIOClient(uri) {
    var salt = arguments[1] === undefined ? _common.DEFAULT_SALT : arguments[1];

    var _this = this;

    var sockOpts = arguments[2] === undefined ? {} : arguments[2];
    var reqOpts = arguments[3] === undefined ? {} : arguments[3];

    _classCallCheck(this, SocketIOClient);

    if (__DEV__) {
      uri.should.be.a.String;
      sockOpts.should.be.an.Object;
      reqOpts.should.be.an.Object;
    }
    sockOpts.timeout = sockOpts.timeout || 5000;
    _get(Object.getPrototypeOf(SocketIOClient.prototype), 'constructor', this).call(this);
    this._uri = uri;
    this._sockOpts = sockOpts;
    this._salt = salt;
    this._requester = new _immutableRequest.Requester(uri, reqOpts);
    this._ioClient = null;
    this.lifespan.onRelease(function () {
      _this._requester.cancelAll(new Error('Client lifespan released'));
      _this._requester.reset();
      _this._requester = null;
    });
  }

  _inherits(SocketIOClient, _Client);

  _createClass(SocketIOClient, [{
    key: 'fetch',
    value: function fetch(path) {
      var hash = arguments[1] === undefined ? null : arguments[1];

      if (__DEV__) {
        path.should.be.a.String;
        (hash === null || _.isNumber(hash)).should.be['true'];
      }
      if (hash !== null) {
        path = path + (path.indexOf('?') === -1 ? '?' : '&') + 'h=' + hash;
      }
      /* eslint-disable new-cap */
      return this._requester.GET(path)
      /* eslint-enable new-cap */
      .then(function (js) {
        if (__DEV__) {
          js.should.be.an.Object;
        }
        return _nexusFlux.Remutable.fromJS(js);
      });
    }
  }, {
    key: 'sendToServer',
    value: function sendToServer(ev) {
      if (__DEV__) {
        ev.should.be.an.instanceOf(_nexusFlux.Client.Event);
      }
      this._io.emit(this._salt, ev.toJSON());
    }
  }, {
    key: 'receiveFromSocket',
    value: function receiveFromSocket(json) {
      if (__DEV__) {
        json.should.be.a.String;
      }
      var ev = _nexusFlux.Server.Event.fromJSON(json);
      if (__DEV__) {
        ev.should.be.an.instanceOf(_nexusFlux.Server.Event);
      }
      this.receiveFromServer(ev);
    }
  }, {
    key: '_io',

    // lazily instanciate an actual socket; won't connect unless we need it.
    get: function () {
      var _this2 = this;

      if (this._ioClient === null) {
        (function () {
          _this2._ioClient = new _socketIoClient2['default'](_this2._uri, _this2._sockOpts);
          _this2._ioClient.connect();
          var receiveFromSocket = function receiveFromSocket(json) {
            return _this2.receiveFromSocket(json);
          };
          var forceResync = function forceResync() {
            return _this2.forceResync();
          };
          _this2._ioClient.on(_this2._salt, receiveFromSocket);
          _this2._ioClient.on('reconnect', forceResync);
          _this2.lifespan.onRelease(function () {
            _this2._ioClient.off(_this2._salt, receiveFromSocket);
            _this2._ioClient.off('reconnect', forceResync);
            _this2._ioClient.disconnect();
            _this2._ioClient = null;
          });
        })();
      }
      return this._ioClient;
    }
  }]);

  return SocketIOClient;
})(_nexusFlux.Client);

exports['default'] = SocketIOClient;
module.exports = exports['default'];