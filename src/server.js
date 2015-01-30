import { Client, Server, Remutable } from 'nexus-flux';
const { Link } = Server;
import express from 'express';
import cors from 'cors';
import http from 'http';
import IOServer from 'socket.io';
import { DEFAULT_SALT } from './common';

function isSocket(obj) { // ducktype-check
  return _.isObject(obj) && _.isFunction(obj.emit) && _.isFunction(obj.addListener) && _.isFunction(obj.removeListener);
}

class SocketIOLink extends Link {
  constructor(socket, salt = DEFAULT_SALT) {
    if(__DEV__) {
      isSocket(socket).should.be.true;
      salt.should.be.a.String;
    }
    this._socket = socket;
    this._salt = salt;
    super();
    _.bindAll(this, ['sendToClient', 'receiveFromSocket']);
    socket.on(this._salt, this.receiveFromSocket);
    socket.on('disconnect', this.lifespan.release);
    this.lifespan.onRelease(() => {
      socket.disconnect();
      this._socket = null;
    });
  }

  sendToClient(ev) {
    if(__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    this._socket.emit(this._salt, ev.toJSON());
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
    _.bindAll(this, [
      'publish',
      'serveStore',
      'acceptConnection',
    ]);

    this._salt = salt;
    this._public = {};
    const app = express(expressOpts).use(cors());
    const server = http.Server(app);
    const io = IOServer(server, sockOpts);
    server.listen(port);
    app.get('*', this.serveStore);
    io.on('connection', this.acceptConnection);

    this.lifespan.onRelease(() => {
      io.close();
      server.close();
      this._public = null;
    });
  }

  publish(path, remutableConsumer) {
    if(__DEV__) {
      path.should.be.a.String;
      remutableConsumer.should.be.an.instanceOf(Remutable.Consumer);
    }
    this._public[path] = remutableConsumer;
  }

  serveStore({ path }, res) {
    if(this._public[path] === void 0) {
      return res.status(404).json({ err: `Unknown path: ${path}` });
    }
    return res.status(200).type('application/json').send(this._public[path].toJSON());
  }

  acceptConnection(socket) {
    if(__DEV__) {
      isSocket(socket).should.be.true;
    }
    this.acceptLink(new SocketIOLink(socket, this._salt));
  }
}

export default SocketIOServer;
