Nexus Flux socket.io Adapter
============================

This package implements the [socket.io adapter for Nexus Flux](https://github.com/elierotenberg/nexus-flux) to implement Flux over the Wire.

Over the wire Nexus Flux Diagram using Websockets (with socket.io fallback)
```
in the browser        socket.io frames     in the server

Component #A1 <---+
                  |
Component #A2 <---+-- SocketIOAdapter -+
                  |      Client A      |
Component #A3 <---+                    |
                                       +-> Global logic
Component #B1 <---+                    |
                  |                    |
Component #B2 <---+-- SocketIOAdapter -+
                  |      Client B
Component #B3 <---+
```

#### Usage

In the client:

```js
import { Adapter } from 'nexus-flux-socket.io/dist/client';
import { Client } from 'nexus-flux';
let release;
const lifespan = new Promise((resolve) => release = resolve);
const client = new Client(new Adapter('http://localhost:8080'));
client.Store('/todoList', lifespan)
.onUpdate(({ head }) => console.warn('todoList updated', head))
.onDelete(() => console.warn('todoList deleted'));

client.Action('/removeItem').dispatch({ key: '42' }, lifespan);

setTimeout(release, 10000);
```

In the server:

```js
import { Adapter } from 'nexus-flux-socket.io/dist/server';
import { Server } from 'nexus-flux';
let release;
const lifespan = new Promise((resolve) => release = resolve);
const server = new Server(new Adapter(8080));
const todoList = client.Store('/todoList', lifespan);
todoList
.set('42', { name: 'Task #42', description: 'Do something useful with your life' })
.commit();

server.Action('/removeItem', lifespan)
.onDispatch(({ clientID, params }) => todoList.delete(params.key).commit());

setTimeout(release, 15000);
```
