import SocketIOClient from 'socket.io-client';
import through from 'through2';
import { Client, Server } from 'nexus-flux';
import { Requester } from 'immutable-request';

import { CLIENT_EVENT, SERVER_EVENT } from '../constants';

const ClientAdapterDuplex = through.ctor({ objectMode: true, allowHalfOpen: false },
  function receiveFromClient(ev, enc, done) { // Client -> Adapter
    try {
      if(__DEV__) {
        ev.should.be.an.instanceOf(Client.Event);
      }
      this._socket.emit(CLIENT_EVENT, ev.toJSON()); // Adapter -> Link
    }
    catch(err) {
      return done(err);
    }
    return done(null);
  },
  function flush(done) {
    try {
      if(this._socket !== null) {
        this._socket.disconnect();
        this._socket = null;
        this._requester.cancelAll();
        this._requester.reset();
        this._requester = null;
      }
    }
    catch(err) {
      return done(err);
    }
    return done(null);
  }
);

class ClientAdapter extends ClientAdapterDuplex {
  constructor(url, socketOpts = {}, requesterOpts = {}) { // https://github.com/automattic/socket.io-client#managerurlstring-optsobject
    socketOpts.timeout = socketOpts.timeout || 2000; // default timeout to 2000ms.
    if(__DEV__) {
      url.should.be.a.String;
      socketOpts.should.be.an.Object;
      requesterOpts.should.be.an.Object;
    }
    super();
    _.bindAll(this);
    Object.assign(this, {
      _socket: SocketIOClient(url, socketOpts),
      _requester: new Requester(url, requesterOpts),
    });
    this._socket.on(SERVER_EVENT, this._receiveFromSocket);
    this._socket.on('reconnect_failed', this.end);
  }

  disconnect() {
    this._socket.disconnect();
  }

  fetch(path, hash = null) {
    if(__DEV__) {
      path.should.be.a.String;
      (hash === null || _.isString(hash)).should.be.true;
    }
    if(hash) {
      if(path.indexOf('?') === -1) {
        path = `${path}?v=${hash}`;
      }
      else {
        path = `${path}&v=${hash}`;
      }
    }
    return this._requester.GET(path);
  }

  _receiveFromSocket(json) {
    if(__DEV__) {
      json.should.be.a.String;
    }
    const ev = Server.Event.fromJSON(json);
    if(__DEV__) {
      ev.should.be.an.instanceOf(Server.Event);
    }
    this.push(ev);
  }
}

export default {
  Adapter: ClientAdapter, // 'nexus-flux-socket.io/dist/client'.Adapter
};
