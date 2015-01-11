Nexus Flux socket.io Adapter
============================

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
