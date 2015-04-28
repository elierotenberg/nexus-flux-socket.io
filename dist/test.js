'use strict';

var _interopRequireDefault = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(object, property, receiver) { var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _inherits = function (subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

var _Lifespan$Remutable = require('nexus-flux');

var _Client = require('../client');

var _Client2 = _interopRequireDefault(_Client);

var _Server2 = require('../server');

var _Server3 = _interopRequireDefault(_Server2);

var _hash = require('sha256');

var _hash2 = _interopRequireDefault(_hash);

var _createError = require('http-errors');

var _createError2 = _interopRequireDefault(_createError);

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

_.defer(function () {
  // server main

  var stores = {};

  var MyServer = (function (_Server) {
    function MyServer() {
      _classCallCheck(this, MyServer);

      _get(Object.getPrototypeOf(MyServer.prototype), 'constructor', this).apply(this, arguments);
    }

    _inherits(MyServer, _Server);

    _createClass(MyServer, [{
      key: 'serveStore',
      value: function serveStore(_ref) {
        var path = _ref.path;

        return Promise['try'](function () {
          if (!_.isString(path)) {
            throw _createError2['default'](400, 'Path should be a string.');
          }
          if (stores[path] === void 0) {
            throw _createError2['default'](404, 'No such store.');
          }
          return stores[path].toJSON();
        });
      }
    }]);

    return MyServer;
  })(_Server3['default']);

  var server = new MyServer(43434);
  server.lifespan.onRelease(function () {
    return console.log('server released');
  });

  // initialize several stores
  var clock = stores['/clock'] = new _Lifespan$Remutable.Remutable({
    date: Date.now() });
  var todoList = stores['/todoList'] = new _Lifespan$Remutable.Remutable({});

  server.lifespan.setInterval(function () {
    server.dispatchUpdate('/clock', clock.set('date', Date.now()).commit());
  }, 500); // update clock every 500ms

  var actions = {
    '/addItem': function addItem(_ref2) {
      var name = _ref2.name;
      var description = _ref2.description;
      var ownerKey = _ref2.ownerKey;

      var item = { name: name, description: description, ownerHash: _hash2['default'](ownerKey) };
      if (todoList.get(name) !== void 0) {
        return;
      }
      server.dispatchUpdate('/todoList', todoList.set(name, item).commit());
    },
    '/removeItem': function removeItem(_ref3) {
      var name = _ref3.name;
      var ownerKey = _ref3.ownerKey;

      var item = todoList.get(name);
      if (item === void 0) {
        return;
      }
      var ownerHash = item.ownerHash;

      if (_hash2['default'](ownerKey) !== ownerHash) {
        return;
      }
      server.dispatchUpdate('/todoList', todoList.set(name, void 0).commit());
    } };

  server.on('action', function (_ref4) {
    var path = _ref4.path;
    var params = _ref4.params;

    if (actions[path] !== void 0) {
      actions[path](params);
    }
  }, server.lifespan);

  server.lifespan.setTimeout(server.lifespan.release, 10000); // release the server in 10000ms
});

_.defer(function () {
  // client main
  var client = new _Client2['default']('http://127.0.0.1:43434');
  client.lifespan.onRelease(function () {
    return console.log('client released');
  });

  var ownerKey = _hash2['default']('' + Date.now() + ':' + _.random());
  client.getStore('/clock', client.lifespan) // subscribe to a store
  .onUpdate(function (_ref5) {
    var head = _ref5.head;

    // every time its updated (including when its first fetched), display the modified value (it is an Immutable.Map)
    console.log('clock tick', head.get('date'));
  }).onDelete(function () {
    // if its deleted, then do something appropriate
    console.log('clock deleted');
  });

  // this store subscribers has a limited lifespan (eg. a React components' own lifespan)
  var todoListLifespan = new _Lifespan$Remutable.Lifespan();
  var todoList = client.getStore('/todoList', todoListLifespan).onUpdate(function (_ref6, patch) {
    var head = _ref6.head;

    // when its updated, we can access not only the up-to-date head, but also the underlying patch object
    console.log('received todoList patch:', patch); // if we want to do something with it (we can ignore it as above)
    console.log('todoList head is now:', head.toJS());
  }).onDelete(function () {
    console.log('todoList deleted');
  });

  client.dispatchAction('/addItem', { name: 'Harder', description: 'Code harder', ownerKey: ownerKey }); // dispatch some actions
  client.dispatchAction('/addItem', { name: 'Better', description: 'Code better', ownerKey: ownerKey });
  client.lifespan.setTimeout(function () {
    return client.dispatchAction('/addItem', {
      name: 'Faster',
      description: 'Code Faster',
      ownerKey: ownerKey });
  }, 1000) // add a new item in 1000ms
  .setTimeout(function () {
    return client.dispatchAction('/removeItem', {
      name: 'Harder',
      ownerKey: ownerKey });
  }, 2000) // remove an item in 2000ms
  .setTimeout(function () {
    return client.dispatchAction('/addItem', {
      name: 'Stronger',
      description: 'Code stronger',
      ownerKey: ownerKey });
  }, 3000) // add an item in 3000ms
  .setTimeout(function () {
    return todoList.value.forEach(function (_ref7, name) {
      var description = _ref7.description;
      // eslint-disable-line no-unused-vars
      // remove every item in 4000
      client.dispatchAction('/removeItem', { name: name, ownerKey: ownerKey });
    });
  }, 4000).setTimeout(todoListLifespan.release, 5000) // release the subscriber in 5000ms
  .setTimeout(client.lifespan.release, 6000); // release the client in 6000ms
});