'use strict';

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _get = require('babel-runtime/helpers/get')['default'];

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

var _nexusFlux = require('nexus-flux');

var _client = require('../client');

var _client2 = _interopRequireDefault(_client);

var _server = require('../server');

var _server2 = _interopRequireDefault(_server);

var _sha256 = require('sha256');

var _sha2562 = _interopRequireDefault(_sha256);

var _httpErrors = require('http-errors');

var _httpErrors2 = _interopRequireDefault(_httpErrors);

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

// server main
_.defer(function () {

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
            throw (0, _httpErrors2['default'])(400, 'Path should be a string.');
          }
          if (stores[path] === void 0) {
            throw (0, _httpErrors2['default'])(404, 'No such store.');
          }
          return stores[path].toJSON();
        });
      }
    }]);

    return MyServer;
  })(_server2['default']);

  var server = new MyServer(43434);
  server.lifespan.onRelease(function () {
    return console.log('server released');
  });

  // initialize several stores
  var clock = stores['/clock'] = new _nexusFlux.Remutable({
    date: Date.now()
  });
  var todoList = stores['/todoList'] = new _nexusFlux.Remutable({});

  // update clock every 500ms
  server.lifespan.setInterval(function () {
    server.dispatchUpdate('/clock', clock.set('date', Date.now()).commit());
  }, 500);

  var actions = {
    '/addItem': function addItem(_ref2) {
      var name = _ref2.name;
      var description = _ref2.description;
      var ownerKey = _ref2.ownerKey;

      var item = { name: name, description: description, ownerHash: (0, _sha2562['default'])(ownerKey) };
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

      if ((0, _sha2562['default'])(ownerKey) !== ownerHash) {
        return;
      }
      server.dispatchUpdate('/todoList', todoList.set(name, void 0).commit());
    }
  };

  server.on('action', function (_ref4) {
    var path = _ref4.path;
    var params = _ref4.params;

    if (actions[path] !== void 0) {
      actions[path](params);
    }
  }, server.lifespan);

  // release the server in 10000ms
  server.lifespan.setTimeout(server.lifespan.release, 10000);
});

// client main
_.defer(function () {
  var client = new _client2['default']('http://127.0.0.1:43434');
  client.lifespan.onRelease(function () {
    return console.log('client released');
  });

  var ownerKey = (0, _sha2562['default'])('' + Date.now() + ':' + _.random());
  // subscribe to a store
  client.getStore('/clock', client.lifespan).onUpdate(function (_ref5) {
    var head = _ref5.head;

    // every time its updated (including when its first fetched), display the modified value (it is an Immutable.Map)
    console.log('clock tick', head.get('date'));
  })
  // if its deleted, then do something appropriate
  .onDelete(function () {
    console.log('clock deleted');
  });

  // this store subscribers has a limited lifespan (eg. a React components' own lifespan)
  var todoListLifespan = new _nexusFlux.Lifespan();
  var todoList = client.getStore('/todoList', todoListLifespan).onUpdate(function (_ref6, patch) {
    var head = _ref6.head;

    // when its updated, we can access not only the up-to-date head, but also the underlying patch object
    // if we want to do something with it (we can ignore it as above)
    console.log('received todoList patch:', patch);
    console.log('todoList head is now:', head.toJS());
  }).onDelete(function () {
    console.log('todoList deleted');
  });

  // dispatch some actions
  client.dispatchAction('/addItem', { name: 'Harder', description: 'Code harder', ownerKey: ownerKey });
  client.dispatchAction('/addItem', { name: 'Better', description: 'Code better', ownerKey: ownerKey });
  client.lifespan
  // add a new item in 1000ms
  .setTimeout(function () {
    return client.dispatchAction('/addItem', {
      name: 'Faster',
      description: 'Code Faster',
      ownerKey: ownerKey
    });
  }, 1000)
  // remove an item in 2000ms
  .setTimeout(function () {
    return client.dispatchAction('/removeItem', {
      name: 'Harder',
      ownerKey: ownerKey
    });
  }, 2000)
  // add an item in 3000ms
  .setTimeout(function () {
    return client.dispatchAction('/addItem', {
      name: 'Stronger',
      description: 'Code stronger',
      ownerKey: ownerKey
    });
  }, 3000)
  // remove every item in 4000
  .setTimeout(function () {
    return todoList.value.forEach(function (_ref7, name) {
      var description = _ref7.description;

      client.dispatchAction('/removeItem', { name: name, ownerKey: ownerKey });
    });
  }, 4000)
  // release the subscriber in 5000ms
  .setTimeout(todoListLifespan.release, 5000)
  // release the client in 6000ms
  .setTimeout(client.lifespan.release, 6000);
});