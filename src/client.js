import IOClient from 'socket.io-client';
import { Client, Server, Remutable } from 'nexus-flux';
import { Requester } from 'immutable-request';
import { DEFAULT_SALT } from './common';

class SocketIOClient extends Client {
  // uri is the endpoint which the client will attempt to connect to
  // salt is a disambiguation salt to allow multiplexing
  // sockOpts is passed to socket.io Client constructor
  // reqOpts is passed to Request constructor
  constructor(uri, salt = DEFAULT_SALT, sockOpts = {}, reqOpts = {}) {
    if(__DEV__) {
      uri.should.be.a.String;
      sockOpts.should.be.an.Object;
      reqOpts.should.be.an.Object;
    }
    sockOpts.timeout = sockOpts.timeout || 5000;
    this._uri = uri;
    this._sockOpts = sockOpts;
    this._salt = salt;
    this._requester = new Requester(uri, reqOpts);
    this._ioClient = null;
    super();
    this.lifespan.onRelease(() => {
      this._requester.cancelAll(new Error('Client lifespan released'));
      this._requester.reset();
      this._requester = null;
    });
  }

  get _io() { // lazily instanciate an actual socket; won't connect unless we need it.
    if(this._ioClient === null) {
      this._ioClient = IOClient(this._uri, this._sockOpts);
      const receiveFromSocket = (json) => this.receiveFromSocket(json);
      this._ioClient.on(this._salt, receiveFromSocket);
      this.lifespan.onRelease(() => {
        this._ioClient.off(this._salt, receiveFromSocket);
        this._ioClient.disconnect();
        this._ioClient = null;
      });
    }
    return this._ioClient;
  }

  fetch(path, hash = null) {
    if(__DEV__) {
      path.should.be.a.String;
      (hash === null || _.isNumber(hash)).should.be.true;
    }
    if(hash !== null) {
      path = path + ((path.indexOf('?') === -1) ? '?' : '&') + 'h=' + hash;
    }
    return this._requester.GET(path)
    .then((js) => {
      if(__DEV__) {
        js.should.be.an.Object;
      }
      return Remutable.fromJS(js);
    });
  }

  sendToServer(ev) {
    if(__DEV__) {
      ev.should.be.an.instanceOf(Client.Event);
    }
    this._io.emit(this._salt, ev.toJSON());
  }

  receiveFromSocket(json) {
    if(__DEV__) {
      json.should.be.a.String;
    }
    const ev = Server.Event.fromJSON(json);
    if(__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    this.receiveFromServer(ev);
  }
}

export default SocketIOClient;
