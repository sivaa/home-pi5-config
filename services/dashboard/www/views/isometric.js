/**
 * Isometric Floor Plan View
 * Fixed-angle orthographic visualization of apartment with heat map
 * Clean, dashboard-style view for monitoring sensors
 */

// Store Three.js objects OUTSIDE Alpine to avoid proxy conflicts
const isoState = {
  scene: null,
  camera: null,
  renderer: null,
  roomMeshes: {},
  wallMeshes: [],
  labelElements: {},
  animationId: null,
  isInitialized: false,
  // Pan state
  panOffset: { x: 0, z: 0 },
  isPanning: false,
  lastPanPos: { x: 0, y: 0 }
};

/**
 * Creates the Isometric floor plan view component
 * @param {Object} FLOOR_PLAN_CONFIG - Floor plan configuration with room dimensions
 * @param {Array} TEMP_COLORS - Temperature color scale
 * @param {Array} HUMIDITY_COLORS - Humidity color scale
 */
export function isometricView(FLOOR_PLAN_CONFIG, TEMP_COLORS, HUMIDITY_COLORS) {
  // Calculate center for positioning
  const centerX = FLOOR_PLAN_CONFIG.apartmentWidth / 2;
  const centerZ = FLOOR_PLAN_CONFIG.apartmentDepth / 2;

  return {
    // Reactive state for UI
    viewMode: 'temperature',
    zoomLevel: 1.0,
    wallsVisible: true,
    darkTheme: false,

    init() {
      // Sync with global theme store
      const globalTheme = document.documentElement.getAttribute('data-theme');
      this.darkTheme = globalTheme === 'dark';

      // Watch for global theme changes
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'data-theme') {
            const newTheme = document.documentElement.getAttribute('data-theme');
            const shouldBeDark = newTheme === 'dark';
            if (this.darkTheme !== shouldBeDark) {
              this.darkTheme = shouldBeDark;
              this.applyTheme();
            }
          }
        });
      });
      observer.observe(document.documentElement, { attributes: true });

      // Wait for container to become visible and have dimensions
      this.waitForContainer();
    },

    waitForContainer() {
      const container = this.$refs.isoContainer;

      // If container doesn't exist or has no dimensions, retry
      if (!container || container.clientWidth === 0 || container.clientHeight === 0) {
        setTimeout(() => this.waitForContainer(), 100);
        return;
      }

      // If already initialized, ensure canvas is in container and resize
      if (isoState.isInitialized && isoState.renderer) {
        // Re-attach canvas if it's not in the container
        if (!container.contains(isoState.renderer.domElement)) {
          container.appendChild(isoState.renderer.domElement);
        }
        this.createLabels(container);
        this.onResize();
        return;
      }

      // Clean up any existing Three.js objects
      if (isoState.renderer) {
        isoState.renderer.dispose();
      }
      if (isoState.scene) {
        isoState.scene.clear();
      }
      if (isoState.animationId) {
        cancelAnimationFrame(isoState.animationId);
      }

      this.initScene();
      this.initCamera(container);
      this.initRenderer(container);
      this.applyTheme();  // Apply theme after renderer is ready
      this.initLighting();
      this.buildFloorPlan();
      this.createLabels(container);
      this.setupPanControls(container);
      this.animate();
      isoState.isInitialized = true;

      window.addEventListener('resize', () => this.onResize());
    },

    initScene() {
      isoState.scene = new THREE.Scene();
      // Note: Background color is set via renderer.setClearColor in applyTheme()
      // which is called after renderer is initialized
    },

    initCamera(container) {
      const aspect = container.clientWidth / container.clientHeight;
      const frustumSize = 15;

      // OrthographicCamera for true isometric projection (no perspective distortion)
      isoState.camera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2,  // left
        frustumSize * aspect / 2,   // right
        frustumSize / 2,            // top
        frustumSize / -2,           // bottom
        0.1,                        // near
        1000                        // far
      );

      // True isometric position - fixed angle
      isoState.camera.position.set(10, 10, 10);
      isoState.camera.lookAt(0, 0, 0);
    },

    initRenderer(container) {
      isoState.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
      });
      isoState.renderer.setSize(container.clientWidth, container.clientHeight);
      isoState.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      isoState.renderer.shadowMap.enabled = true;
      isoState.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(isoState.renderer.domElement);
    },

    initLighting() {
      const ambient = new THREE.AmbientLight(0xffffff, 0.6);
      isoState.scene.add(ambient);

      const directional = new THREE.DirectionalLight(0xffffff, 0.8);
      directional.position.set(15, 20, 15);
      directional.castShadow = true;
      directional.shadow.mapSize.width = 1024;
      directional.shadow.mapSize.height = 1024;
      directional.shadow.camera.near = 0.5;
      directional.shadow.camera.far = 50;
      directional.shadow.camera.left = -15;
      directional.shadow.camera.right = 15;
      directional.shadow.camera.top = 15;
      directional.shadow.camera.bottom = -15;
      isoState.scene.add(directional);

      const fill = new THREE.DirectionalLight(0xffffff, 0.3);
      fill.position.set(-10, 10, -10);
      isoState.scene.add(fill);
    },

    buildFloorPlan() {
      // Clear wall meshes array for fresh build
      isoState.wallMeshes = [];

      // Base floor
      const apW = FLOOR_PLAN_CONFIG.apartmentWidth;
      const apD = FLOOR_PLAN_CONFIG.apartmentDepth;
      const floorGeometry = new THREE.PlaneGeometry(apW + 2, apD + 2);
      const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0xC0C0C2,
        roughness: 0.8
      });
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0, -0.01, 0);
      floor.receiveShadow = true;
      isoState.scene.add(floor);

      // Build each room
      FLOOR_PLAN_CONFIG.rooms.forEach(roomConfig => {
        const roomGroup = this.createRoom(roomConfig);
        isoState.roomMeshes[roomConfig.id] = roomGroup;
        isoState.scene.add(roomGroup);
      });

      // Hallway floor
      const hw = FLOOR_PLAN_CONFIG.hallway;
      const hallwayGeometry = new THREE.PlaneGeometry(hw.width, hw.depth);
      const hallwayMaterial = new THREE.MeshStandardMaterial({
        color: 0xD0D0D0,
        roughness: 0.7
      });
      const hallway = new THREE.Mesh(hallwayGeometry, hallwayMaterial);
      hallway.rotation.x = -Math.PI / 2;
      hallway.position.set(hw.x - centerX, 0.005, hw.z - centerZ);
      hallway.receiveShadow = true;
      isoState.scene.add(hallway);

      // Balcony floor
      const bal = FLOOR_PLAN_CONFIG.balcony;
      const balconyGeometry = new THREE.PlaneGeometry(bal.width, bal.depth);
      const balconyMaterial = new THREE.MeshStandardMaterial({
        color: 0x93c5fd,
        roughness: 0.5
      });
      const balcony = new THREE.Mesh(balconyGeometry, balconyMaterial);
      balcony.rotation.x = -Math.PI / 2;
      balcony.position.set(bal.x - centerX, 0.003, bal.z - centerZ);
      balcony.receiveShadow = true;
      isoState.scene.add(balcony);

      // Add doors
      FLOOR_PLAN_CONFIG.doors.forEach(door => this.createDoor(door));

      // Add windows
      FLOOR_PLAN_CONFIG.windows.forEach(win => this.createWindow(win));

      // Add balcony railing
      this.createBalconyRailing();

      // Add furniture
      this.createFurniture();
    },

    createRoom(config) {
      const group = new THREE.Group();
      const wallHeight = FLOOR_PLAN_CONFIG.wallHeight;

      // Room floor - colored transparent box
      const floorGeometry = new THREE.BoxGeometry(config.width, 0.05, config.depth);
      const floorMaterial = new THREE.MeshStandardMaterial({
        color: config.color,
        transparent: true,
        opacity: 0.3,
        roughness: 0.6,
        metalness: 0.1
      });
      const roomFloor = new THREE.Mesh(floorGeometry, floorMaterial);
      roomFloor.position.set(config.x - centerX, 0.025, config.z - centerZ);
      roomFloor.receiveShadow = true;
      roomFloor.name = 'floor_' + config.id;
      group.add(roomFloor);

      // Glassy wall material
      const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.25,
        metalness: 0.4,
        roughness: 0.08,
        side: THREE.DoubleSide
      });

      // Calculate room boundaries
      const halfW = config.width / 2;
      const halfD = config.depth / 2;
      const rx = config.x - centerX;
      const rz = config.z - centerZ;

      // Back wall (north)
      const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(config.width, wallHeight, 0.15),
        wallMaterial
      );
      backWall.position.set(rx, wallHeight/2, rz - halfD);
      backWall.castShadow = true;
      group.add(backWall);
      isoState.wallMeshes.push(backWall);

      // Front wall (south)
      const frontWall = new THREE.Mesh(
        new THREE.BoxGeometry(config.width, wallHeight, 0.15),
        wallMaterial
      );
      frontWall.position.set(rx, wallHeight/2, rz + halfD);
      frontWall.castShadow = true;
      group.add(frontWall);
      isoState.wallMeshes.push(frontWall);

      // Left wall (west)
      const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, wallHeight, config.depth),
        wallMaterial
      );
      leftWall.position.set(rx - halfW, wallHeight/2, rz);
      leftWall.castShadow = true;
      group.add(leftWall);
      isoState.wallMeshes.push(leftWall);

      // Right wall (east)
      const rightWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, wallHeight, config.depth),
        wallMaterial
      );
      rightWall.position.set(rx + halfW, wallHeight/2, rz);
      rightWall.castShadow = true;
      group.add(rightWall);
      isoState.wallMeshes.push(rightWall);

      return group;
    },

    createDoor(doorConfig) {
      const doorWidth = 0.9;
      const doorHeight = FLOOR_PLAN_CONFIG.wallHeight * 0.85;
      const posX = doorConfig.x - centerX;
      const posZ = doorConfig.z - centerZ;

      if (doorConfig.type === 'french') {
        this.createFrenchDoor(doorConfig, posX, posZ, doorWidth, doorHeight);
        return;
      }

      // Standard door material
      const doorMaterial = new THREE.MeshStandardMaterial({
        color: 0x8B4513,
        roughness: 0.7,
        metalness: 0.1
      });

      const door = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth, doorHeight, 0.08),
        doorMaterial
      );
      door.position.set(posX, doorHeight / 2, posZ);
      door.rotation.y = doorConfig.rotation || 0;
      door.castShadow = true;
      isoState.scene.add(door);

      // Door handle
      const handleMaterial = new THREE.MeshStandardMaterial({
        color: 0xC0C0C0,
        metalness: 0.9,
        roughness: 0.2
      });
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.15, 16),
        handleMaterial
      );

      const handleOffsetX = 0.3 * Math.cos(doorConfig.rotation || 0);
      const handleOffsetZ = 0.3 * Math.sin(doorConfig.rotation || 0);
      handle.position.set(
        posX + handleOffsetX,
        doorHeight * 0.45,
        posZ + handleOffsetZ
      );
      handle.rotation.z = Math.PI / 2;
      isoState.scene.add(handle);

      // Swing arc
      this.createSwingArc(doorConfig, posX, posZ, doorWidth);
    },

    createFrenchDoor(doorConfig, posX, posZ, doorWidth, doorHeight) {
      const glassMaterial = new THREE.MeshStandardMaterial({
        color: 0x87CEEB,
        transparent: true,
        opacity: 0.4,
        roughness: 0.1,
        metalness: 0.3
      });

      const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x2c3e50,
        roughness: 0.5,
        metalness: 0.2
      });

      const gap = 0.05;
      const rot = doorConfig.rotation || 0;

      // Left and right door panels
      const leftDoor = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth - gap/2, doorHeight, 0.06),
        glassMaterial
      );
      const rightDoor = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth - gap/2, doorHeight, 0.06),
        glassMaterial
      );

      const offsetLeft = (doorWidth/2 + gap/4) * Math.cos(rot + Math.PI/2);
      const offsetLeftZ = (doorWidth/2 + gap/4) * Math.sin(rot + Math.PI/2);
      const offsetRight = (doorWidth/2 + gap/4) * Math.cos(rot - Math.PI/2);
      const offsetRightZ = (doorWidth/2 + gap/4) * Math.sin(rot - Math.PI/2);

      leftDoor.position.set(posX + offsetLeft, doorHeight/2, posZ + offsetLeftZ);
      leftDoor.rotation.y = rot;
      rightDoor.position.set(posX + offsetRight, doorHeight/2, posZ + offsetRightZ);
      rightDoor.rotation.y = rot;

      isoState.scene.add(leftDoor);
      isoState.scene.add(rightDoor);

      // Center frame
      const centerFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, doorHeight, 0.08),
        frameMaterial
      );
      centerFrame.position.set(posX, doorHeight/2, posZ);
      centerFrame.rotation.y = rot;
      isoState.scene.add(centerFrame);

      // Swing arcs
      this.createSwingArc({ ...doorConfig, swingDirection: 'inward-left' }, posX + offsetLeft, posZ + offsetLeftZ, doorWidth);
      this.createSwingArc({ ...doorConfig, swingDirection: 'inward-right' }, posX + offsetRight, posZ + offsetRightZ, doorWidth);
    },

    createSwingArc(doorConfig, posX, posZ, doorWidth) {
      const arcRadius = doorWidth;
      const arcSegments = 32;

      let startAngle, endAngle;
      const rot = doorConfig.rotation || 0;
      const swing = doorConfig.swingDirection || 'south';

      if (swing === 'inward-left') {
        startAngle = rot;
        endAngle = rot + Math.PI/2;
      } else if (swing === 'inward-right') {
        startAngle = rot - Math.PI/2;
        endAngle = rot;
      } else if (swing === 'south') {
        startAngle = rot;
        endAngle = rot + Math.PI/2;
      } else if (swing === 'north') {
        startAngle = rot + Math.PI/2;
        endAngle = rot + Math.PI;
      } else if (swing === 'east') {
        startAngle = rot - Math.PI/2;
        endAngle = rot;
      } else if (swing === 'west') {
        startAngle = rot + Math.PI;
        endAngle = rot + Math.PI * 1.5;
      } else {
        startAngle = rot;
        endAngle = rot + Math.PI/2;
      }

      const curve = new THREE.EllipseCurve(
        0, 0,
        arcRadius, arcRadius,
        startAngle, endAngle,
        false,
        0
      );

      const points = curve.getPoints(arcSegments);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);

      const arcMaterial = new THREE.LineBasicMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.6
      });

      const arc = new THREE.Line(geometry, arcMaterial);
      arc.rotation.x = -Math.PI / 2;
      arc.position.set(posX, 0.02, posZ);

      isoState.scene.add(arc);
    },

    createWindow(winConfig) {
      const winWidth = winConfig.size || 2.0;
      const winHeight = 1.3;
      const wallHeight = FLOOR_PLAN_CONFIG.wallHeight;

      // Window frame
      const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x2c3e50,
        roughness: 0.5,
        metalness: 0.2
      });
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(winWidth, winHeight, 0.15),
        frameMaterial
      );
      frame.position.set(
        winConfig.x - centerX,
        wallHeight * 0.55,
        winConfig.z - centerZ
      );
      frame.rotation.y = winConfig.rotation || 0;
      isoState.scene.add(frame);

      // Window glass
      const glassMaterial = new THREE.MeshStandardMaterial({
        color: 0x87CEEB,
        metalness: 0.3,
        roughness: 0.1,
        transparent: true,
        opacity: 0.4
      });
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(winWidth * 0.9, winHeight * 0.85, 0.06),
        glassMaterial
      );
      glass.position.set(
        winConfig.x - centerX,
        wallHeight * 0.55,
        winConfig.z - centerZ
      );
      glass.rotation.y = winConfig.rotation || 0;
      isoState.scene.add(glass);
    },

    createBalconyRailing() {
      const bal = FLOOR_PLAN_CONFIG.balcony;
      const railingHeight = 1.0;
      const railingMaterial = new THREE.MeshStandardMaterial({
        color: 0x374151,
        metalness: 0.7,
        roughness: 0.3
      });

      // Front railing
      const frontRailing = new THREE.Mesh(
        new THREE.BoxGeometry(bal.width, railingHeight, 0.05),
        railingMaterial
      );
      frontRailing.position.set(
        bal.x - centerX,
        railingHeight / 2,
        bal.z - centerZ + bal.depth / 2
      );
      isoState.scene.add(frontRailing);

      // Left railing
      const leftRailing = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, railingHeight, bal.depth),
        railingMaterial
      );
      leftRailing.position.set(
        bal.x - centerX - bal.width / 2,
        railingHeight / 2,
        bal.z - centerZ
      );
      isoState.scene.add(leftRailing);

      // Vertical posts
      const postMaterial = new THREE.MeshStandardMaterial({
        color: 0x374151,
        metalness: 0.8,
        roughness: 0.2
      });

      const postPositions = [
        { x: bal.x - bal.width / 2, z: bal.z + bal.depth / 2 },
        { x: bal.x + bal.width / 2, z: bal.z + bal.depth / 2 },
        { x: bal.x, z: bal.z + bal.depth / 2 }
      ];

      postPositions.forEach(pos => {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, railingHeight, 8),
          postMaterial
        );
        post.position.set(
          pos.x - centerX,
          railingHeight / 2,
          pos.z - centerZ
        );
        isoState.scene.add(post);
      });

      // Glass panel
      const glassRailing = new THREE.MeshStandardMaterial({
        color: 0xccf0ff,
        transparent: true,
        opacity: 0.3,
        metalness: 0.2,
        roughness: 0.1
      });
      const glassPanel = new THREE.Mesh(
        new THREE.BoxGeometry(bal.width, railingHeight * 0.7, 0.02),
        glassRailing
      );
      glassPanel.position.set(
        bal.x - centerX,
        railingHeight * 0.4,
        bal.z - centerZ + bal.depth / 2
      );
      isoState.scene.add(glassPanel);
    },

    createFurniture() {
      const furnitureMaterial = new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.6,
        metalness: 0.1
      });

      FLOOR_PLAN_CONFIG.furniture.forEach(item => {
        const roomConfig = FLOOR_PLAN_CONFIG.rooms.find(r => r.id === item.room);
        if (!roomConfig) return;

        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(item.width, item.height, item.depth),
          furnitureMaterial
        );
        mesh.position.set(
          roomConfig.x - centerX,
          item.height / 2,
          roomConfig.z - centerZ
        );
        mesh.castShadow = true;
        isoState.scene.add(mesh);

        // Add bedding for bed
        if (item.type === 'bed') {
          const beddingMaterial = new THREE.MeshStandardMaterial({
            color: 0x94a3b8,
            roughness: 0.8
          });
          const bedding = new THREE.Mesh(
            new THREE.BoxGeometry(item.width * 0.95, 0.1, item.depth * 0.8),
            beddingMaterial
          );
          bedding.position.set(
            roomConfig.x - centerX,
            item.height + 0.05,
            roomConfig.z - centerZ
          );
          isoState.scene.add(bedding);
        }
      });
    },

    // Pan & Zoom Controls
    setupPanControls(container) {
      // Pointer down - start panning
      container.addEventListener('pointerdown', (e) => {
        isoState.isPanning = true;
        isoState.lastPanPos = { x: e.clientX, y: e.clientY };
        container.setPointerCapture(e.pointerId);
        container.style.cursor = 'grabbing';
      });

      // Pointer move - update pan
      container.addEventListener('pointermove', (e) => {
        if (!isoState.isPanning) return;

        const dx = e.clientX - isoState.lastPanPos.x;
        const dy = e.clientY - isoState.lastPanPos.y;

        // Convert screen delta to world delta (adjusted for isometric angle)
        const panSpeed = 0.02 / this.zoomLevel;
        isoState.panOffset.x -= (dx - dy) * panSpeed * 0.7;
        isoState.panOffset.z -= (dx + dy) * panSpeed * 0.7;

        // Update camera target
        isoState.camera.lookAt(
          isoState.panOffset.x,
          0,
          isoState.panOffset.z
        );

        isoState.lastPanPos = { x: e.clientX, y: e.clientY };
      });

      // Pointer up - end panning
      container.addEventListener('pointerup', (e) => {
        isoState.isPanning = false;
        container.releasePointerCapture(e.pointerId);
        container.style.cursor = 'grab';
      });

      // Pointer leave - end panning
      container.addEventListener('pointerleave', () => {
        isoState.isPanning = false;
        container.style.cursor = 'grab';
      });

      // Wheel - zoom
      container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
        this.setZoom(this.zoomLevel * zoomDelta);
      }, { passive: false });
    },

    setZoom(level) {
      this.zoomLevel = Math.max(0.5, Math.min(3.0, level));
      this.updateCameraZoom();
    },

    updateCameraZoom() {
      const container = this.$refs.isoContainer;
      if (!container || !isoState.camera) return;

      const aspect = container.clientWidth / container.clientHeight;
      const frustumSize = 15 / this.zoomLevel;

      isoState.camera.left = frustumSize * aspect / -2;
      isoState.camera.right = frustumSize * aspect / 2;
      isoState.camera.top = frustumSize / 2;
      isoState.camera.bottom = frustumSize / -2;
      isoState.camera.updateProjectionMatrix();
    },

    zoomIn() {
      this.setZoom(this.zoomLevel * 1.2);
    },

    zoomOut() {
      this.setZoom(this.zoomLevel / 1.2);
    },

    resetView() {
      this.zoomLevel = 1.0;
      isoState.panOffset = { x: 0, z: 0 };
      isoState.camera.lookAt(0, 0, 0);
      this.updateCameraZoom();
    },

    // Labels
    createLabels(container) {
      // Clear existing labels
      Object.values(isoState.labelElements).forEach(label => {
        if (label && label.parentNode) {
          label.parentNode.removeChild(label);
        }
      });
      isoState.labelElements = {};

      // Remove orphaned labels
      container.querySelectorAll('.iso-label').forEach(el => el.remove());

      FLOOR_PLAN_CONFIG.rooms.forEach(roomConfig => {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'iso-label';
        labelDiv.innerHTML = `
          <div class="label-name">${roomConfig.icon} ${roomConfig.name}</div>
          <div class="label-value" data-room="${roomConfig.id}">--</div>
          <div class="label-secondary" data-room-secondary="${roomConfig.id}">--</div>
        `;
        container.appendChild(labelDiv);
        isoState.labelElements[roomConfig.id] = labelDiv;
      });
    },

    updateLabels() {
      const container = this.$refs.isoContainer;
      if (!container || !isoState.camera) return;

      const rooms = Alpine.store('rooms')?.list || [];
      const viewMode = this.viewMode;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      FLOOR_PLAN_CONFIG.rooms.forEach(config => {
        const label = isoState.labelElements[config.id];
        if (!label) return;

        const roomData = rooms.find(r => r.id === config.id);
        const valueEl = label.querySelector(`[data-room="${config.id}"]`);
        const secondaryEl = label.querySelector(`[data-room-secondary="${config.id}"]`);

        if (valueEl && roomData) {
          if (viewMode === 'temperature') {
            valueEl.textContent = roomData.temperature !== null
              ? `${roomData.temperature.toFixed(1)}°` : '--';
            if (secondaryEl) {
              secondaryEl.textContent = roomData.humidity !== null
                ? `${roomData.humidity.toFixed(0)}%` : '';
            }
          } else {
            valueEl.textContent = roomData.humidity !== null
              ? `${roomData.humidity.toFixed(0)}%` : '--';
            if (secondaryEl) {
              secondaryEl.textContent = roomData.temperature !== null
                ? `${roomData.temperature.toFixed(1)}°` : '';
            }
          }
        }

        // Project 3D to 2D
        const position = new THREE.Vector3(
          config.x - centerX,
          config.labelY || 3,
          config.z - centerZ
        );
        position.project(isoState.camera);

        const x = (position.x * 0.5 + 0.5) * containerWidth;
        const y = (-position.y * 0.5 + 0.5) * containerHeight;

        label.style.left = `${x}px`;
        label.style.top = `${y}px`;

        // Show label if within bounds
        const margin = 20;
        const isVisible = containerWidth > 0 && containerHeight > 0 &&
                          x > margin && x < containerWidth - margin &&
                          y > margin && y < containerHeight - margin;

        if (isVisible) {
          label.classList.add('visible');
        } else {
          label.classList.remove('visible');
        }
      });
    },

    updateRoomColors() {
      const rooms = Alpine.store('rooms')?.list || [];
      const viewMode = this.viewMode;

      rooms.forEach(roomData => {
        const meshGroup = isoState.roomMeshes[roomData.id];
        if (!meshGroup) return;

        const floorMesh = meshGroup.children.find(child =>
          child.name === 'floor_' + roomData.id
        );

        if (floorMesh && floorMesh.material) {
          const color = this.getRoomColor(roomData, viewMode);
          floorMesh.material.color.setHex(color);
        }
      });
    },

    getRoomColor(room, viewMode) {
      if (!room) return 0xE0E0E0;

      const value = viewMode === 'temperature' ? room.temperature : room.humidity;
      if (value === null || value === undefined) return 0xE0E0E0;

      const scale = viewMode === 'temperature' ? TEMP_COLORS : HUMIDITY_COLORS;
      return this.interpolateColor(value, scale);
    },

    interpolateColor(value, scale) {
      if (value <= scale[0].value) return scale[0].color;
      if (value >= scale[scale.length - 1].value) return scale[scale.length - 1].color;

      let lower = scale[0], upper = scale[scale.length - 1];
      for (let i = 0; i < scale.length - 1; i++) {
        if (value >= scale[i].value && value <= scale[i + 1].value) {
          lower = scale[i];
          upper = scale[i + 1];
          break;
        }
      }

      const factor = (value - lower.value) / (upper.value - lower.value);

      const lowerColor = new THREE.Color(lower.color);
      const upperColor = new THREE.Color(upper.color);
      const result = new THREE.Color();
      result.lerpColors(lowerColor, upperColor, factor);

      return result.getHex();
    },

    toggleWalls() {
      this.wallsVisible = !this.wallsVisible;
      isoState.wallMeshes.forEach(wall => {
        wall.visible = this.wallsVisible;
      });
    },

    toggleDarkTheme() {
      this.darkTheme = !this.darkTheme;
      this.applyTheme();
    },

    applyTheme() {
      console.log('[isometric] applyTheme called, darkTheme:', this.darkTheme, 'renderer:', !!isoState.renderer);
      if (!isoState.renderer) {
        console.log('[isometric] No renderer available, skipping');
        return;
      }
      // Use setClearColor instead of scene.background (works with alpha: true)
      const color = this.darkTheme ? 0x0f172a : 0xE8E8EA;
      console.log('[isometric] Setting clear color to:', color.toString(16));
      isoState.renderer.setClearColor(color, 1);
      if (this.darkTheme && isoState.scene) {
        isoState.scene.fog = new THREE.Fog(0x0f172a, 10, 50);
      } else if (isoState.scene) {
        isoState.scene.fog = null;
      }
    },

    animate() {
      const self = this;
      function loop() {
        isoState.animationId = requestAnimationFrame(loop);

        self.updateRoomColors();
        self.updateLabels();

        if (isoState.renderer && isoState.scene && isoState.camera) {
          isoState.renderer.render(isoState.scene, isoState.camera);
        }
      }
      loop();
    },

    onResize() {
      const container = this.$refs.isoContainer;
      if (!container || !isoState.camera || !isoState.renderer) return;

      const aspect = container.clientWidth / container.clientHeight;
      const frustumSize = 15 / this.zoomLevel;

      // Update OrthographicCamera frustum
      isoState.camera.left = frustumSize * aspect / -2;
      isoState.camera.right = frustumSize * aspect / 2;
      isoState.camera.top = frustumSize / 2;
      isoState.camera.bottom = frustumSize / -2;
      isoState.camera.updateProjectionMatrix();

      isoState.renderer.setSize(container.clientWidth, container.clientHeight);
    },

    setViewMode(mode) {
      this.viewMode = mode;
    },

    getZoomPercent() {
      return Math.round(this.zoomLevel * 100);
    }
  };
}
