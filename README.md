What is this?

  + See https://anselm.github.io/aterrain_game/public/index.html?name=joe for an example of this running
  + A space to face globe of the earth with buildings, leveraging cesium and cesium datasets
  + Intended to be a thin wrapper on cesium but has ended up doing a bit more heavy lifting
  + A focus on street level walking around; so precision and accuracy is important
  + sits on top of 3js
  + aframe based (this part is a fairly thin wrapper and it is easy to swap it out)
  + there is a thin multiplayer game on top of the globe to showcase the globe
  + open source, no license right now, do whatever you want with it

Lots of bugs left:

  + Still some issues with gudermannian deprojection of mercator and determining which tiles are visible
  + Looks like the tiles I'm asking for may be illegal in some cases - needs study
  + See the issues list in github

General todos:

  + Needs a nicer camera navigation syistem
  + Server was using sockets but I had some issues; switch back to sockets
  + Put the server somewhere stable on the internet
  + Maybe offer a side globe as a radar view?
