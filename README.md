## aframe-aterrain-component

[![Version](http://img.shields.io/npm/v/aframe-aterrain-component.svg?style=flat-square)](https://npmjs.org/package/aframe-aterrain-component)
[![License](http://img.shields.io/npm/l/aframe-aterrain-component.svg?style=flat-square)](https://npmjs.org/package/aframe-aterrain-component)

A 3d geographic rendering component for AFrame that uses Cesium data.

For [A-Frame](https://aframe.io).

### Examples

Here's an example of rendering a specific piece of the world at street level. In this case at the Coquetta Cafe on the Embarcadero in San Francisco with 3d buildings. In this example the world scale is set to 1:1 and the lighting and z-buffering are all stressed to their limits due to the numerical scales used. (It's more practical to set a smaller radius for the planet).

<a href="https://anselm.github.io/aterrain/examples/sanfrancisco"> <img alt="sanfrancisco" target="_blank" src="https://github.com/anselm/aterrain/blob/master/examples/assets/sanfrancisco.png?raw=true" width="660"></a>

Here is an example of using ATerrain as a globe renderer. In this example aterrain is observing the camera and adjusting what it shows dynamically so that the viewer sees that part of the earth at ever increasing levels of detail. If you zoom into San Francisco you will see buildings. If you want a general globe renderer it's probably better to use Cesium since it has specialized features for rendering globes.

<a href="https://anselm.github.io/aterrain/examples/helloworld">
  <img alt="hello world" target="_blank" src="https://github.com/anselm/aterrain/blob/master/examples/assets/helloworld.png?raw=true" width="660">
</a>

Here is an example of the full globe dropped into the basic demo scene. Unfortunately it's not possible to render the entire globe at any level of detail, but you could have it watch the camera and as you got close enough to the globe it could update that portion of the display. But since camera movement is linear through space and zooming into the earths surface is logarithmic this would not provide the kind of level of detail you want. Another option would be to perhaps render the entire globe at some intermediate level of detail - such as at a level of depth 4 or 5 - this is more data but it would allow a static globe that you could get fairly close to.

<a href="https://anselm.github.io/aterrain/examples/hellowebvr_globe">
  <img alt="hello world" target="_blank" src="https://github.com/anselm/aterrain/blob/master/examples/assets/hellowebvr_globe.png?raw=true" width="660">
</a>

### API

| Property | Description | Default Value |
| -------- | ----------- | ------------- |
| lat      | latitude    | 0             |
| lon      | longitude   | 0             |
| radius   | planet size | 1000          |
| elevation| for lod     | 100000000     |
| fovpad   | extra tiles | 0             |
| observer | camera      |               |

Specify the latitude and longitude where you would like to see detail on the surface of the globe. This is where tiles will be generated. The elevation is used to estimate the level of detail, and this in turn dictates which layer of the tile pyramid will be used. A very small elevation would generate tiles that are very high resolution - and thus cover only a very small part of the earths surface. Fov padding can be used to force fetch some extra tiles (for example you may wish to render the entire world at a high resolution - so you could pick a lower elevation and pad it out with some extra tiles). If you specify an observer then the engine will automatically compute the latitude, longitude and elevation from the observers position in space relative to the globe. If you don't specify an observer then you need to set the latitude and longitude yourself - for example if you have a street level view of a city that you're interested in, but you also want to walk around in that city - then you have to update the position to fetch tiles so that you don't walk off the edge of visible tile space.

### Installation

#### Browser

Install and use by directly including the [browser files](dist):

```html
<head>
  <title>My A-Frame Scene</title>
  <script src="https://aframe.io/releases/0.6.0/aframe.min.js"></script>
  <script src="https://unpkg.com/aframe-aterrain-component/dist/aframe-aterrain-component.min.js"></script>
</head>

<body>
  <a-scene cursor="rayOrigin: mouse">
    <a-entity a-terrain="lat:45.557749; lon:-122.6794; radius:1000; elevation:263727982"></a-entity>
  </a-scene>
  <a-entity id="camera" camera="fov:45" mouse-cursor position="0 0 0"></a-entity>
</body>
```

#### npm

Install via npm:

```bash
npm install aframe-aterrain-component
```

Then require and use.

```js
require('aframe');
require('aframe-aterrain-component');
```

#### Design and Technology

This engine is built on top of Cesium and is focused on an on-the-ground walking around experience as opposed to a view-the-globe experience. Typically in a cartographic rendering component a developer has three kinds of uses. There's a space-to-face kind of view where you can see the whole globe and zoom in. There's a birds-eye street maps style navigation view like Google Maps. There's an on-the-ground walking around kind of view. This engine is focused on that last case. It can be used as a globe renderer but Cesium is better at that and there's no point in reproducing Cesium itself. For an on-the-ground view it's important that shaders not be used for generating geometry - we want geometry to be collidable in game - and that the engine be able to produce small slices of the world accurately.

I'm using a few specific pieces of Cesium (with support from the Cesium team for this work). Cesium is an excellent javascript 3d globe renderer but has slightly different goals from this engine. See [Cesium Nasa Mars Trek](https://marstrek.jpl.nasa.gov/). For a technical perspective on the features of Cesium see [Cesium Presentation](https://cesium.com/presentations) and [3D Engine Design for Virtual Globes](https://www.virtualglobebook.com/). For a deeper technical overview see [Under The Hood Of Virtual Globes](https://www.virtualglobebook.com/Under_the_Hood_of_Virtual_Globes.pdf). I only using the lowest level components - here's a quick sketch of that framework and dependencies:

  - Cesium Navigation Controls (aterrain doesn't use these nav controls)
  - Cesium Geography
    - TerrainProvider (aterrain uses this piece to fetch elevation data)
    - ImageryProvider (aterrain can use this or go directly to a raw provider)
    - 3d tiles (aterrain uses this piece to fetch and paint 3d buildings)
  - Cesium Scene (aterrain doesn't use any of the cesium scene graph support or any shaders at all)
    - Scene, Camera, SkyBox, SkyAtmosphere, 
    - Material, Color
    - Globe, Geometry, Polylines, Primitives, Billboards, Label
    - Shaders
  - Cesium Math (aterrain uses some of the math services)
    - Frustrum
    - Bounding Boxes and Spheres
    - Cartographic number
    - Cartesian number
    - Matrix3 / Matrix4
    - Ellipsoid concept
    - Map Projection

### Todo

  - For the SF case it would be nice to calculate the FOV better and to dynamically load tiles as the player moves around
  - It would be nice to not just use 0,0,0 but any specified displacement
  - Some folks want to be able to fly from point A to point B - this could be done by exposing the right hooks into the engine
  - An #MR use case would be nice; fairly easy to do at this point


