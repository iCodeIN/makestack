const { server } = require("makestack");

server.http.get("/foo", (req, res) => {
    res.send("Hello from foo!\n\n");
});
