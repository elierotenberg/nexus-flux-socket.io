import cors from 'cors';
import express from 'express';
import http from 'http';
import SocketIOServer from 'socket.io';
import through from 'through2';
import Remutable from 'remutable';
import { Client, Server, EventEmitter } from 'nexus-flux';

import { CLIENT_EVENT, SERVER_EVENT } from '../constants';

const CONNECTION = 'c';

function isSocket(sock) { // ducktype-check for Socket instance
  return _.isObject(sock) && _.isFunction(sock.on) && _.isFunction(sock.emit) && _.isFunction(sock.disconnect);
}

const LinkDuplex = through.ctor({ objectMode: true, allowHalfOpen: false },
  function receiveFromServer(ev, enc, done) {
    try {
      if(__DEV__) {
        ev.should.be.an.instanceOf(Server.Event);
      }
      // JSON stringification is actually memoized.
      this._socket.emit(SERVER_EVENT, ev.toJSON());
    }
    catch(err) {
      return done(err);
    }
    return done(null);
  },
  function flush(done) {
    if(this._socket !== null) {
      this._socket.disconnect();
      this._socket = null;
    }
    return done(null);
  }
);

class Link extends LinkDuplex {
  constructor(socket) {
    if(__DEV__) {
      isSocket(socket).should.be.true;
    }
    super();
    _.bindAll(this);
    Object.assign(this, {
      _socket: socket,
    });
    this._socket.on(CLIENT_EVENT, this._receiveFromSocket);
    this._socket.on('disconnect', this.end);
  }

  _receiveFromSocket(json) {
    if(__DEV__) {
      json.should.be.a.String;
    }
    const ev = Client.Event.fromJSON(json);
    if(__DEV__) {
      ev.should.be.an.instanceOf(Client.Event);
    }
    this.push(ev);
  }
}

class ServerAdapter extends Server.Adapter {
  constructor(port, socketOpts = {}, expressOpts = {}) {
    if(__DEV__) {
      port.should.be.a.Number;
      socketOpts.should.be.an.Object;
      expressOpts.should.be.an.Object;
    }
    super();
    _.bindAll(this);
    const app = express(expressOpts);
    const server = http.Server(app);
    app.use(cors());
    const io = SocketIOServer(server); // bind socket.io handlers first
    Object.assign(this, {
      _port: port,
      _app: app,
      _server: server,
      _io: io,
      _published: {},
      _events: new EventEmitter(),
    });

    app.get('*', ({ path }, res) => { // then bind get default handler
      if(this._published[path] === void 0) {
        return res.status(404).json({ err: `Unknown path: ${path}` });
      }
      // JSON stringification is actually memoized.
      return res.status(200).json(this._published[path].toJSON());
    });
    io.on('connection', (socket) => this._events.emit(CONNECTION, new Link(socket)));

    server.listen(port);
  }

  publish(path, consumer) {
    if(__DEV__) {
      path.should.be.a.String;
      consumer.should.be.an.instanceOf(Remutable.Consumer);
    }
    this._published[path] = consumer;
  }

  onConnection(accept, lifespan) {
    if(__DEV__) {
      accept.should.be.a.Function;
      lifespan.should.have.property('then').which.is.a.Function;
    }
    this._events.addListener(CONNECTION, accept, lifespan);
  }
}

export default {
  Adapter: ServerAdapter, // 'nexus-flux-socket.io/dist/server'.
};
