/**
 * Network View - Zigbee Network Visualization
 * 3D floor plan showing Zigbee device positions and connectivity
 */

// Module-scoped state (outside Alpine's reactive system to avoid proxy issues)
const networkState = {
  scene: null,
  camera: null,
  renderer: null,
  roomMeshes: {},
  wallMeshes: [],
  wallNumberSprites: [],
  deviceMeshes: {},
  labelElements: {},
  signalElements: {},
  animationId: null,
  isInitialized: false,
  panOffset: { x: 0, z: 0 },
  isPanning: false,
  lastPanPos: { x: 0, y: 0 }
};

// Device configuration with types and icons
const ZIGBEE_DEVICES = [
  { id: 'coordinator', name: 'ZBBridge-P', type: 'coordinator', icon: '📡', room: 'living', x: 0.5, z: 0.4 },
  { id: 'router1', name: 'S60ZBTPF', type: 'router', icon: '📢', room: 'study', x: 0.8, z: 0.2 },
  { id: 'router2', name: 'S60ZBTPF', type: 'router', icon: '📢', room: 'living', x: 0.3, z: 0.3 },
  { id: 'sensor1', name: 'SNZB-02P', type: 'end-device', icon: '🌡️', room: 'bedroom', x: 0.2, z: 0.15 },
  { id: 'sensor2', name: 'SNZB-03P', type: 'end-device', icon: '🚶', room: 'kitchen', x: 0.5, z: 0.1 },
  { id: 'sensor3', name: 'SNZB-04P', type: 'end-device', icon: '🚪', room: 'bathroom', x: 0.85, z: 0.1 },
  { id: 'trv', name: 'TRVZB', type: 'end-device', icon: '🔥', room: 'bedroom', x: 0.1, z: 0.25 },
];

/**
 * Network View Factory Function
 * @param {Object} FLOOR_PLAN_CONFIG - Floor plan configuration
 * @returns {Object} Alpine component
 */
export function networkView(FLOOR_PLAN_CONFIG) {
  const centerX = FLOOR_PLAN_CONFIG.apartmentWidth / 2;
  const centerZ = FLOOR_PLAN_CONFIG.apartmentDepth / 2;

  return {
    showSignalRange: false,
    showLabels: false,
    showWallNumbers: false,
    autoRotate: false,
    rotationAngle: 0,
    zoomLevel: 2.0,
    deviceCount: ZIGBEE_DEVICES.length,
    routerCount: ZIGBEE_DEVICES.filter(d => d.type === 'router').length,
    endDeviceCount: ZIGBEE_DEVICES.filter(d => d.type === 'end-device').length,

    init() {
      this.waitForContainer();
    },

    waitForContainer() {
      const container = this.$refs.networkContainer;
      if (!container || container.clientWidth === 0 || container.clientHeight === 0) {
        setTimeout(() => this.waitForContainer(), 100);
        return;
      }

      if (networkState.isInitialized && networkState.renderer) {
        if (!container.contains(networkState.renderer.domElement)) {
          container.appendChild(networkState.renderer.domElement);
        }
        this.createLabels(container);
        this.onResize();
        return;
      }

      if (networkState.renderer) networkState.renderer.dispose();
      if (networkState.scene) networkState.scene.clear();
      if (networkState.animationId) cancelAnimationFrame(networkState.animationId);

      this.initScene();
      this.initCamera(container);
      this.initRenderer(container);
      this.initLighting();
      this.buildFloorPlan();
      this.addWallNumbers();
      this.createDevices();
      this.createLabels(container);
      this.setupPanControls(container);
      this.animate();
      networkState.isInitialized = true;

      window.addEventListener('resize', () => this.onResize());
    },

    initScene() {
      networkState.scene = new THREE.Scene();
      // Warm beige gradient background
      networkState.scene.background = new THREE.Color(0xE8DFD4);
    },

    initCamera(container) {
      const aspect = container.clientWidth / container.clientHeight;
      const frustumSize = 15;
      networkState.camera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2, frustumSize * aspect / 2,
        frustumSize / 2, frustumSize / -2, 0.1, 1000
      );
      networkState.camera.position.set(10, 10, 10);
      networkState.camera.lookAt(0, 0, 0);
    },

    initRenderer(container) {
      networkState.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      networkState.renderer.setSize(container.clientWidth, container.clientHeight);
      networkState.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      networkState.renderer.shadowMap.enabled = true;
      networkState.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(networkState.renderer.domElement);
    },

    initLighting() {
      const ambient = new THREE.AmbientLight(0xffffff, 0.7);
      networkState.scene.add(ambient);
      const directional = new THREE.DirectionalLight(0xffffff, 0.6);
      directional.position.set(15, 20, 15);
      directional.castShadow = false;  // No shadows anywhere
      networkState.scene.add(directional);
      const fill = new THREE.DirectionalLight(0xffffff, 0.3);
      fill.position.set(-10, 10, -10);
      networkState.scene.add(fill);
    },

    addWallNumbers() {
      // Clear existing wall number sprites
      networkState.wallNumberSprites.forEach(sprite => {
        networkState.scene.remove(sprite);
        if (sprite.material.map) sprite.material.map.dispose();
        sprite.material.dispose();
      });
      networkState.wallNumberSprites = [];

      // Add number labels at start, middle, end of each wall for precise identification
      const createNumberSprite = (text, color = '#FF0000') => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(32, 32, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(text), 32, 32);
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(0.4, 0.4, 1);
        return sprite;
      };

      // Direction labels by POSITION (reliable regardless of wall creation order)
      const getOuterWallDirection = (wall) => {
        const apartmentWidth = FLOOR_PLAN_CONFIG.apartmentWidth;
        const apartmentDepth = FLOOR_PLAN_CONFIG.apartmentDepth;
        const halfW = apartmentWidth / 2;
        const halfD = apartmentDepth / 2;
        const tolerance = 0.05;
        const lengthTolerance = 0.2;

        const params = wall.geometry.parameters;
        const isHorizontal = params.width > params.depth;
        const isVertical = params.depth > params.width;

        let result = null;

        if (isHorizontal && Math.abs(params.width - apartmentWidth) < lengthTolerance) {
          if (Math.abs(wall.position.z - (-halfD)) < tolerance) result = 'N';
          else if (Math.abs(wall.position.z - halfD) < tolerance) result = 'S';
        }

        if (isVertical && Math.abs(params.depth - apartmentDepth) < lengthTolerance) {
          if (Math.abs(wall.position.x - (-halfW)) < tolerance) result = 'W';
          else if (Math.abs(wall.position.x - halfW) < tolerance) result = 'E';
        }

        return result;
      };

      networkState.wallMeshes.forEach((wall, index) => {
        const geom = wall.geometry;
        const params = geom.parameters;
        const wx = wall.position.x;
        const wy = wall.position.y + 0.5;
        const wz = wall.position.z;

        const directionLabel = getOuterWallDirection(wall);

        const isHorizontal = params.width > params.depth;
        const wallLength = isHorizontal ? params.width : params.depth;
        const halfLen = wallLength / 2 * 0.8;

        const positions = isHorizontal
          ? [[wx - halfLen, wy, wz], [wx, wy, wz], [wx + halfLen, wy, wz]]
          : [[wx, wy, wz - halfLen], [wx, wy, wz], [wx, wy, wz + halfLen]];

        positions.forEach((pos, i) => {
          const label = directionLabel || index.toString();
          const color = directionLabel ? '#228B22' : (i === 1 ? '#FF0000' : '#0066CC');
          const sprite = createNumberSprite(label, color);
          sprite.position.set(pos[0], pos[1], pos[2]);
          sprite.visible = false;
          networkState.scene.add(sprite);
          networkState.wallNumberSprites.push(sprite);
        });
      });
    },

    toggleWallNumbers() {
      this.showWallNumbers = !this.showWallNumbers;
      networkState.wallNumberSprites.forEach(sprite => {
        sprite.visible = this.showWallNumbers;
      });
    },

    buildFloorPlan() {
      networkState.wallMeshes = [];
      const centerX = FLOOR_PLAN_CONFIG.apartmentWidth / 2;
      const centerZ = FLOOR_PLAN_CONFIG.apartmentDepth / 2;
      const floorColor = 0xC9B89A;

      // Base floor covering entire apartment
      const baseFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(FLOOR_PLAN_CONFIG.apartmentWidth + 2, FLOOR_PLAN_CONFIG.apartmentDepth + 2),
        new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.8 })
      );
      baseFloor.rotation.x = -Math.PI / 2;
      baseFloor.position.set(0, 0.001, 0);
      baseFloor.receiveShadow = true;
      networkState.scene.add(baseFloor);

      // Build rooms
      FLOOR_PLAN_CONFIG.rooms.forEach(config => {
        this.createRoom(config);
      });

      // Interior divider walls
      const wallHeight = 0.8;
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xB5A080, roughness: 0.7, transparent: true, opacity: 0.6 });

      const study = FLOOR_PLAN_CONFIG.rooms.find(r => r.id === 'study');
      const living = FLOOR_PLAN_CONFIG.rooms.find(r => r.id === 'living');
      const kitchen = FLOOR_PLAN_CONFIG.rooms.find(r => r.id === 'kitchen');
      const bedroom = FLOOR_PLAN_CONFIG.rooms.find(r => r.id === 'bedroom');
      const bathroom = FLOOR_PLAN_CONFIG.rooms.find(r => r.id === 'bathroom');

      // Wall 3: Study ↔ Living (horizontal divider wall with 2 door openings)
      const studyFrontZ = study.z + study.depth/2 - 0.5;

      const doorWidth = 0.42;
      const door4X = 3.8;
      const door2X = 4.8;

      const door4Left = door4X - doorWidth/2;
      const door4Right = door4X + doorWidth/2;
      const door2Left = door2X - doorWidth/2;
      const door2Right = door2X + doorWidth/2;

      // Left segment
      const wall3LeftWidth = door4Left;
      const wall3Left = new THREE.Mesh(new THREE.BoxGeometry(wall3LeftWidth, wallHeight, 0.08), wallMat);
      wall3Left.position.set(door4Left/2 - centerX, wallHeight/2, studyFrontZ - centerZ);
      networkState.scene.add(wall3Left);
      networkState.wallMeshes.push(wall3Left);

      // Middle segment
      const wall3MidWidth = door2Left - door4Right;
      const wall3Mid = new THREE.Mesh(new THREE.BoxGeometry(wall3MidWidth, wallHeight, 0.08), wallMat);
      wall3Mid.position.set(door4Right + wall3MidWidth/2 - centerX, wallHeight/2, studyFrontZ - centerZ);
      networkState.scene.add(wall3Mid);
      networkState.wallMeshes.push(wall3Mid);

      // Right segment
      const wall3RightWidth = FLOOR_PLAN_CONFIG.apartmentWidth - door2Right;
      const wall3Right = new THREE.Mesh(new THREE.BoxGeometry(wall3RightWidth, wallHeight, 0.08), wallMat);
      wall3Right.position.set(door2Right + wall3RightWidth/2 - centerX, wallHeight/2, studyFrontZ - centerZ);
      networkState.scene.add(wall3Right);
      networkState.wallMeshes.push(wall3Right);

      // Coat hanging wall in hallway
      const wall16Z = 0;
      const wall15Z = study.z + study.depth/2;
      const coatWallLength = (wall15Z - wall16Z) * 0.30;
      const coatWallCenterZ = wall16Z + coatWallLength / 2;
      const coatWallX = 4.6;

      const coatWall = new THREE.Mesh(new THREE.BoxGeometry(0.08, wallHeight, coatWallLength), wallMat);
      coatWall.position.set(coatWallX - centerX, wallHeight/2, coatWallCenterZ - centerZ);
      networkState.scene.add(coatWall);
      networkState.wallMeshes.push(coatWall);

      // North wall with main entry door
      const mainDoorX = 4.0;
      const mainDoorWidth = 0.42;
      const mainDoorLeft = mainDoorX - mainDoorWidth/2;
      const mainDoorRight = mainDoorX + mainDoorWidth/2;

      const northSeg1Width = mainDoorLeft;
      const northWall1 = new THREE.Mesh(new THREE.BoxGeometry(northSeg1Width, wallHeight, 0.08), wallMat);
      northWall1.position.set(northSeg1Width/2 - centerX, wallHeight/2, -centerZ);
      networkState.scene.add(northWall1);
      networkState.wallMeshes.push(northWall1);

      const northSeg2Width = FLOOR_PLAN_CONFIG.apartmentWidth - mainDoorRight;
      const northSeg2CenterX = (mainDoorRight + FLOOR_PLAN_CONFIG.apartmentWidth) / 2 - centerX;
      const northWall2 = new THREE.Mesh(new THREE.BoxGeometry(northSeg2Width, wallHeight, 0.08), wallMat);
      northWall2.position.set(northSeg2CenterX, wallHeight/2, -centerZ);
      networkState.scene.add(northWall2);
      networkState.wallMeshes.push(northWall2);

      // West wall
      const westWallDepth = FLOOR_PLAN_CONFIG.apartmentDepth;
      const westWall = new THREE.Mesh(new THREE.BoxGeometry(0.08, wallHeight, westWallDepth), wallMat);
      westWall.position.set(-centerX, wallHeight/2, 0);
      networkState.scene.add(westWall);
      networkState.wallMeshes.push(westWall);

      // East wall upper with door openings
      const wall10X = bathroom.x + bathroom.width/2;
      const wall10DoorWidth = 0.42;

      const bathDoorZ = 0.7;
      const bathDoorTop = bathDoorZ - wall10DoorWidth/2;
      const bathDoorBottom = bathDoorZ + wall10DoorWidth/2;

      const kitchenDoorZ = 2.5;
      const kitchenDoorTop = kitchenDoorZ - wall10DoorWidth/2;
      const kitchenDoorBottom = kitchenDoorZ + wall10DoorWidth/2;

      const wall10Seg1Depth = bathDoorTop;
      const eastWallUpper1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, wallHeight, wall10Seg1Depth), wallMat);
      eastWallUpper1.position.set(wall10X - centerX, wallHeight/2, wall10Seg1Depth/2 - centerZ);
      networkState.scene.add(eastWallUpper1);
      networkState.wallMeshes.push(eastWallUpper1);

      const wall10Seg2Depth = kitchenDoorTop - bathDoorBottom;
      const wall10Seg2CenterZ = (bathDoorBottom + kitchenDoorTop) / 2 - centerZ;
      const eastWallUpper2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, wallHeight, wall10Seg2Depth), wallMat);
      eastWallUpper2.position.set(wall10X - centerX, wallHeight/2, wall10Seg2CenterZ);
      networkState.scene.add(eastWallUpper2);
      networkState.wallMeshes.push(eastWallUpper2);

      const wall10Seg3Depth = studyFrontZ - kitchenDoorBottom;
      const wall10Seg3CenterZ = (kitchenDoorBottom + studyFrontZ) / 2 - centerZ;
      const eastWallUpper3 = new THREE.Mesh(new THREE.BoxGeometry(0.08, wallHeight, wall10Seg3Depth), wallMat);
      eastWallUpper3.position.set(wall10X - centerX, wallHeight/2, wall10Seg3CenterZ);
      networkState.scene.add(eastWallUpper3);
      networkState.wallMeshes.push(eastWallUpper3);

      // East wall lower
      const wall9X = FLOOR_PLAN_CONFIG.apartmentWidth;
      const wall9Depth = FLOOR_PLAN_CONFIG.apartmentDepth;
      const eastWallLower = new THREE.Mesh(new THREE.BoxGeometry(0.08, wallHeight, wall9Depth), wallMat);
      eastWallLower.position.set(wall9X - centerX, wallHeight/2, 0);
      networkState.scene.add(eastWallLower);
      networkState.wallMeshes.push(eastWallLower);

      // South wall
      const wall10Z = FLOOR_PLAN_CONFIG.apartmentDepth;
      const wall10Width = FLOOR_PLAN_CONFIG.apartmentWidth;
      const southWall = new THREE.Mesh(new THREE.BoxGeometry(wall10Width, wallHeight, 0.08), wallMat);
      southWall.position.set(0, wallHeight/2, wall10Z - centerZ);
      networkState.scene.add(southWall);
      networkState.wallMeshes.push(southWall);

      // Door X markers
      const doorMarkerMat = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
      const markerSize = 0.3;
      const markerThickness = 0.05;
      const markerHeight = 0.02;

      const addDoorMarker = (x, z) => {
        const posX = x - centerX;
        const posZ = z - centerZ;

        const bar1 = new THREE.Mesh(
          new THREE.BoxGeometry(markerSize, markerHeight, markerThickness),
          doorMarkerMat
        );
        bar1.rotation.y = Math.PI / 4;
        bar1.position.set(posX, markerHeight/2, posZ);
        networkState.scene.add(bar1);

        const bar2 = new THREE.Mesh(
          new THREE.BoxGeometry(markerSize, markerHeight, markerThickness),
          doorMarkerMat
        );
        bar2.rotation.y = -Math.PI / 4;
        bar2.position.set(posX, markerHeight/2, posZ);
        networkState.scene.add(bar2);
      };

      addDoorMarker(4.8, 3.197);
      addDoorMarker(5.331, 2.5);
      addDoorMarker(3.8, 3.197);
      addDoorMarker(3.15, 2.5);
      addDoorMarker(3.15, 0.7);
      addDoorMarker(4.0, 0);
    },

    createRoom(config) {
      const group = new THREE.Group();
      const floorColor = 0xC9B89A;
      const wallColor = 0xB5A080;
      const wallHeight = 0.8;

      const centerX = FLOOR_PLAN_CONFIG.apartmentWidth / 2;
      const centerZ = FLOOR_PLAN_CONFIG.apartmentDepth / 2;
      const rx = config.x - centerX;
      const rz = config.z - centerZ;

      // Room floor
      const floorGeom = new THREE.PlaneGeometry(config.width, config.depth);
      const floorMat = new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.8 });
      const floor = new THREE.Mesh(floorGeom, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(rx, 0.01, rz);
      floor.receiveShadow = true;
      group.add(floor);

      // Helipad-style room label
      const helipadSize = Math.min(config.width, config.depth) * 0.6;
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      ctx.strokeStyle = 'rgba(90, 70, 50, 0.4)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(128, 128, 110, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(90, 70, 50, 0.3)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(128, 128, 85, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(90, 70, 50, 0.5)';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(config.name.toUpperCase(), 128, 128);

      const helipadTexture = new THREE.CanvasTexture(canvas);
      const helipadGeom = new THREE.PlaneGeometry(helipadSize, helipadSize);
      const helipadMat = new THREE.MeshBasicMaterial({
        map: helipadTexture,
        transparent: true,
        depthWrite: false
      });
      const helipad = new THREE.Mesh(helipadGeom, helipadMat);
      helipad.rotation.x = -Math.PI / 2;
      helipad.position.set(rx, 0.02, rz);
      group.add(helipad);

      // Walls
      const halfW = config.width / 2;
      const halfD = config.depth / 2;
      const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.7, transparent: true, opacity: 0.6 });

      // Front wall
      if (config.id !== 'study' && config.id !== 'kitchen' && config.id !== 'bedroom' && config.id !== 'living') {
        const frontWall = new THREE.Mesh(new THREE.BoxGeometry(config.width, wallHeight, 0.08), wallMat);
        frontWall.position.set(rx, wallHeight/2, rz + halfD);
        group.add(frontWall);
        networkState.wallMeshes.push(frontWall);
      }

      // Left wall
      const roomAtWestEdge = ['bathroom', 'kitchen', 'bedroom'].includes(config.id);
      if (config.id !== 'living' && !roomAtWestEdge) {
        if (config.id === 'study') {
          const studyObj = FLOOR_PLAN_CONFIG.rooms.find(r => r.id === 'study');
          const studyFrontZ = studyObj.z + studyObj.depth/2 - 0.5;
          const centerZ = FLOOR_PLAN_CONFIG.apartmentDepth / 2;

          const doorZ = 2.5;
          const doorWidth = 0.42;
          const doorTop = doorZ - doorWidth/2;
          const doorBottom = doorZ + doorWidth/2;

          const seg1Depth = doorTop;
          const seg1CenterZ = seg1Depth/2 - centerZ;
          const leftWall1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, wallHeight, seg1Depth), wallMat);
          leftWall1.position.set(rx - halfW, wallHeight/2, seg1CenterZ);
          leftWall1.userData = { roomId: config.id, side: 'left' };
          group.add(leftWall1);
          networkState.wallMeshes.push(leftWall1);

          const seg2Depth = studyFrontZ - doorBottom;
          const seg2CenterZ = (doorBottom + studyFrontZ)/2 - centerZ;
          const leftWall2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, wallHeight, seg2Depth), wallMat);
          leftWall2.position.set(rx - halfW, wallHeight/2, seg2CenterZ);
          leftWall2.userData = { roomId: config.id, side: 'left' };
          group.add(leftWall2);
          networkState.wallMeshes.push(leftWall2);
        } else {
          const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.08, wallHeight, config.depth), wallMat);
          leftWall.position.set(rx - halfW, wallHeight/2, rz);
          leftWall.userData = { roomId: config.id, side: 'left' };
          group.add(leftWall);
          networkState.wallMeshes.push(leftWall);
        }
      }

      // Right wall
      const roomsWithConsolidatedEastWall = ['bathroom', 'kitchen', 'study', 'living'];
      if (!roomsWithConsolidatedEastWall.includes(config.id)) {
        if (config.id === 'bedroom') {
          const study = FLOOR_PLAN_CONFIG.rooms.find(r => r.id === 'study');
          const wall15Z = study.z + study.depth/2 - 0.5;
          const bedroomFrontZ = config.z + config.depth/2;
          const extendedDepth = bedroomFrontZ - wall15Z;
          const extendedCenterZ = (wall15Z + bedroomFrontZ) / 2 - FLOOR_PLAN_CONFIG.apartmentDepth / 2;

          const bathroom = FLOOR_PLAN_CONFIG.rooms.find(r => r.id === 'bathroom');
          const wall7X = bathroom.x + bathroom.width/2 + 0.8 - FLOOR_PLAN_CONFIG.apartmentWidth / 2;

          const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.08, wallHeight, extendedDepth), wallMat);
          rightWall.position.set(wall7X, wallHeight/2, extendedCenterZ);
          group.add(rightWall);
          networkState.wallMeshes.push(rightWall);
        } else {
          const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.08, wallHeight, config.depth), wallMat);
          rightWall.position.set(rx + halfW, wallHeight/2, rz);
          group.add(rightWall);
          networkState.wallMeshes.push(rightWall);
        }
      }

      // Furniture
      this.createFurniture(group, config, rx, rz);

      networkState.scene.add(group);
      networkState.roomMeshes[config.id] = { group, floor, config };
    },

    createFurniture(group, config, rx, rz) {
      const furnitureColor = 0xBFA98A;
      const furnitureMat = new THREE.MeshStandardMaterial({ color: furnitureColor, roughness: 0.6 });

      if (config.id === 'bedroom') {
        const bedGeom = new THREE.BoxGeometry(1.4, 0.3, 2.0);
        const bed = new THREE.Mesh(bedGeom, furnitureMat);
        bed.position.set(rx - config.width/4, 0.15, rz);
        group.add(bed);
      } else if (config.id === 'living') {
        const sofaGeom = new THREE.BoxGeometry(2.0, 0.4, 0.8);
        const sofa = new THREE.Mesh(sofaGeom, furnitureMat);
        sofa.position.set(rx, 0.2, rz + config.depth/4);
        group.add(sofa);
      } else if (config.id === 'study') {
        const deskGeom = new THREE.BoxGeometry(1.2, 0.5, 0.6);
        const desk = new THREE.Mesh(deskGeom, furnitureMat);
        desk.position.set(rx + config.width/4, 0.25, rz - config.depth/4);
        group.add(desk);
      }
    },

    createDevices() {
      networkState.deviceMeshes = {};
      const centerX = FLOOR_PLAN_CONFIG.apartmentWidth / 2;
      const centerZ = FLOOR_PLAN_CONFIG.apartmentDepth / 2;

      ZIGBEE_DEVICES.forEach(device => {
        const geometry = new THREE.SphereGeometry(0.15, 16, 16);
        let color;
        switch (device.type) {
          case 'coordinator': color = 0xFF6B6B; break;
          case 'router': color = 0x4DABF7; break;
          default: color = 0x51CF66;
        }
        const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
        const mesh = new THREE.Mesh(geometry, material);

        const room = FLOOR_PLAN_CONFIG.rooms.find(r => r.id === device.room);
        if (room) {
          const roomCenterX = room.x - centerX;
          const roomCenterZ = room.z - centerZ;
          mesh.position.set(
            roomCenterX + (device.x - 0.5) * room.width * 0.8,
            0.5,
            roomCenterZ + (device.z - 0.5) * room.depth * 0.8
          );
        }

        mesh.castShadow = true;
        networkState.scene.add(mesh);
        networkState.deviceMeshes[device.id] = { mesh, config: device };
      });
    },

    createLabels(container) {
      Object.values(networkState.labelElements).forEach(el => el?.remove());
      Object.values(networkState.signalElements).forEach(el => el?.remove());
      networkState.labelElements = {};
      networkState.signalElements = {};

      ZIGBEE_DEVICES.forEach(device => {
        const label = document.createElement('div');
        label.className = 'device-label visible';
        label.innerHTML = `
          <div class="device-icon ${device.type}">${device.icon}</div>
          <div class="device-name">${device.name}</div>
        `;
        container.appendChild(label);
        networkState.labelElements[device.id] = label;

        if (device.type === 'coordinator' || device.type === 'router') {
          const signal = document.createElement('div');
          signal.className = `signal-range ${device.type}`;
          signal.style.width = device.type === 'coordinator' ? '200px' : '150px';
          signal.style.height = device.type === 'coordinator' ? '200px' : '150px';
          container.appendChild(signal);
          networkState.signalElements[device.id] = signal;
        }
      });
    },

    updateLabels() {
      const container = this.$refs.networkContainer;
      if (!container || !networkState.camera) return;

      ZIGBEE_DEVICES.forEach(device => {
        const deviceData = networkState.deviceMeshes[device.id];
        const label = networkState.labelElements[device.id];
        const signal = networkState.signalElements[device.id];

        if (!deviceData || !label) return;

        const pos = deviceData.mesh.position.clone();
        pos.y += 0.3;
        pos.project(networkState.camera);

        const x = (pos.x * 0.5 + 0.5) * container.clientWidth;
        const y = (-pos.y * 0.5 + 0.5) * container.clientHeight;

        label.style.left = x + 'px';
        label.style.top = y + 'px';
        label.style.display = this.showLabels ? 'flex' : 'none';

        if (signal) {
          signal.style.left = x + 'px';
          signal.style.top = (y + 40) + 'px';
          signal.style.display = this.showSignalRange ? 'block' : 'none';
        }
      });
    },

    setupPanControls(container) {
      container.addEventListener('pointerdown', (e) => {
        if (this.autoRotate) return;
        networkState.isPanning = true;
        networkState.lastPanPos = { x: e.clientX, y: e.clientY };
        container.style.cursor = 'grabbing';
      });

      container.addEventListener('pointermove', (e) => {
        if (!networkState.isPanning) return;
        const dx = e.clientX - networkState.lastPanPos.x;
        const dy = e.clientY - networkState.lastPanPos.y;
        networkState.panOffset.x -= dx * 0.02;
        networkState.panOffset.z -= dy * 0.02;
        networkState.camera.lookAt(networkState.panOffset.x, 0, networkState.panOffset.z);
        networkState.lastPanPos = { x: e.clientX, y: e.clientY };
      });

      container.addEventListener('pointerup', () => {
        networkState.isPanning = false;
        container.style.cursor = 'grab';
      });

      container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.setZoom(this.zoomLevel * delta);
      }, { passive: false });
    },

    setZoom(level) {
      this.zoomLevel = Math.max(0.5, Math.min(3.0, level));
      this.updateCameraZoom();
    },

    updateCameraZoom() {
      const container = this.$refs.networkContainer;
      if (!container || !networkState.camera) return;
      const aspect = container.clientWidth / container.clientHeight;
      const frustumSize = 15 / this.zoomLevel;
      networkState.camera.left = frustumSize * aspect / -2;
      networkState.camera.right = frustumSize * aspect / 2;
      networkState.camera.top = frustumSize / 2;
      networkState.camera.bottom = frustumSize / -2;
      networkState.camera.updateProjectionMatrix();
    },

    zoomIn() { this.setZoom(this.zoomLevel * 1.2); },
    zoomOut() { this.setZoom(this.zoomLevel / 1.2); },

    resetView() {
      this.zoomLevel = 1.0;
      this.autoRotate = false;
      this.rotationAngle = Math.PI / 4;
      networkState.panOffset = { x: 0, z: 0 };
      networkState.camera.position.set(10, 10, 10);
      networkState.camera.lookAt(0, 0, 0);
      this.updateCameraZoom();
    },

    toggleAutoRotate() {
      this.autoRotate = !this.autoRotate;
      if (this.autoRotate) {
        const pos = networkState.camera.position;
        this.rotationAngle = Math.atan2(pos.x, pos.z);
      }
    },

    animate() {
      const self = this;
      const radius = 17.32;
      const height = 10;

      function loop() {
        networkState.animationId = requestAnimationFrame(loop);

        if (self.autoRotate && networkState.camera) {
          self.rotationAngle += 0.003;
          const x = Math.sin(self.rotationAngle) * radius;
          const z = Math.cos(self.rotationAngle) * radius;
          networkState.camera.position.set(x, height, z);
          networkState.camera.lookAt(networkState.panOffset.x, 0, networkState.panOffset.z);
        }

        self.updateLabels();
        if (networkState.renderer && networkState.scene && networkState.camera) {
          networkState.renderer.render(networkState.scene, networkState.camera);
        }
      }
      loop();
    },

    onResize() {
      const container = this.$refs.networkContainer;
      if (!container || !networkState.camera || !networkState.renderer) return;
      const aspect = container.clientWidth / container.clientHeight;
      const frustumSize = 15 / this.zoomLevel;
      networkState.camera.left = frustumSize * aspect / -2;
      networkState.camera.right = frustumSize * aspect / 2;
      networkState.camera.top = frustumSize / 2;
      networkState.camera.bottom = frustumSize / -2;
      networkState.camera.updateProjectionMatrix();
      networkState.renderer.setSize(container.clientWidth, container.clientHeight);
    },

    getZoomPercent() { return Math.round(this.zoomLevel * 100); }
  };
}
