/**
 * Vision 8: 3D Floor Plan View
 * Interactive Three.js visualization of apartment with temperature heat map
 */

// Store Three.js objects OUTSIDE Alpine to avoid proxy conflicts
const threeState = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  roomMeshes: {},
  wallMeshes: [],
  labelElements: {},
  animationId: null,
  isInitialized: false
};

/**
 * Creates the 3D floor plan view component
 * @param {Object} FLOOR_PLAN_CONFIG - Floor plan configuration with room dimensions
 * @param {Array} TEMP_COLORS - Temperature color scale
 * @param {Array} HUMIDITY_COLORS - Humidity color scale
 * @param {Object} OrbitControls - Three.js OrbitControls class
 */
export function threeDView(FLOOR_PLAN_CONFIG, TEMP_COLORS, HUMIDITY_COLORS, OrbitControls) {
  // Calculate center for positioning
  const centerX = FLOOR_PLAN_CONFIG.apartmentWidth / 2;
  const centerZ = FLOOR_PLAN_CONFIG.apartmentDepth / 2;

  return {
    // Reactive state for UI
    viewMode: 'temperature',
    viewMode3D: 'top',
    wallsVisible: true,
    autoRotate: false,
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
      const container = this.$refs.threeContainer;

      // If container doesn't exist or has no dimensions, retry
      if (!container || container.clientWidth === 0 || container.clientHeight === 0) {
        setTimeout(() => this.waitForContainer(), 100);
        return;
      }

      // If already initialized, ensure canvas is in container and resize
      if (threeState.isInitialized && threeState.renderer) {
        // Re-attach canvas if it's not in the container
        if (!container.contains(threeState.renderer.domElement)) {
          container.appendChild(threeState.renderer.domElement);
        }
        this.createLabels(container);  // Recreate labels
        this.onResize();
        return;
      }

      // Clean up any existing Three.js objects
      if (threeState.renderer) {
        threeState.renderer.dispose();
      }
      if (threeState.scene) {
        threeState.scene.clear();
      }
      if (threeState.animationId) {
        cancelAnimationFrame(threeState.animationId);
      }

      this.initScene();
      this.initCamera(container, OrbitControls);
      this.initRenderer(container);
      this.applyTheme();  // Apply theme after renderer is ready
      this.initLighting();
      this.buildFloorPlan();
      this.createLabels(container);
      this.animate();
      threeState.isInitialized = true;

      window.addEventListener('resize', () => this.onResize());
    },

    initScene() {
      threeState.scene = new THREE.Scene();
      // Note: Background color is set via renderer.setClearColor in applyTheme()
      // which is called after renderer is initialized
    },

    initCamera(container, OrbitControls) {
      const aspect = container.clientWidth / container.clientHeight;

      // Use PerspectiveCamera for 3D viewing
      threeState.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
      // Default to top view - zoomed to fill screen, rotated 180° (scene is centered at 0,0,0)
      threeState.camera.position.set(0, 14, -0.1);
      threeState.camera.lookAt(0, 0, 0);

      // Add OrbitControls for interactive camera
      threeState.controls = new OrbitControls(threeState.camera, container);
      threeState.controls.enableDamping = true;
      threeState.controls.dampingFactor = 0.05;
      threeState.controls.maxPolarAngle = Math.PI / 2.1;  // Prevent camera below floor
      threeState.controls.minDistance = 5;
      threeState.controls.maxDistance = 40;
      threeState.controls.target.set(0, 0, 0);
      threeState.controls.update();
    },

    initRenderer(container) {
      threeState.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
      });
      threeState.renderer.setSize(container.clientWidth, container.clientHeight);
      threeState.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      threeState.renderer.shadowMap.enabled = true;
      threeState.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(threeState.renderer.domElement);
    },

    initLighting() {
      const ambient = new THREE.AmbientLight(0xffffff, 0.6);
      threeState.scene.add(ambient);

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
      threeState.scene.add(directional);

      const fill = new THREE.DirectionalLight(0xffffff, 0.3);
      fill.position.set(-10, 10, -10);
      threeState.scene.add(fill);
    },

    buildFloorPlan() {
      // Clear wall meshes array for fresh build
      threeState.wallMeshes = [];

      // Base floor - uses apartment dimensions, centered at origin
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
      threeState.scene.add(floor);

      // Build each room
      FLOOR_PLAN_CONFIG.rooms.forEach(roomConfig => {
        const roomGroup = this.createRoom(roomConfig);
        threeState.roomMeshes[roomConfig.id] = roomGroup;
        threeState.scene.add(roomGroup);
      });

      // Hallway floor (centered coordinates)
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
      threeState.scene.add(hallway);

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
      threeState.scene.add(balcony);

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

      // Room floor - colored transparent box matching room color
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

      // Glassy wall material - semi-transparent for elegant look
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
      const rx = config.x - centerX;  // room center X (relative)
      const rz = config.z - centerZ;  // room center Z (relative)

      // Back wall (north)
      const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(config.width, wallHeight, 0.15),
        wallMaterial
      );
      backWall.position.set(rx, wallHeight/2, rz - halfD);
      backWall.castShadow = true;
      group.add(backWall);
      threeState.wallMeshes.push(backWall);

      // Front wall (south) - full height for immersive 3D
      const frontWall = new THREE.Mesh(
        new THREE.BoxGeometry(config.width, wallHeight, 0.15),
        wallMaterial
      );
      frontWall.position.set(rx, wallHeight/2, rz + halfD);
      frontWall.castShadow = true;
      group.add(frontWall);
      threeState.wallMeshes.push(frontWall);

      // Left wall (west)
      const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, wallHeight, config.depth),
        wallMaterial
      );
      leftWall.position.set(rx - halfW, wallHeight/2, rz);
      leftWall.castShadow = true;
      group.add(leftWall);
      threeState.wallMeshes.push(leftWall);

      // Right wall (east)
      const rightWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, wallHeight, config.depth),
        wallMaterial
      );
      rightWall.position.set(rx + halfW, wallHeight/2, rz);
      rightWall.castShadow = true;
      group.add(rightWall);
      threeState.wallMeshes.push(rightWall);

      return group;
    },

    // Create door with handle and swing arc
    createDoor(doorConfig) {
      const doorWidth = 0.9;
      const doorHeight = FLOOR_PLAN_CONFIG.wallHeight * 0.85;
      const posX = doorConfig.x - centerX;
      const posZ = doorConfig.z - centerZ;

      // Check door type
      if (doorConfig.type === 'french') {
        // French doors - double glass doors opening inward
        this.createFrenchDoor(doorConfig, posX, posZ, doorWidth, doorHeight);
        return;
      }

      // Standard door material (brown wood)
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
      threeState.scene.add(door);

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

      // Position handle based on door rotation
      const handleOffsetX = 0.3 * Math.cos(doorConfig.rotation || 0);
      const handleOffsetZ = 0.3 * Math.sin(doorConfig.rotation || 0);
      handle.position.set(
        posX + handleOffsetX,
        doorHeight * 0.45,
        posZ + handleOffsetZ
      );
      handle.rotation.z = Math.PI / 2;
      threeState.scene.add(handle);

      // Add swing arc on floor
      this.createSwingArc(doorConfig, posX, posZ, doorWidth);
    },

    // Create French doors (double glass doors)
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

      // Total width for double doors
      const totalWidth = doorWidth * 2;
      const gap = 0.05;  // Small gap between doors

      // Left door panel
      const leftDoor = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth - gap/2, doorHeight, 0.06),
        glassMaterial
      );

      // Right door panel
      const rightDoor = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth - gap/2, doorHeight, 0.06),
        glassMaterial
      );

      // Position based on rotation
      const rot = doorConfig.rotation || 0;
      const offsetLeft = (doorWidth/2 + gap/4) * Math.cos(rot + Math.PI/2);
      const offsetLeftZ = (doorWidth/2 + gap/4) * Math.sin(rot + Math.PI/2);
      const offsetRight = (doorWidth/2 + gap/4) * Math.cos(rot - Math.PI/2);
      const offsetRightZ = (doorWidth/2 + gap/4) * Math.sin(rot - Math.PI/2);

      leftDoor.position.set(posX + offsetLeft, doorHeight/2, posZ + offsetLeftZ);
      leftDoor.rotation.y = rot;
      rightDoor.position.set(posX + offsetRight, doorHeight/2, posZ + offsetRightZ);
      rightDoor.rotation.y = rot;

      threeState.scene.add(leftDoor);
      threeState.scene.add(rightDoor);

      // Add door frames
      const frameThickness = 0.05;

      // Vertical frame divider in center
      const centerFrame = new THREE.Mesh(
        new THREE.BoxGeometry(frameThickness, doorHeight, 0.08),
        frameMaterial
      );
      centerFrame.position.set(posX, doorHeight/2, posZ);
      centerFrame.rotation.y = rot;
      threeState.scene.add(centerFrame);

      // Add TWO swing arcs (one for each door, opening inward)
      this.createSwingArc({ ...doorConfig, swingDirection: 'inward-left' }, posX + offsetLeft, posZ + offsetLeftZ, doorWidth);
      this.createSwingArc({ ...doorConfig, swingDirection: 'inward-right' }, posX + offsetRight, posZ + offsetRightZ, doorWidth);
    },

    // Create swing arc on floor showing door opening direction
    createSwingArc(doorConfig, posX, posZ, doorWidth) {
      const arcRadius = doorWidth;
      const arcSegments = 32;

      // Determine arc angles based on swing direction
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

      // Create arc curve
      const curve = new THREE.EllipseCurve(
        0, 0,           // center
        arcRadius, arcRadius,  // xRadius, yRadius
        startAngle, endAngle,  // start and end angles
        false,          // clockwise
        0               // rotation
      );

      const points = curve.getPoints(arcSegments);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);

      // Arc line material
      const arcMaterial = new THREE.LineBasicMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.6
      });

      const arc = new THREE.Line(geometry, arcMaterial);
      arc.rotation.x = -Math.PI / 2;  // Lay flat on floor
      arc.position.set(posX, 0.02, posZ);  // Slightly above floor

      threeState.scene.add(arc);
    },

    // Create window with glass pane
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
      threeState.scene.add(frame);

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
      threeState.scene.add(glass);
    },

    // Create balcony railing
    createBalconyRailing() {
      const bal = FLOOR_PLAN_CONFIG.balcony;
      const railingHeight = 1.0;
      const railingMaterial = new THREE.MeshStandardMaterial({
        color: 0x374151,
        metalness: 0.7,
        roughness: 0.3
      });

      // Front railing (facing outward)
      const frontRailing = new THREE.Mesh(
        new THREE.BoxGeometry(bal.width, railingHeight, 0.05),
        railingMaterial
      );
      frontRailing.position.set(
        bal.x - centerX,
        railingHeight / 2,
        bal.z - centerZ + bal.depth / 2
      );
      threeState.scene.add(frontRailing);

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
      threeState.scene.add(leftRailing);

      // Vertical posts (glass panel supports)
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
        threeState.scene.add(post);
      });

      // Glass panel for railing
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
      threeState.scene.add(glassPanel);
    },

    // Create furniture
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
        threeState.scene.add(mesh);

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
          threeState.scene.add(bedding);
        }
      });
    },

    createLabels(container) {
      // Clear any existing labels first
      Object.values(threeState.labelElements).forEach(label => {
        if (label && label.parentNode) {
          label.parentNode.removeChild(label);
        }
      });
      threeState.labelElements = {};

      // Also remove any orphaned labels
      container.querySelectorAll('.room-3d-label').forEach(el => el.remove());

      FLOOR_PLAN_CONFIG.rooms.forEach(roomConfig => {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'room-3d-label';
        labelDiv.innerHTML = `
          <div class="label-icon">${roomConfig.icon}</div>
          <div class="label-name">${roomConfig.name}</div>
          <div class="label-value" data-room="${roomConfig.id}">--</div>
          <div class="label-secondary" data-room-secondary="${roomConfig.id}">--</div>
        `;
        container.appendChild(labelDiv);
        threeState.labelElements[roomConfig.id] = labelDiv;
      });
    },

    updateLabels() {
      const container = this.$refs.threeContainer;
      if (!container || !threeState.camera) return;

      const rooms = Alpine.store('rooms')?.list || [];
      const viewMode = this.viewMode;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      FLOOR_PLAN_CONFIG.rooms.forEach(config => {
        const label = threeState.labelElements[config.id];
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

        // Project 3D to 2D - use labelY offset to prevent overlap
        // config.x, config.z are center coordinates; convert to world space
        const position = new THREE.Vector3(
          config.x - centerX,
          config.labelY || 3,
          config.z - centerZ
        );
        position.project(threeState.camera);

        const x = (position.x * 0.5 + 0.5) * containerWidth;
        const y = (-position.y * 0.5 + 0.5) * containerHeight;

        label.style.left = `${x}px`;
        label.style.top = `${y}px`;

        // Only show label if within container bounds and container is visible
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
        const meshGroup = threeState.roomMeshes[roomData.id];
        if (!meshGroup) return;

        // Find floor mesh directly in children
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

    animate() {
      const self = this;
      function loop() {
        threeState.animationId = requestAnimationFrame(loop);

        // Update OrbitControls (required for damping)
        if (threeState.controls) {
          threeState.controls.update();
        }

        self.updateRoomColors();
        self.updateLabels();

        if (threeState.renderer && threeState.scene && threeState.camera) {
          threeState.renderer.render(threeState.scene, threeState.camera);
        }
      }
      loop();
    },

    onResize() {
      const container = this.$refs.threeContainer;
      if (!container || !threeState.camera || !threeState.renderer) return;

      const aspect = container.clientWidth / container.clientHeight;

      // Update PerspectiveCamera aspect ratio
      threeState.camera.aspect = aspect;
      threeState.camera.updateProjectionMatrix();

      threeState.renderer.setSize(container.clientWidth, container.clientHeight);
    },

    setViewMode(mode) {
      this.viewMode = mode;
    },

    // View control functions
    set3DView() {
      this.viewMode3D = '3d';
      if (threeState.camera && threeState.controls) {
        threeState.camera.position.set(12, 12, 12);
        threeState.controls.target.set(0, 0, 0);
        threeState.controls.update();
      }
    },

    setTopView() {
      this.viewMode3D = 'top';
      if (threeState.camera && threeState.controls) {
        threeState.camera.position.set(0, 14, -0.1);
        threeState.controls.target.set(0, 0, 0);
        threeState.controls.update();
      }
    },

    toggleWalls() {
      this.wallsVisible = !this.wallsVisible;
      threeState.wallMeshes.forEach(wall => {
        wall.visible = this.wallsVisible;
      });
    },

    toggleAutoRotate() {
      this.autoRotate = !this.autoRotate;
      if (threeState.controls) {
        threeState.controls.autoRotate = this.autoRotate;
        threeState.controls.autoRotateSpeed = 2.0;
      }
    },

    toggleDarkTheme() {
      this.darkTheme = !this.darkTheme;
      this.applyTheme();
    },

    applyTheme() {
      if (!threeState.renderer) return;
      // Use setClearColor instead of scene.background (works with alpha: true)
      if (this.darkTheme) {
        threeState.renderer.setClearColor(0x0f172a, 1);
        if (threeState.scene) threeState.scene.fog = new THREE.Fog(0x0f172a, 10, 50);
      } else {
        threeState.renderer.setClearColor(0xE8E8EA, 1);
        if (threeState.scene) threeState.scene.fog = null;
      }
    },

    zoomIn() {
      if (threeState.camera && threeState.controls) {
        const direction = new THREE.Vector3();
        direction.subVectors(threeState.controls.target, threeState.camera.position).normalize();
        threeState.camera.position.addScaledVector(direction, 2);
        threeState.controls.update();
      }
    },

    zoomOut() {
      if (threeState.camera && threeState.controls) {
        const direction = new THREE.Vector3();
        direction.subVectors(threeState.controls.target, threeState.camera.position).normalize();
        threeState.camera.position.addScaledVector(direction, -2);
        threeState.controls.update();
      }
    },

    getLegendItems() {
      if (this.viewMode === 'temperature') {
        return [
          { label: '< 20°', color: '#90CAF9' },
          { label: '20-24°', color: '#81C784' },
          { label: '24-28°', color: '#FFE082' },
          { label: '> 28°', color: '#EF5350' }
        ];
      } else {
        return [
          { label: '< 40%', color: '#FFCC80' },
          { label: '40-60%', color: '#81C784' },
          { label: '60-70%', color: '#90CAF9' },
          { label: '> 70%', color: '#5C6BC0' }
        ];
      }
    }
  };
}
