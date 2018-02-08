
//
// A wrapper for server state
// Also a place to store local transient state
// Also allows registration of observers for state changes
//

class State {

  login(args) {
  }

  signup(args) {
  }

  logout(args) {
  }

  query(args) {
  }

  post(args) {
  }

  remove(args) {
  }

  observe(args) {
  }

};

State.instance = function() {
  if(!State.state) {
    State.state = new State();
  } 
  return State.state;
};

//////////////////////////////////////////////////////////////////////////////////////////////////////
//
// user profile and tokens 
//
//////////////////////////////////////////////////////////////////////////////////////////////////////

AFRAME.registerComponent('aframe-profile', {

  init: function() {
    // State.instance().observe("user",this.updateUser);
    this.updateUser();
  },

  updateUser: function(user) {

    if(!this.userEntity) {
      // add visual representation of user to display
      this.userEntity = document.createElement('a-entity');
      this.userEntity.setAttribute('a-sphere',{ position="0 0 0", radius:"1" color="#ef2d5e", shadow=true });
      this.el.appendChild(this.userEntity);
    }

    if(!this.userTokens) {
      // add visual representation of user tokens to display
      this.userTokens = document.createElement('a-entity');
      this.userTokens.setAttribute('a-sphere',{ position="0 0 0", radius:"1" color="#ef2d5e", shadow=true });
      this.el.appendChild(this.userTokens);

      this.userTokens.addEventListener('click', function (evt) {
        console.log('I was clicked at: ', evt.detail.intersection.point);
      });
    }
  },

};


//////////////////////////////////////////////////////////////////////////////////////////////////////

/*

<!-- main game screen -->
<a-entity visible="true">

  <!-- game map -->
  <a-entity a-terrain="lat:37.7749; lon:-122.4194; lod:15; radius:1000; elevation:1000">
  </a-entity>

  <!-- a game menu bar with some buttons -->
  <a-entity>
  </a-entity>

</a-entity>

<!-- your profile and stuff -->
<a-entity a-profile visible="false">

</a-entity>

<!-- camera and cursor -->
<a-entity camera>
  <a-entity cursor="fuse: true; fuseTimeout: 500"
            position="0 0 -1"
            geometry="primitive: ring; radiusInner: 0.02; radiusOuter: 0.03"
            material="color: black; shader: flat">
  </a-entity>
</a-entity>


*/



 
