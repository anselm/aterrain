# ATerrain

Allows rendering of a globe or parts of a globe with elevation, images and buildings.

## Examples

  - See https://anselm.github.io/aterrain_game/public/index.html?name=joe for an example of this running

## Features

  - produce the whole earth or pieces of the earth with elevation, imagery and buildings on demand
  - intended to work with <a href="http://github.com/aframevr">AFrame</a> to allow declarative embedding of cartographic data in html
  - leverages Cesium for most of the heavy lifting (although there is a bit of work in the wrapper itself)
  - avoids the use of custom shaders - geometries can be used for collision detection
  - navigation controls
  - open source

## Usage

```html
<html>
<head>
<script src="https://aframe.io/releases/0.7.1/aframe.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/webpack-cesium/1.37.0/webpack.cesium.js"></script>
<script src="js/aterrain/GLTFLoader.js"></script>
<script src="js/aterrain/math.js"></script>
<script src="js/aterrain/imageserver.js"></script>
<script src="js/aterrain/tileserver.js"></script>
<script src="js/aterrain/aterrain.js"></script>
<style>
body { background:#f0e0e0; overflow:hidden;}
</style>
</head>
<body>

<a-scene cursor="rayOrigin: mouse">

  <a-sphere radius=1050 wireframe=1 segments-height=18 segments-width=36></a-sphere>

  <a-entity a-terrain="lat:45.557749; lon:-122.6794; lod:3; radius:1000; elevation:263727982">

    <a-entity a-ll="lat:45.557749; lon:-122.6794; radius:10;">
      <a-entity rotation="-90 0 0" scale="0.3 0.3 0.3">
        <a-entity rotation="0 0 0">
           <a-animation attribute="rotation"
               dur="300"
               fill="forwards"
               from="0 0 0"
               to="0 360 0"
               repeat="indefinite"></a-animation>
          <a-gltf-model src="assets/duck.gltf"></a-gltf-model>
        </a-entity>
      </a-entity>
    </a-entity>

  </a-entity>

  <a-entity id="camera" camera="fov:60" mouse-cursor position="0 0 0">
  </a-entity>

</a-scene>

</body>
</html>
```

## Questions and Community

## Design approach currently chosen for connecting **Cesium** to **ThreeJS and AFrame**

### Use cases

A full globe cartographic renderer uses a tile based approach to render the planet surface. There is a pyramid of tiles at different resolutions that represent the terrain elevation and separately the images that are draped on the tiles. There are also 3d-tiles to represent buildings. A rendered view consists of fetching the visible sources at a given longitude, latitude and elevation from the ground and compositing them all together into a plausible view.

In the case of this engine it is possible to render a full globe - but the goal is more to be able to render a small piece of the earth. The use cases imagined are more focused on "near field" interactions such as exploring a city landscape on foot, or mixed reality use cases such as holding up a tablet (or wearing augmented reality glasses) and seeing a virtual world superimposed on the real world.

### Goals

Guiding the decisions here include:

- a desire to avoid re-inventing the wheel.
- a desire to allow remixing and reuse; where Cesium geometry can be collided against game object.
- a desire to avoid offering Cesium in a sense - if somebody wants Cesium then just use Cesium.

### Cesium

Cesium is a best of breed Virtual Globe with a superbly elegant and robust javascript implementation. The work is complex and precise, and represents years of labor, thought and architectural framing considerations and refactoring. For example see (Cesium Nasa Mars Trek)[https://marstrek.jpl.nasa.gov/]. For a technical perspective on the features of this globe viewer see [Cesium Presentation](https://cesium.com/presentations) and (3D Engine Design for Virtual Globes)[https://www.virtualglobebook.com/].

The architecture of Cesium (at a high level and skipping many details) can be seen as something like so:

  - Cesium Navigation Controls
  - Cesium Geography
    - TerrainProvider
    - ImageryProvider
    - 3d tiles (buildings)
  - Cesium Scene
    - Scene, Camera, SkyBox, SkyAtmosphere, 
    - Material, Color
    - Globe, Geometry, Polylines, Primitives, Billboards, Label
    - Shaders
  - Cesium Math
    - Frustrum
    - Bounding Boxes and Spheres
    - Cartographic number
    - Cartesian number
    - Matrix3 / Matrix4
    - Ellipsoid concept
    - Map Projection

### ThreeJS

As we can see above Cesium mplements effectively a high level 3d game engine in order to render the views to WebGL. That role collides with ThreeJS and it means that the lightweight composability of using Cesium data in a different context or application is slightly hampered. Depending on a programmers expertise it isn't that hard to repurpose raw tile data, but it makes quick lightweight tests and projects less likely. If some of the power of Cesium can be exposed to threejs (and later perhaps Babylon3d) then more people can embed earth data in their applications. The goal is to use the geographic powers of Cesium but switching to ThreeJS for WebGL bindings and Math.

### Current Choices

The approach currently looks something like this architecturally:

  - A-TERRAIN Navigation Controls ...
  - A-TERRAIN ... produces tiles on demand for a full globe coverage
    - A-LL ... an object placed on the globe
    - A-TILE ... a single tile of the globe
      - TileServer
        - Cesium TileProvider
        - Currently produce terrain tiles by hand into 3js
        - ** Currently this allows only spherical projection. It should allow flat and WGS84 **
        - ** Currently this does a reverse mercator or gudermannian distortion in vertex space to accomodate mercator projected image sources **
      - ImageServer
        - Cesium ImageProvider
        - ** Currently these images are in mercator and they should be converted to WGS84 using WASM **
  - AFrame
  - ThreeJS
  - WebGL

A-TERRAIN is a poor mans globe all by itself. It uses Cesium and allows zooming and panning to showcase the ability to produce a globe. However it lacks all of the features of Cesium and there are unresolved issues with respect to Camera zdepth (near/far) and suchlike.

To some degree this wrapper does more work than it should - and there is an ongoing effort to find ideal cleaving points between the two engines to see if this work can be reduced. With the help of Cesium there may also be some collaboration to push some of the features here to Cesium and thus reduce the weight on this engine. One key factor is that Cesium does much of the reprojection work with shaders, and there is a goal here to avoid shaders.


