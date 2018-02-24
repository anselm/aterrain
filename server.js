
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// http server
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var http = require('http'),
    path = require('path'),
    methods = require('methods'),
    express = require('express'),
    bodyParser = require('body-parser'),
    session = require('express-session'),
    cors = require('cors'),
    passport = require('passport'),
    errorhandler = require('errorhandler');

var isProduction = process.env.NODE_ENV === 'production';

var app = express();

app.use(cors());
app.use(require('morgan')('dev'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(require('method-override')());
app.use(express.static(__dirname + '/public'));
app.use(session({ secret: 'suchsecret', cookie: { maxAge: 60000 }, resave: false, saveUninitialized: false  }));

/* not needed
let entities = {};
app.put("/api/save",function (req, res) {
  entities[req.body.id] = req.body;
  console.log("============== got an entity ==========");
  console.log(req.body);
  res.send(200);
});
app.get("/api/query",function(req,res) {
  console.log("getting ==== ");
  console.log(entities);
  res.json(entities);
});
*/

if (!isProduction) {
  app.use(errorhandler());
}

app.use(function(req, res, next) {
  // catch 404 and forward to error handler
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use(function(err, req, res, next) {
  if(!isProduction) {
    // if not production then log error internally
    console.error(err);
  } else {
    // don't leak stack trace to user
    err = { status: 500, message:"internal error" };
  }
  res.status(err.status || 500);
  res.json({'errors': {
    message: err.message,
    error: {}
  }});
});

let port = process.env.PORT || 8000;

var server = app.listen(port, function(){
  // server has been started
  console.log('Listening on port ' + server.address().port);
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// game state
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class State {

  constructor() {
    this.entities = {};
  }

  save(data,socket_id) {
    // TODO improve saving later
    data.socket_id = socket_id;
    entities[data.id] = data;
  }

}

State.instance = function() {
  if(!State.state) State.state = new State();
  return State.state;
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// sockets gateway
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
var io = require('socket.io')(server, {
  path: '/',
  serveClient: false,
  pingInterval: 10000,
  pingTimeout: 5000,
  cookie: false
});

var clients = {};

var connection = io.of('/chat').on('connection', function (socket) {
    console.log('got a connection');
    socket.on('disconnect', function () {
        var clientState = clients[socket.id];
        delete clients[socket.id];
        console.log('user disconnected');
    }).on('test', function (data) {
    	console.log("hello");
    }).on('test2', function (data) {
        //State.instance().save(data,socket.id);
        //socket.broadcast.emit('sync',changes);
    });
});

// - i probably need rooms or regions or a way to send traffic only to a subset of the users

// - one pattern is that i immediately broadcast changes to all users... which is fine...
// - another pattern is i periodically reup everybody ... also fine
// - another pattern is i return a rollup at the end of a sync... i don't like this pattern

//     socket.broadcast.emit('spawn', clientState);
*/

