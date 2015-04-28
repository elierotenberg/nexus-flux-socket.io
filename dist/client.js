'use strict';

var _interopRequireDefault = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(object, property, receiver) { var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _inherits = function (subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _IOClient = require('socket.io-client');

var _IOClient2 = _interopRequireDefault(_IOClient);

var _Client$Server$Remutable = require('nexus-flux');

var _Requester = require('immutable-request');

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

var SocketIOClient = (function (_Client) {
  // uri is the endpoint which the client will attempt to connect to
  // salt is a disambiguation salt to allow multiplexing
  // sockOpts is passed to socket.io Client constructor
  // reqOpts is passed to Request constructor

  function SocketIOClient(uri) {
    var _this = this;

    var salt = arguments[1] === undefined ? _DEFAULT_SALT.DEFAULT_SALT : arguments[1];
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
    this._requester = new _Requester.Requester(uri, reqOpts);
    this._ioClient = null;
    this.lifespan.onRelease(function () {
      _this._requester.cancelAll(new Error('Client lifespan released'));
      _this._requester.reset();
      _this._requester = null;
    });
  }

  _inherits(SocketIOClient, _Client);

  _createClass(SocketIOClient, [{
    key: '_io',
    get: function () {
      var _this2 = this;

      // lazily instanciate an actual socket; won't connect unless we need it.
      if (this._ioClient === null) {
        (function () {
          _this2._ioClient = new _IOClient2['default'](_this2._uri, _this2._sockOpts);
          var receiveFromSocket = function receiveFromSocket(json) {
            return _this2.receiveFromSocket(json);
          };
          _this2._ioClient.on(_this2._salt, receiveFromSocket);
          _this2.lifespan.onRelease(function () {
            _this2._ioClient.off(_this2._salt, receiveFromSocket);
            _this2._ioClient.disconnect();
            _this2._ioClient = null;
          });
        })();
      }
      return this._ioClient;
    }
  }, {
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
      return this._requester.GET(path) // eslint-disable-line new-cap
      .then(function (js) {
        if (__DEV__) {
          js.should.be.an.Object;
        }
        return _Client$Server$Remutable.Remutable.fromJS(js);
      });
    }
  }, {
    key: 'sendToServer',
    value: function sendToServer(ev) {
      if (__DEV__) {
        ev.should.be.an.instanceOf(_Client$Server$Remutable.Client.Event);
      }
      this._io.emit(this._salt, ev.toJSON());
    }
  }, {
    key: 'receiveFromSocket',
    value: function receiveFromSocket(json) {
      if (__DEV__) {
        json.should.be.a.String;
      }
      var ev = _Client$Server$Remutable.Server.Event.fromJSON(json);
      if (__DEV__) {
        ev.should.be.an.instanceOf(_Client$Server$Remutable.Server.Event);
      }
      this.receiveFromServer(ev);
    }
  }]);

  return SocketIOClient;
})(_Client$Server$Remutable.Client);

exports['default'] = SocketIOClient;
module.exports = exports['default'];