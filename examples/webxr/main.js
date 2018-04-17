
class ARAnchorExample extends XRExampleBase {

	constructor(domElement){
		super(null, false, true, true)
	}

	initializeScene() {
	}

	updateScene(frame) {
	}
}

window.addEventListener('DOMContentLoaded', () => {
	let app = new ARAnchorExample();
});

