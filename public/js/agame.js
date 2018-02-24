

///////////////////////////////////////////////////////////////////////////////////////////////////////
/// network - from https://github.com/ubik2/aframe-network-component/blob/master/index.js
///////////////////////////////////////////////////////////////////////////////////////////////////////
/*
AFRAME.registerSystem('network', {
  dependencies: ['position', 'rotation'],

  schema: {
    url: {
      type: 'string',
      default: null
    },
    port: {
      type: 'number',
      default: 4000
    },
    path: {
      type: 'string',
      default: '/chat'
    }
  },

  onNetworkConnect: function () {
    var self = this;
    // unfortunately, our position and rotation attributes aren't set when we call this
    self.socket.emit('spawn', {
      position: {x: 0, y: 0, z: 0},
      rotation: {x: 0, y: 0, z: 0}
    });
    self.socket.on('message', function (data) {
      console.log(data);
    }).on('spawn', function (data) {
      var entityEl = document.createElement('a-box');
      entityEl.setAttribute('network', {
        local: false,
        serverId: data.id
      });
      console.log("Spawning remote object: ", data.id);
      entityEl.setAttribute('position', data.position);
      entityEl.setAttribute('rotation', data.rotation);
      if (entityEl.components.material !== undefined) {
        entityEl.setAttribute('material', 'color', data.color);
      }
      var scene = document.querySelector('a-scene');
      scene.appendChild(entityEl);
      self.registerMe(entityEl);
    }).on('position', function (data) {
      var entityEl = self.entities[data.id];
      entityEl.setAttribute('position', data.position);
    }).on('rotation', function (data) {
      var entityEl = self.entities[data.id];
      entityEl.setAttribute('rotation', data.rotation);
    }).on('despawn', function (data) {
      console.log("Despawning remote object: ", data.id);
      var entityEl = self.entities[data.id];
      self.unregisterMe(entityEl);
      entityEl.parentNode.removeChild(entityEl);
    })
  },

  init: function () {
    this.entities = {};
    if (this.data.url == undefined || this.data.url == "") {
      this.data.url = location.protocol + '//' + location.hostname + ':' + this.data.port + this.data.path;
    }
    this.socket = io.connect(this.data.url);
    this.socket.on('connect', this.onNetworkConnect.bind(this));
  },

  registerMe: function (el) {
    this.entities[el.components.network.attrValue.serverId] = el;
  },

  unregisterMe: function (el) {
    delete this.entities[el.components.network.attrValue.serverId];
  },

  emit: function (message, data) {
    this.socket.emit(message, data);
  }
});
*/

/*
AFRAME.registerComponent('network', {
  schema: {
    local: { type: 'boolean' },
    serverId: { type: 'string' }
  },
  init: function () {
    if (this.data.local) {
      this.el.addEventListener('componentchanged', this.onComponentChanged.bind(this));
    }
  },

  onComponentChanged: function (evt) {
    if (evt.detail.name === 'position') {
      var oldData = this.lastPosition;
      var newData = evt.detail.newData;
      if (oldData == undefined || oldData.x !== newData.x || oldData.y !== newData.y || oldData.z !== newData.z) {
        this.system.emit('position', evt.detail.newData);
        this.lastPosition = newData;
      }
    } else if (evt.detail.name === 'rotation') {
      var oldData = this.lastRotation;
      var newData = evt.detail.newData;
      if (oldData == undefined || oldData.x !== newData.x || oldData.y !== newData.y || oldData.z !== newData.z) {
        this.system.emit('rotation', evt.detail.newData);
        this.lastRotation = newData;
      }
    }
  }
});

*/

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// State manages all the game state, and obervers can listen to state changes if they wish...
///
/// ...also has some helpers to produce 3js and aframe objects consistently in one place from state...
///
/// TODO - https://aframe.io/docs/0.7.0/core/systems.html  could do this
///
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class State {

  constructor() {
    this.entities = {};
    this.observers = {};
    this.url = "http://hook.org:8000";
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  authenticate(args) {

    // TODO this should post to server and then eventually I get back a user
    // TODO for now just make it here now
    // TODO nicks should be unique or something - or server just returns a uuid
    // TODO figure out how to disambiguate the user

    let name = args.name;

    let entity = {
      id:name,
      name:name,
      kind:"user",
      aframe: { element:"a-gltf-model", src:"assets/duck.gltf" },
      children:[ "b", "c", "d", "e", "f" ],
      lat:0,
      lon:0,
    };

    // store user here for uniqueness... may not need to do this? TODO
    this.user = entity;

    // ship it to the server
    this.save(entity);

    // make a visual representation of the user (this is not needed - the server should be authoritative TODO remove)
    this.visually_create_one(entity);

    // return user for convenience
    return entity;
  }

  signup(args) {
  }

  logout(args) {
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  observe(name,callback) {
    // TODO this is an idea of adding an observer; in my thinking here it would query for the data if it did not have it
    this.observers[name] = callback;

    // TODO for now re-query over and over
    window.setInterval(nothing => { this.query(name) }, 1000);
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  generateUID() {
    // https://stackoverflow.com/questions/6248666/how-to-generate-short-uid-like-ax4j9z-in-js
    var firstPart = (Math.random() * 46656) | 0;
    var secondPart = (Math.random() * 46656) | 0;
    firstPart = ("000" + firstPart.toString(36)).slice(-3);
    secondPart = ("000" + secondPart.toString(36)).slice(-3);
    return firstPart + secondPart;
  }

  save(hash) {
    // TODO throttle save events using a mark and sweep or some predictive model rather than saving EVERY event!
    // TODO sanitize better later
    hash = { id:hash.id, kind:hash.kind, lat:hash.lat, lon:hash.lon, name:hash.name, aframe:hash.aframe };
    let url = this.url+"/api/save";
    fetch(url, {
      method: 'PUT',
      body: JSON.stringify(hash), 
      headers: new Headers({ 'Content-Type': 'application/json' })
    });
    //.then(res => {  })
    //.catch(error => console.error('Error:', error))
    //.then(response => console.log('Success:', response));
  }

  remove(args) {
  }

  visually_create_one(entity) {
    if(this.entities[entity.id]) {
      // TODO should update not just return
      this.entities[entity.id].lat = entity.lat;
      this.entities[entity.id].lon = entity.lon;
      // TODO deal with deletions? or mark/sweep
      return;
    }
    let element = document.createElement(entity.aframe.element?entity.aframe.element:"a-entity");
    Object.keys(entity.aframe).forEach( key => {
      element.setAttribute(key,entity.aframe[key])
    });
    entity.element = element;
    entity.element.id = entity.id;
    this.entities[entity.id] = entity;
  }

  visually_create_all(json) {
    Object.keys(json).forEach( key => {
      let entity = json[key];
      this.visually_create_one(entity);
    });
    // advise observers of entities that there are entity changes
    let callback = this.observers["entities"];
    if(callback) {
      callback(this.entities);
    }
  }

  query(args) {
    // TODO support richer queries
    this.counter = this.counter ? this.counter + 1 : 1;
    let url = this.url+"/api/query?id="+this.counter;
    fetch(url).then(response => response.json()).then(json => this.visually_create_all(json));
  }

};

//////////////////////////////////////////////////////////////////////////////////////////////////////
// Global instance of state ... revisit this approach later TODO
//////////////////////////////////////////////////////////////////////////////////////////////////////

State.instance = function() {
  if(!State.state) State.state = new State();
  return State.state;
};

///////////////////////////////////////////////////////////////////////////////////////////////////////
/// game terrain view wrapper page
/// - also handles nav controls for now - TODO should move to some kind of utility class
/// - this code is a bit of a mess right now - refactor TODO
///////////////////////////////////////////////////////////////////////////////////////////////////////

AFRAME.registerComponent('agame-terrain', {

  // TODO is there a way to peek at aterrain?
  schema: {
           lat: {type: 'number', default:  45.557749 },
           lon: {type: 'number', default:  -122.6794 },
     elevation: {type: 'number', default:  6372798   },
        radius: {type: 'number', default:  100       },
  },

  init: function() {

    // Game controls for now... inelegant - should be a separate aframe widget TODO
    this.setup_some_game_controls();

    // fake a user from scratch from params for now ... later be better like have real login TODO
    let name = (new URLSearchParams(window.location.search)).get("name");
    if(!name) {
      alert("For now make up a unique name in the url parameters such as http://somewhere?name=" + State.instance().generateUID() );
      return;
    }

this.el.emit("a-terrain:navigate", {lat:this.data.lat, lon: this.data.lon, elevation:this.data.elevation }, false);

    return;

    // authenticate that user... with the state engine... now it is magically networked to all other instances too
    let user = State.instance().authenticate({name:name,password:"secret"});

    // for now get user long lat at least once ... get more often? TODO
    if (!navigator.geolocation) {
      alert("this game cannot be played without location services");
    } else {
      let gotit = 0;
      navigator.geolocation.getCurrentPosition(position => {
        if(gotit) return;
        gotit = 1;
        // update user on earth, also update where earth is for purposes of navigation
        this.data.lat = user.lat = position.coords.latitude;
        this.data.lon = user.lon = position.coords.longitude;
        State.instance().save(user);
        // tell game to paint at least once here also
        this.el.emit("a-terrain:navigate", {lat:this.data.lat, lon: this.data.lon, elevation:this.data.elevation }, false);
        // repaint it also - TODO this should not be needed - the server should send us state events
        this.visually_represent_one(user);
     });
    }

    // Watch for state changes in the database... also in this case it's going to force the server to go and sync state.
    State.instance().observe("entities",results => this.visually_represent_all(results) );

  },


  ll2v: function(lat,lon,r=1) {
    let latrad = lat * Math.PI / 180;
    let lonrad = lon * Math.PI / 180;
    // given a latitude and longitude in radians return a vector
    let phi = Math.PI/2-latrad;
    let theta = Math.PI/2+lonrad;
    let x = -r*Math.sin(phi)*Math.cos(theta);
    let z = r*Math.sin(phi)*Math.sin(theta);
    let y = r*Math.cos(phi);
    return new THREE.Vector3(x,y,z);
  },

  visually_represent_one: function(entity) {
    if(entity.element.parentNode != this.el) {
      // the state machine helps by making the element but it still has to be added to the scene
      console.log("had to add entity to scene " + entity.id);
      this.el.appendChild(entity.element);
    }
    // update place representationally at surface
    let v = this.ll2v(entity.lat,entity.lon,this.data.radius);
    entity.element.object3D.position.set(v.x,v.y,v.z);
    entity.element.object3D.lookAt( new THREE.Vector3(0,0,0) );
    console.log(" entity is at " + entity.id + " " + entity.lat );
  },

  visually_represent_all: function(entities) {
    let keys = Object.keys(entities);
    for(let i = 0; i < keys.length; i++) {
      this.visually_represent_one(entities[keys[i]]);
    }
  },

  setup_some_game_controls: function() {

    let dragging = 0;
    let dragstartx = 0;
    let dragstarty = 0;
    let dragstartlon = 0;
    let dragstartlat = 0;

    let world_radius = TileServer.instance().getRadius();
    let world_circumference = TileServer.instance().getCircumference();

    // allow click drag navigation around the globe
    window.addEventListener("mousedown", e => { dragging = 1; e.preventDefault(); });
    window.addEventListener("mouseup", e => { dragging = 0; e.preventDefault(); });
    window.addEventListener("mousemove", e => {
      if(dragging == 0) return;
      if(dragging == 1) {
        dragging = 2;
        dragstartx = e.clientX;
        dragstarty = e.clientY;
        dragstartlon = this.data.lon;
        dragstartlat = this.data.lat;
      }
      let x = e.clientX - dragstartx;
      let y = e.clientY - dragstarty;

      // roughly scale movement speed by current distance from surface
      this.data.lon = dragstartlon - x * this.data.elevation / world_circumference;
      this.data.lat = dragstartlat + y * this.data.elevation / world_circumference;

      // not critical but tidy up legal orientations
      if(this.data.lat > 80) this.data.lat = 80;
      if(this.data.lat < -80) this.data.lat = -80;
      if(this.data.lon < -180) this.data.lon += 360;
      if(this.data.lon > 180) this.data.lon -= 360;

      // Tell the terrain
      this.el.emit("a-terrain:navigate", {lat:this.data.lat, lon: this.data.lon, elevation:this.data.elevation }, false);

      // could also move the entity optionally - do this for now because it is fun to see in networked scenarios
      let user = State.instance().user;
      if(user) {
        user.lat = this.data.lat; // TODO really lat,lon should be treated as a single concept
        user.lon = this.data.lon;
        State.instance().save(user);
        this.visually_represent_one(user); // TODO this is not really needed because the server will update this
      }

      e.preventDefault();
    });

    // zooming 
    window.addEventListener("wheel",e => {

      // throw away the speed (which is varys by browser anyway) and just get the direction
      const direction = Math.max(-1, Math.min(1, e.deltaY));

      // zoom in/out - roughly scaled by current elevation
      this.data.elevation += this.data.elevation * direction * 0.1;

      // set far limit to the radius of the earth (TODO may want to make 1 = far and 0 = near... rather than hardcoded numbers)
      if(this.data.elevation > world_circumference/2) this.data.elevation = world_circumference/2;

      // set near limit to 1 meter
      if(this.data.elevation < 1) this.data.elevation = 1;

      // tell the terrain engine about this
      this.el.emit("a-terrain:navigate", {lat:this.data.lat, lon: this.data.lon, elevation:this.data.elevation }, false);

      e.preventDefault();
    });
  }

});

//////////////////////////////////////////////////////////////////////////////////////////////////////
// game user profile page
// tbd
//////////////////////////////////////////////////////////////////////////////////////////////////////

AFRAME.registerComponent('agame-profile', {

  init: function() {
    //State.instance().observe("entities",results => this.visually_represent_all(results) );
  },

  visually_represent_all: function(entities) {
    return; //
    let keys = Object.keys(entities);
    // TODO find the actual player - which should be directly retrievable
    for(let i = 0; i < keys.length; i++) {
      let entity = entities[keys[i]];
      if(entity.kind == "user") {
        // TODO must find THIS player not a player
        entity.element.setAttribute("position","-4 2 0");
      } else {
        // TODO must iterate THIS players children not all other nodes
        let x = i % 8 - 4;
        let y = -Math.floor(i/8);
        entity.element.setAttribute("position",x + " " + y + " 0");
        entity.element.addEventListener("click",function(evt) {
          console.log("I touched a duck and I liked it ", evt.detail.target.id);
        });
      }
      this.el.appendChild(entity.element);
    }    
  },

});

