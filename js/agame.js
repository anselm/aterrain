
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// State manages all the game state, and obervers can listen to state changes if they wish...
//
// ...also has some helpers to produce 3js and aframe objects consistently in one place from state...
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class State {

  constructor() {
    this.entities = [];
    this.observers = {};
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  login(args) {
  }

  signup(args) {
  }

  logout(args) {
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  observe(name,callback) {
    // TODO this is an idea of adding an observer; in my thinking here it would query for the data if it did not have it
    this.observers[name] = callback;
    this.query(name);
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

  remove(args) {
  }

  update_locally_one(hash) {

    // alternatively the elements could be made from meshes by hand
    //    GLTFLoader.load(hash.src,function(gltf) {
    //      scope.el.setObject3D('mesh',gltf.scene);
    //    });

    let id = hash.id?hash.id:State.instance().generateUID();
    // TODO is it already there? just freshen if so
    // TODO deal with deletions? or mark/sweep

    // make an aframe element to represent this database record
    let element = document.createElement(hash.element?hash.element:"a-entity");
    element.id = id;
    Object.keys(hash).forEach( key => element.setAttribute(key,hash[key]) );
    this.entities.push(element);
  }

  update_locally_all(json) {
    for(let i = 0; i < json.length; i++) {
      this.update_locally_one(json[i]);
    }
    // advise observers of entities that there are entity changes
    let callback = this.observers["entities"];
    if(callback) {
      callback(this.entities);
    }
  }

  query(args) {
    // TODO support richer queries!!!
    let url = "api/data.json";
    fetch(url).then(response => response.json()).then(json => this.update_locally_all(json));
  }

};

State.instance = function() {
  if(!State.state) {
    State.state = new State();
  } 
  return State.state;
};

//////////////////////////////////////////////////////////////////////////////////////////////////////
// game map
//   - shows the map and game elements on the map
//   - 
//////////////////////////////////////////////////////////////////////////////////////////////////////

AFRAME.registerComponent('agame-map', {
  init: function() {
    //State.instance().observe("entities",results => this.updateView(results) );
  },
  updateView: function(entities) {
  },
});

//////////////////////////////////////////////////////////////////////////////////////////////////////
// game user profile
//////////////////////////////////////////////////////////////////////////////////////////////////////

AFRAME.registerComponent('agame-profile', {

  init: function() {
    State.instance().observe("entities",results => this.updateView(results) );
  },

  updateView: function(entities) {
    for(let i = 0; i < entities.length; i++) {
      let element = entities[i];
      if(element.id == "user") {
        element.setAttribute("position","-4 2 0");
      } else {
        let x = i % 8 - 4;
        let y = -Math.floor(i/8);
        element.setAttribute("position",x + " " + y + " 0");
        element.addEventListener("click",function(evt) {
          console.log("I touched a duck and I liked it ", evt.detail.target.id);
        });
      }
      this.el.appendChild(element);
    }    
  },

});

