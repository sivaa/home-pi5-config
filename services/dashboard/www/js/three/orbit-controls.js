/**
 * OrbitControls for Three.js r128
 * Camera controls for 3D floor plan view
 */

export function OrbitControls(object, domElement) {
  this.object = object;
  this.domElement = domElement;
  this.target = new THREE.Vector3();
  this.minDistance = 0;
  this.maxDistance = Infinity;
  this.minPolarAngle = 0;
  this.maxPolarAngle = Math.PI;
  this.enableDamping = false;
  this.dampingFactor = 0.05;
  this.autoRotate = false;
  this.autoRotateSpeed = 2.0;

  var scope = this;
  var spherical = new THREE.Spherical();
  var sphericalDelta = new THREE.Spherical();
  var scale = 1;
  var panOffset = new THREE.Vector3();
  var rotateStart = new THREE.Vector2();
  var rotateEnd = new THREE.Vector2();
  var rotateDelta = new THREE.Vector2();
  var panStart = new THREE.Vector2();
  var panEnd = new THREE.Vector2();
  var panDelta = new THREE.Vector2();
  var dollyStart = new THREE.Vector2();
  var dollyEnd = new THREE.Vector2();
  var dollyDelta = new THREE.Vector2();

  var STATE = { NONE: -1, ROTATE: 0, DOLLY: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_PAN: 4, TOUCH_DOLLY_PAN: 5, TOUCH_DOLLY_ROTATE: 6 };
  var state = STATE.NONE;

  this.update = function() {
    var offset = new THREE.Vector3();
    var quat = new THREE.Quaternion().setFromUnitVectors(object.up, new THREE.Vector3(0, 1, 0));
    var quatInverse = quat.clone().invert();
    var lastPosition = new THREE.Vector3();
    var lastQuaternion = new THREE.Quaternion();

    return function update() {
      var position = scope.object.position;
      offset.copy(position).sub(scope.target);
      offset.applyQuaternion(quat);
      spherical.setFromVector3(offset);
      if (scope.autoRotate && state === STATE.NONE) sphericalDelta.theta -= 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;
      if (scope.enableDamping) {
        spherical.theta += sphericalDelta.theta * scope.dampingFactor;
        spherical.phi += sphericalDelta.phi * scope.dampingFactor;
      } else {
        spherical.theta += sphericalDelta.theta;
        spherical.phi += sphericalDelta.phi;
      }
      spherical.phi = Math.max(scope.minPolarAngle, Math.min(scope.maxPolarAngle, spherical.phi));
      spherical.makeSafe();
      spherical.radius *= scale;
      spherical.radius = Math.max(scope.minDistance, Math.min(scope.maxDistance, spherical.radius));
      if (scope.enableDamping) scope.target.addScaledVector(panOffset, scope.dampingFactor);
      else scope.target.add(panOffset);
      offset.setFromSpherical(spherical);
      offset.applyQuaternion(quatInverse);
      position.copy(scope.target).add(offset);
      scope.object.lookAt(scope.target);
      if (scope.enableDamping) {
        sphericalDelta.theta *= (1 - scope.dampingFactor);
        sphericalDelta.phi *= (1 - scope.dampingFactor);
        panOffset.multiplyScalar(1 - scope.dampingFactor);
      } else {
        sphericalDelta.set(0, 0, 0);
        panOffset.set(0, 0, 0);
      }
      scale = 1;
      return false;
    };
  }();

  function onPointerDown(event) {
    if (event.pointerType === 'touch') {
      // Skip for now - simplified
    } else {
      onMouseDown(event);
    }
  }

  function onPointerMove(event) {
    if (event.pointerType === 'touch') {
      // Skip for now - simplified
    } else {
      onMouseMove(event);
    }
  }

  function onPointerUp(event) {
    state = STATE.NONE;
    scope.domElement.releasePointerCapture(event.pointerId);
    scope.domElement.removeEventListener('pointermove', onPointerMove);
    scope.domElement.removeEventListener('pointerup', onPointerUp);
  }

  function onMouseDown(event) {
    event.preventDefault();
    scope.domElement.setPointerCapture(event.pointerId);
    scope.domElement.addEventListener('pointermove', onPointerMove);
    scope.domElement.addEventListener('pointerup', onPointerUp);
    if (event.button === 0) {
      state = STATE.ROTATE;
      rotateStart.set(event.clientX, event.clientY);
    } else if (event.button === 2) {
      state = STATE.PAN;
      panStart.set(event.clientX, event.clientY);
    }
  }

  function onMouseMove(event) {
    if (state === STATE.ROTATE) {
      rotateEnd.set(event.clientX, event.clientY);
      rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(0.005);
      sphericalDelta.theta -= rotateDelta.x;
      sphericalDelta.phi -= rotateDelta.y;
      rotateStart.copy(rotateEnd);
    } else if (state === STATE.PAN) {
      panEnd.set(event.clientX, event.clientY);
      panDelta.subVectors(panEnd, panStart).multiplyScalar(0.02);
      var v = new THREE.Vector3();
      v.setFromMatrixColumn(scope.object.matrix, 0);
      v.multiplyScalar(-panDelta.x);
      panOffset.add(v);
      v.setFromMatrixColumn(scope.object.matrix, 1);
      v.multiplyScalar(panDelta.y);
      panOffset.add(v);
      panStart.copy(panEnd);
    }
  }

  function onMouseWheel(event) {
    event.preventDefault();
    if (event.deltaY < 0) scale /= 0.95;
    else if (event.deltaY > 0) scale *= 0.95;
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  this.domElement.addEventListener('pointerdown', onPointerDown);
  this.domElement.addEventListener('wheel', onMouseWheel, { passive: false });
  this.domElement.addEventListener('contextmenu', onContextMenu);

  this.dispose = function() {
    scope.domElement.removeEventListener('pointerdown', onPointerDown);
    scope.domElement.removeEventListener('wheel', onMouseWheel);
    scope.domElement.removeEventListener('contextmenu', onContextMenu);
  };

  this.update();
}
