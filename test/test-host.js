const events = [
    {
        "type": "MapCrt",
        "t": 0,
        "x": 7,
        "y": 6,
        "map": [
            "SldBlk", "SldBlk", "SldBlk", "SldBlk", "SldBlk", "SldBlk", "SldBlk",
            "SldBlk", null,     null,     null,     "BrkBlk", null,     "SldBlk",
            "SldBlk", null,     "BrkBlk", null,     "BrkBlk", null,     "SldBlk",
            "SldBlk", null,     "BrkBlk", null,     "BrkBlk", null,     "SldBlk",
            "SldBlk", null,     "BrkBlk", null,     null,     null,     "SldBlk",
            "SldBlk", "SldBlk", "SldBlk", "SldBlk", "SldBlk", "SldBlk", "SldBlk"
        ]
    },
    {
        "type": "EleCrt",
        "t": 1000,
        "uid": 28,
        "name": "Tk",
        "x": 1.5,
        "y": 1.5,
        "player": "A"
    },
    {
        "type": "EleUpd",
        "t": 2000,
        "uid": 28,
        "rad": -1.0
    },
    {
        "type": "EleCrt",
        "t": 3000,
        "uid": 29,
        "name": "Tk",
        "x": 5.5,
        "y": 4.5,
        "rad": 3.14159,
        "player": "B"
    },
    {
        "type": "EleUpd",
        "t": 4000,
        "uid": 29,
        "rad": 2.14159
    },
    {
        "type": "EleCrt",
        "t": 5000,
        "uid": 30,
        "name": "Blt",
        "x": 2.0,
        "y": 1.5,
        "rad": 0.0
    }
];

const ws = require("ws");
const server = new ws.Server({
    port: 8080
});

server.on('connection', function(socket) {
    console.log(`Client connected!`);
    for(const event of events) {
        socket.send(JSON.stringify(event));
        console.log(`Sent ${JSON.stringify(event)} to client`);
    }
    socket.onmessage = event => {
        console.log(`Received \"${event.data}\" from client`);
    }
});