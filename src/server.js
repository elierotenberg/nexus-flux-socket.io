import { Client, Server } from 'nexus-flux';
const { Link } = Server;
import express from 'express';
import cors from 'cors';
import http from 'http';
import IOServer from 'socket.io';
import Remutable from 'remutable';
import { DEFAULT_SALT } from './common';

function isSocket(obj) { // ducktype-check
  return _.isObject(obj) && _.isFunction(obj.emit) && _.isFunction(obj.addListener) && _.isFunction(obj.removeListener);
}

class SocketIOLink extends Link {
  constructor(io, salt = DEFAULT_SALT) {
    if(__DEV__) {
      isSocket(io).should.be.true;
      salt.should.be.a.String;
    }
    this._io = io;
    this._salt = salt;
    const nsp = io.of('/');
    nsp.addListener(this._salt, this.receiveFromSocket);
    super();
    nsp.addListener('disconnect', this.lifespan.release);
    this.lifespan.onRelease(() => {
      nsp.removeListener(this._salt, this.receiveFromSocket);
      nsp.removeListener('disconnect', this.lifespan.release);
      this._io.disconnect();
      this._io = null;
    });
  }

  sendToClient(ev) {
    if(__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    this._io.emit(this._salt, ev.toJSON());
  }

  receiveFromSocket(json) {
    if(__DEV__) {
      json.should.be.a.String;
    }
    const ev = Client.Event.fromJSON(json);
    if(__DEV__) {
      ev.should.be.an.instanceOf(Client.Event);
    }
    this.receiveFromClient(ev);
  }
}

class SocketIOServer extends Server {
  // port is the port to listen to
  // salt is a disambiguation salt to allow multiplexing
  // sockOpts is passed to socket.io Server constructor
  // expressOpts is passed to express constructor
  constructor(port, salt = DEFAULT_SALT, sockOpts = {}, expressOpts = {}) {
    if(__DEV__) {
      port.should.be.a.Number.which.is.above(0);
      salt.should.be.a.String;
      sockOpts.should.be.an.Object;
      expressOpts.should.be.an.Object;
    }
    sockOpts.pingTimeout = sockOpts.pingTimeout || 5000;
    sockOpts.pingInterval = sockOpts.pingInterval || 5000;
    super();
    this._port = port;
    this._salt = salt;
    this._app = express(expressOpts);
    this._http = http.Server(this._app);
    this._app.use(cors());
    this._io = IOServer(this._http, sockOpts);
    const nsp = this._io.of('/');
    this._public = {};
    this._app.get('*', ({ path }, res) => {
      if(this._public[path] === void 0) {
        return res.status(404).json({ err: `Unknown path: ${path}` });
      }
      return res.status(200).json(this._public[path].toJSON());
    });

    nsp.addListener('connection', this.acceptConnection);

    this.lifespan.onRelease(() => {
      nsp.removeListener('connection', this.acceptConnection);
      this._io.close();
      this._io = null;
      this._http.close();
      this._app = null;
      this._http = null;
      this._public = null;
    });

    this._app.listen(this._port);
  }

  publish(path, remutableConsumer) {
    if(__DEV__) {
      path.should.be.a.String;
      remutableConsumer.should.be.an.instanceOf(Remutable.Consumer);
    }
    this._public[path] = remutableConsumer;
  }

  acceptConnection(io) {
    if(__DEV__) {
      isSocket(io).should.be.true;
    }
    this.acceptLink(new SocketIOLink(io, this._salt));
  }
}

export default SocketIOServer;
