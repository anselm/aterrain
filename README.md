## aframe-aterrain-component

[![Version](http://img.shields.io/npm/v/aframe-aterrain-component.svg?style=flat-square)](https://npmjs.org/package/aframe-aterrain-component)
[![License](http://img.shields.io/npm/l/aframe-aterrain-component.svg?style=flat-square)](https://npmjs.org/package/aframe-aterrain-component)

A 3d geographic rendering component for AFrame that uses Cesium data.

For [A-Frame](https://aframe.io).

### Examples

Here's an example of rendering a specific piece of the world at street level. In this case at the Coquetta Cafe on the Embarcadero in San Francisco with 3d buildings.

<a href="https://anselm.github.io/aterrain/examples/sanfrancisco"> <img alt="sanfrancisco" target="_blank" src="https://github.com/anselm/aterrain/blob/master/examples/assets/sanfrancisco.png?raw=true" width="660"></a>

Here is an example of using ATerrain as a globe renderer. In this example aterrain is observing the camera and adjusting what it shows dynamically so that the viewer sees that part of the earth at ever increasing levels of detail.

<a href="https://anselm.github.io/aterrain/examples/helloworld">
  <img alt="hello world" target="_blank" src="https://github.com/anselm/aterrain/blob/master/examples/assets/helloworld.png?raw=true" width="660">
</a>

Here is an example of the full globe dropped into the basic demo scene.

<a href="https://anselm.github.io/aterrain/examples/hellowebvr_globe">
  <img alt="hello world" target="_blank" src="https://github.com/anselm/aterrain/blob/master/examples/assets/hellowebvr_globe.png?raw=true" width="660">
</a>

Here is an example of the Grand Canyon.

<a href="https://anselm.github.io/aterrain/examples/grandcanyon">
  <img alt="hello world" target="_blank" src="https://github.com/anselm/aterrain/blob/master/examples/assets/grandcanyon.png?raw=true" width="660">
</a>

### A-Terrain API

| Property        | Description  | Default Value |
| --------------- | ------------ | ------------- |
| latitude        | latitude     |   37.7983222  |
| longitude       | longitude    | -122.3972797  |
| elevation       | for lod      | 600           |
| radius          | planet size  | 6372798       |
| world_radius    | planet size  | 6372798       |
| observer        | who to watch | #camera       |
| stretch         | height scale | 1             |
| groundTexture   | texture fx   |               |
| buildingTexture | texture fx   |               |

A-Terrain is the main AFrame component that you interact with. It is a wrapper to manage a bunch of individual A-Tile, A-Building and A-Location objects. You give it a longitude, latitude and elevation and it will make sure that that piece of the planet is rendered.

There are two slight variations in the way it will render the planet.
1) If you specify an observer (which is a DOM node id such as "#camera") then A-Terrain will paint tiles to cover the visible portion of the globe at the given elevation. For example if you used an elevation like 600 (meters above sea level) and you were over the default latitude and longitude (San Francisco) then it would paint a few tiles around downtown San Francisco at almost street level.
2) If you do not specify an observer then it will move and orient the entire globe so that you're standing on the ground at that point on the globe. By this I mean it moves and rotates the surface of the globe to intersect (0,0,0). This is intended to reduce the hassle of having to deal with spherical coordinates.

### A-Tile API

| Property        | Description  | Default Value |
| --------------- | ------------ | ------------- |
| lat             | latitude     |   37.7983222  |
| lon             | longitude    | -122.3972797  |
| elevation       | for lod      | 600           |
| radius          | planet size  | 6372798       |
| world_radius    | planet size  | 6372798       |
| stretch         | height scale | 1             |
| buildingTexture | texture fx   |               |

It's possible to make tile objects by themselves - which can be handy for some interactions. These properties are the same as A-Terrain.

### A-Location API

| Property        | Description  | Default Value |
| --------------- | ------------ | ------------- |
| lat             | latitude     |   37.7983222  |
| lon             | longitude    | -122.3972797  |
| elevation       | for lod      | 600           |
| radius          | planet size  | 6372798       |
| world_radius    | planet size  | 6372798       |
| stretch         | height scale | 1             |

As a convenience concept an A-Location wrapper will place a given object at that place on the globe. For example <a-entity a-terrain><a-entity a-location="lat:12; lon:-112"><a-entity myduck></a-entity></a-entity></a-entity> will place your duck at the specified latitude and longitude.


### Installation

#### Browser

Use in the browser with an html document like so:

```html
<script src="https://aframe.io/releases/0.7.1/aframe.min.js"></script>
<script src="../js/aframe-orbit-controls-component.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/webpack-cesium/1.37.0/webpack.cesium.js"></script>
<script src="../../dist/aframe-aterrain-component.js"></script>
<a-scene>
<a-entity a-terrain="follow:0; fovpad:2; latitude:37; longitude:-122; radius:1000; elevation:580000"></a-entity>
<a-entity id="camera" camera="fov:45" mouse-cursor position="0 0 5000"></a-entity>
</a-scene>
```

Or to [see a single tile on demand](https://anselm.github.io/aterrain/examples/helloworld/tile.html):

```html
<a-box id="target" width="10" height="10" depth="100"></a-box>
<a-entity id="camera" camera="fov:45" mouse-cursor position="0 0 700"></a-entity>
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

#### Data sources and Technology

This engine licenses the [Cesium ion dataset](https://cesium.com/blog/2018/03/01/hello-cesium-ion/) with a freely usable test dataset of the San Francisco Bay Area. Buildings are provided only for SF, and elevation data is provided for the world. For industrial or commercial uses you'll want to talk to the folks at Cesium directly. It's also worth noting that the implementation here is focused on street-level cases. For a technical perspective on some of the challenges of building a fully featured globe renderer see [Cesium Presentation](https://cesium.com/presentations) and [3D Engine Design for Virtual Globes](https://www.virtualglobebook.com/).
