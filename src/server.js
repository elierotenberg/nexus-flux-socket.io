import { Client, Server } from 'nexus-flux';
const { Link } = Server;
import express from 'express';
import createError from 'http-errors';
import cors from 'cors';
import http from 'http';
import IOServer from 'socket.io';
import { DEFAULT_SALT } from './common';

// ducktype-check
function isSocket(obj) {
  return _.isObject(obj) && _.isFunction(obj.emit) && _.isFunction(obj.addListener) && _.isFunction(obj.removeListener);
}

class SocketIOLink extends Link {
  constructor(socket, salt = DEFAULT_SALT) {
    super();
    if(__DEV__) {
      isSocket(socket).should.be.true;
      salt.should.be.a.String;
    }
    this._socket = socket;
    this._salt = salt;
    _.bindAll(this, ['sendToClient', 'receiveFromSocket']);
    socket.on(this._salt, this.receiveFromSocket);
    socket.on('disconnect', this.lifespan.release);
    this.lifespan.onRelease(() => {
      try {
        socket.disconnect();
      }
      catch(err) {
        console.warn(err);
      }
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

/**
 * @abstract
 */
class SocketIOServer extends Server {
  // port is the port to listen to
  // salt is a disambiguation salt to allow multiplexing
  // sockOpts is passed to socket.io Server constructor
  // headers is an object of HTTP's response headers to use
  // expressUse is an array of middlewares to use
  constructor(port, salt = DEFAULT_SALT, sockOpts = {}, headers = {}, expressUse = []) {
    super();
    if(__DEV__) {
      port.should.be.a.Number.which.is.above(0);
      salt.should.be.a.String;
      sockOpts.should.be.an.Object;
      headers.should.be.an.Object;
      expressUse.should.be.an.Array;
      this.constructor.should.not.be.exactly(SocketIOServer); // ensure abstract
      this.serveStore.should.not.be.exactly(SocketIOServer.prototype.serveStore); // ensure virtual
    }
    sockOpts.pingTimeout = sockOpts.pingTimeout || 5000;
    sockOpts.pingInterval = sockOpts.pingInterval || 5000;

    this._salt = salt;
    const app = express();
    app.use(...expressUse.concat(cors()));
    const server = http.Server(app); // eslint-disable-line new-cap
    const io = new IOServer(server, sockOpts);
    server.listen(port);
    app.get('*', (req, res) => this.serveStore(req)
      .then((json) => res.set(headers).type('json').send(json))
      .catch((error) => {
        if(error.status !== void 0) {
          res.status(error.status).json(error);
        }
        else {
          res.status(500).json(error);
        }
      }));
    io.on('connection', (socket) => this.acceptConnection(socket));

    this.lifespan.onRelease(() => {
      io.close();
    });
  }

  serveStore({ path }) {
    return Promise.try(() => {
      if(__DEV__) {
        path.should.be.a.String;
      }
      throw createError(404, 'Virtual method invocation, you have to define serveStore function.');
    });
  }

  acceptConnection(socket) {
    if(__DEV__) {
      isSocket(socket).should.be.true;
    }
    this.acceptLink(new SocketIOLink(socket, this._salt));
  }
}

export default SocketIOServer;
