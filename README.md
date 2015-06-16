Nexus Flux socket.io Adapter
============================

##### [Nexus Flux](https://github.com/elierotenberg/nexus-flux)

Abstract Nexus Flux Diagram
```
    +-> Action.dispatch ---+--> Client.Events ---+--> Action.onDispatch -+
    |    Fire & forget             Stream                 Callback       |
Component logic         Adapter               Adapter               Global logic
    |      Callback                Stream               Fire & forget    |
    +-- Store.onUpdate  <--+--- Server.Events <--+------ Store.update ---+
```


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

Share global server-side app state across all connected clients.

```js
// Client side: runs in the browser or in a node process
import Client from 'nexus-flux-socket.io/client';
const client = Client('http://localhost:8080'));
```

```js
// Server side: runs in a node process, which may or may not be the same process
import Server from 'nexus-flux-socket.io/server';
const server = new Server(8080);
```

#### Client usage example (in a React view)

```js
{
  getInitialState() {
    this.lifespan = new Lifespan();
    return {
      todoList: this.props.flux.Store('/todo-list', this.lifespan).value,
    };
  }

  componentWillMount() {
    this.props.flux.Store('/todo-list', this.lifespan)
    .onUpdate(({ head }) => this.setState({ todoList: head }))
    .onDelete(() => this.setState({ todoList: void 0 }));
    this.removeItem = this.props.flux.Action('/remove-item', this.lifespan).dispatch;
  }

  componentWillUnmount() {
    this.lifespan.release();
  }

  render() {
    return this.state.todoList ? todoList.map((item, name) =>
      <div onClick={() => this.removeItem({ name })}>
        {item.get('description')} (Click to remove)
      </div>
    ) : null;
  }
}
```

#### Server usage example

```js
const todoList = server.Store('/todo-list', myApp.lifespan);
const removeItem = server.Action('/remove-item', myApp.lifespan);

todoList
.set('first', { description: 'My first item' })
.set('second', { description: 'My second item' })
.set('third', { description: 'My third item' })
.commit();

removeItem.onDispatch((clientID, { name }) => {
  todoList.delete(name).commit();
});
```

#### Installation

This package is written in ES6/7. You will need `babel` to run it.
