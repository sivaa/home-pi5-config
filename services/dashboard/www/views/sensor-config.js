/**
 * Vision 9: Sensor Configuration View
 * 3D drag-drop interface for placing sensors on the floor plan
 */

// Store Three.js objects OUTSIDE Alpine to avoid proxy conflicts
const configThreeState = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  roomMeshes: {},
  sensorMeshes: {},      // { [ieeeAddress]: THREE.Mesh }
  coverageMeshes: {},    // { [ieeeAddress]: THREE.Mesh } for motion cones
  wallMeshes: [],
  floorPlane: null,      // For raycasting
  raycaster: null,
  mouse: new THREE.Vector2(),
  animationId: null,
  isInitialized: false
};

// Drag state
const dragState = {
  isDragging: false,
  draggedSensor: null,       // IEEE address of sensor being dragged
  draggedMesh: null,         // The 3D mesh being dragged
  previewMesh: null,         // Preview mesh during drag from palette
  startPosition: null,       // Original position before drag
  isValid: true,             // Current placement validity
  validationErrors: []
};

/**
 * Creates the sensor configuration view component
 */
export function sensorConfigView(FLOOR_PLAN_CONFIG, SENSOR_VISUALS, OrbitControls) {
  const centerX = FLOOR_PLAN_CONFIG.apartmentWidth / 2;
  const centerZ = FLOOR_PLAN_CONFIG.apartmentDepth / 2;

  return {
    // UI State
    showMotionCoverage: false,
    selectedSensor: null,
    searchQuery: '',
    expandedTypes: { climate: true, co2: true, motion: true, contact: true },
    showHelp: false,
    isTopView: false,

    // Tooltip as object for template compatibility
    tooltip: { text: '', visible: false, x: 0, y: 0 },

    init() {
      this.waitForContainer();

      // Initialize sensors store if needed
      const sensorsStore = Alpine.store('sensors');
      if (sensorsStore && !sensorsStore.devices.length) {
        sensorsStore.init();
      }

      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => this.handleKeydown(e));
    },

    waitForContainer() {
      const container = this.$refs.configCanvas;

      if (!container || container.clientWidth === 0 || container.clientHeight === 0) {
        setTimeout(() => this.waitForContainer(), 100);
        return;
      }

      if (configThreeState.isInitialized && configThreeState.renderer) {
        if (!container.contains(configThreeState.renderer.domElement)) {
          container.appendChild(configThreeState.renderer.domElement);
        }
        this.onResize();
        return;
      }

      this.initScene();
      this.initCamera(container, OrbitControls);
      this.initRenderer(container);
      this.initLighting();
      this.initRaycaster();
      this.buildFloorPlan();
      this.setupEventListeners(container);
      this.animate();

      configThreeState.isInitialized = true;
    },

    initScene() {
      configThreeState.scene = new THREE.Scene();
      configThreeState.scene.background = new THREE.Color(0x1a1a2e);
    },

    initCamera(container, OrbitControls) {
      const aspect = container.clientWidth / container.clientHeight;
      configThreeState.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
      configThreeState.camera.position.set(0, 12, 8);
      configThreeState.camera.lookAt(0, 0, 0);

      configThreeState.controls = new OrbitControls(configThreeState.camera, container);
      configThreeState.controls.enableDamping = true;
      configThreeState.controls.dampingFactor = 0.05;
      configThreeState.controls.maxPolarAngle = Math.PI / 2.1;
      configThreeState.controls.minDistance = 5;
      configThreeState.controls.maxDistance = 30;
      configThreeState.controls.target.set(0, 0, 0);
      configThreeState.controls.update();
    },

    initRenderer(container) {
      configThreeState.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
      });
      configThreeState.renderer.setSize(container.clientWidth, container.clientHeight);
      configThreeState.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      configThreeState.renderer.shadowMap.enabled = true;
      container.appendChild(configThreeState.renderer.domElement);
    },

    initLighting() {
      const ambient = new THREE.AmbientLight(0xffffff, 0.5);
      configThreeState.scene.add(ambient);

      const directional = new THREE.DirectionalLight(0xffffff, 0.8);
      directional.position.set(10, 20, 10);
      directional.castShadow = true;
      configThreeState.scene.add(directional);

      const fill = new THREE.DirectionalLight(0xffffff, 0.3);
      fill.position.set(-10, 10, -10);
      configThreeState.scene.add(fill);
    },

    initRaycaster() {
      configThreeState.raycaster = new THREE.Raycaster();

      // Create invisible floor plane for raycasting
      const planeGeometry = new THREE.PlaneGeometry(
        FLOOR_PLAN_CONFIG.apartmentWidth + 4,
        FLOOR_PLAN_CONFIG.apartmentDepth + 4
      );
      const planeMaterial = new THREE.MeshBasicMaterial({
        visible: false,
        side: THREE.DoubleSide
      });
      configThreeState.floorPlane = new THREE.Mesh(planeGeometry, planeMaterial);
      configThreeState.floorPlane.rotation.x = -Math.PI / 2;
      configThreeState.floorPlane.position.y = 0;
      configThreeState.scene.add(configThreeState.floorPlane);
    },

    buildFloorPlan() {
      const apW = FLOOR_PLAN_CONFIG.apartmentWidth;
      const apD = FLOOR_PLAN_CONFIG.apartmentDepth;

      // Base floor
      const floorGeometry = new THREE.PlaneGeometry(apW + 2, apD + 2);
      const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2a4a,
        roughness: 0.8
      });
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0, -0.01, 0);
      floor.receiveShadow = true;
      configThreeState.scene.add(floor);

      // Build rooms
      FLOOR_PLAN_CONFIG.rooms.forEach(roomConfig => {
        const roomGroup = this.createRoom(roomConfig);
        configThreeState.roomMeshes[roomConfig.id] = roomGroup;
        configThreeState.scene.add(roomGroup);
      });

      // Hallway
      const hw = FLOOR_PLAN_CONFIG.hallway;
      const hallwayGeometry = new THREE.PlaneGeometry(hw.width, hw.depth);
      const hallwayMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3a5a, roughness: 0.7 });
      const hallway = new THREE.Mesh(hallwayGeometry, hallwayMaterial);
      hallway.rotation.x = -Math.PI / 2;
      hallway.position.set(hw.x - centerX, 0.005, hw.z - centerZ);
      hallway.receiveShadow = true;
      configThreeState.scene.add(hallway);

      // Balcony
      const bal = FLOOR_PLAN_CONFIG.balcony;
      const balconyGeometry = new THREE.PlaneGeometry(bal.width, bal.depth);
      const balconyMaterial = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.5 });
      const balcony = new THREE.Mesh(balconyGeometry, balconyMaterial);
      balcony.rotation.x = -Math.PI / 2;
      balcony.position.set(bal.x - centerX, 0.003, bal.z - centerZ);
      configThreeState.scene.add(balcony);

      // Add doors and windows (simplified)
      this.addDoorsAndWindows();
    },

    createRoom(config) {
      const group = new THREE.Group();
      const wallHeight = FLOOR_PLAN_CONFIG.wallHeight;

      // Room floor
      const floorGeometry = new THREE.BoxGeometry(config.width, 0.05, config.depth);
      const floorMaterial = new THREE.MeshStandardMaterial({
        color: config.color,
        transparent: true,
        opacity: 0.4,
        roughness: 0.6
      });
      const roomFloor = new THREE.Mesh(floorGeometry, floorMaterial);
      roomFloor.position.set(config.x - centerX, 0.025, config.z - centerZ);
      roomFloor.receiveShadow = true;
      roomFloor.name = 'floor_' + config.id;
      roomFloor.userData.roomId = config.id;
      group.add(roomFloor);

      // Semi-transparent walls
      const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide
      });

      const halfW = config.width / 2;
      const halfD = config.depth / 2;
      const rx = config.x - centerX;
      const rz = config.z - centerZ;

      // Four walls
      const walls = [
        { pos: [rx, wallHeight/2, rz - halfD], size: [config.width, wallHeight, 0.1] },
        { pos: [rx, wallHeight/2, rz + halfD], size: [config.width, wallHeight, 0.1] },
        { pos: [rx - halfW, wallHeight/2, rz], size: [0.1, wallHeight, config.depth] },
        { pos: [rx + halfW, wallHeight/2, rz], size: [0.1, wallHeight, config.depth] }
      ];

      walls.forEach(w => {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(...w.size),
          wallMaterial
        );
        wall.position.set(...w.pos);
        group.add(wall);
        configThreeState.wallMeshes.push(wall);
      });

      // Room label
      this.addRoomLabel(config, group);

      return group;
    },

    addRoomLabel(config, group) {
      // Create canvas for label
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 256;
      canvas.height = 64;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = '24px Inter, sans-serif';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.fillText(`${config.icon} ${config.name}`, canvas.width/2, 40);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(2, 0.5, 1);
      sprite.position.set(config.x - centerX, 0.5, config.z - centerZ);
      group.add(sprite);
    },

    addDoorsAndWindows() {
      // Simplified door markers
      FLOOR_PLAN_CONFIG.doors.forEach(door => {
        const marker = new THREE.Mesh(
          new THREE.BoxGeometry(0.8, 0.05, 0.2),
          new THREE.MeshStandardMaterial({ color: 0x8B4513 })
        );
        marker.position.set(door.x - centerX, 0.025, door.z - centerZ);
        marker.rotation.y = door.rotation || 0;
        configThreeState.scene.add(marker);
      });

      // Window markers
      FLOOR_PLAN_CONFIG.windows.forEach(win => {
        const marker = new THREE.Mesh(
          new THREE.BoxGeometry(win.size || 1.5, 0.05, 0.1),
          new THREE.MeshStandardMaterial({ color: 0x87CEEB, transparent: true, opacity: 0.5 })
        );
        marker.position.set(win.x - centerX, 0.025, win.z - centerZ);
        marker.rotation.y = win.rotation || 0;
        configThreeState.scene.add(marker);
      });
    },

    setupEventListeners(container) {
      const canvas = configThreeState.renderer.domElement;

      // Mouse events
      canvas.addEventListener('mousemove', (e) => this.onMouseMove(e, container));
      canvas.addEventListener('mousedown', (e) => this.onMouseDown(e, container));
      canvas.addEventListener('mouseup', (e) => this.onMouseUp(e, container));

      // Touch events
      canvas.addEventListener('touchstart', (e) => this.onTouchStart(e, container), { passive: false });
      canvas.addEventListener('touchmove', (e) => this.onTouchMove(e, container), { passive: false });
      canvas.addEventListener('touchend', (e) => this.onTouchEnd(e, container));

      // Resize
      window.addEventListener('resize', () => this.onResize());
    },

    onMouseMove(event, container) {
      const rect = container.getBoundingClientRect();
      configThreeState.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      configThreeState.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Update tooltip position
      this.tooltip.x = event.clientX - rect.left;
      this.tooltip.y = event.clientY - rect.top;

      if (dragState.isDragging && dragState.draggedMesh) {
        this.updateDragPosition();
      } else {
        this.updateHover();
      }
    },

    onMouseDown(event, container) {
      if (event.button !== 0) return; // Left click only

      configThreeState.raycaster.setFromCamera(configThreeState.mouse, configThreeState.camera);

      // Check if clicking on a sensor
      const sensorMeshes = Object.values(configThreeState.sensorMeshes);
      const intersects = configThreeState.raycaster.intersectObjects(sensorMeshes);

      if (intersects.length > 0) {
        const mesh = intersects[0].object;
        const ieeeAddress = mesh.userData.ieeeAddress;

        // Start dragging
        dragState.isDragging = true;
        dragState.draggedSensor = ieeeAddress;
        dragState.draggedMesh = mesh;
        dragState.startPosition = mesh.position.clone();

        // Disable orbit controls during drag
        configThreeState.controls.enabled = false;

        this.selectedSensor = ieeeAddress;
        event.preventDefault();
      }
    },

    onMouseUp(event, container) {
      if (!dragState.isDragging) return;

      if (dragState.isValid && dragState.draggedMesh) {
        // Save position
        const position = dragState.draggedMesh.position;
        const roomId = this.detectRoom(position.x, position.z);

        Alpine.store('sensors').savePosition(
          dragState.draggedSensor,
          { x: position.x, y: position.y, z: position.z },
          roomId
        );
      } else if (dragState.startPosition) {
        // Revert to original position
        dragState.draggedMesh.position.copy(dragState.startPosition);
      }

      // Reset drag state
      this.resetDragState();
    },

    onTouchStart(event, container) {
      if (event.touches.length !== 1) return;
      event.preventDefault();

      const touch = event.touches[0];
      const rect = container.getBoundingClientRect();
      configThreeState.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      configThreeState.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

      // Simulate mouse down
      this.onMouseDown({ button: 0, clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {} }, container);
    },

    onTouchMove(event, container) {
      if (event.touches.length !== 1) return;
      event.preventDefault();

      const touch = event.touches[0];
      const rect = container.getBoundingClientRect();
      configThreeState.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      configThreeState.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

      if (dragState.isDragging) {
        this.updateDragPosition();
      }
    },

    onTouchEnd(event, container) {
      this.onMouseUp(event, container);
    },

    updateDragPosition() {
      if (!dragState.draggedMesh) return;

      configThreeState.raycaster.setFromCamera(configThreeState.mouse, configThreeState.camera);
      const intersects = configThreeState.raycaster.intersectObject(configThreeState.floorPlane);

      if (intersects.length > 0) {
        const point = intersects[0].point;
        const sensor = Alpine.store('sensors').getSensor(dragState.draggedSensor);
        const visuals = sensor ? SENSOR_VISUALS[sensor.sensorType] : SENSOR_VISUALS.climate;

        // Update position
        dragState.draggedMesh.position.x = point.x;
        dragState.draggedMesh.position.z = point.z;
        dragState.draggedMesh.position.y = visuals.heightAboveFloor;

        // Validate placement
        const validation = this.validatePlacement(point.x, point.z, sensor?.sensorType);
        dragState.isValid = validation.valid;
        dragState.validationErrors = validation.errors;

        // Visual feedback
        this.updateDragFeedback(validation);
      }
    },

    updateDragFeedback(validation) {
      if (!dragState.draggedMesh) return;

      if (validation.valid) {
        dragState.draggedMesh.material.emissive.setHex(0x00ff00);
        dragState.draggedMesh.material.emissiveIntensity = 0.5;
        this.tooltip.visible = false;
      } else {
        dragState.draggedMesh.material.emissive.setHex(0xff0000);
        dragState.draggedMesh.material.emissiveIntensity = 0.5;
        this.tooltip.text = validation.errors[0] || 'Invalid placement';
        this.tooltip.visible = true;
      }
    },

    updateHover() {
      configThreeState.raycaster.setFromCamera(configThreeState.mouse, configThreeState.camera);
      const sensorMeshes = Object.values(configThreeState.sensorMeshes);
      const intersects = configThreeState.raycaster.intersectObjects(sensorMeshes);

      if (intersects.length > 0) {
        const mesh = intersects[0].object;
        const ieeeAddress = mesh.userData.ieeeAddress;
        const sensor = Alpine.store('sensors').getSensor(ieeeAddress);
        const liveData = Alpine.store('sensors').getLiveData(ieeeAddress);

        if (sensor) {
          this.tooltip.text = this.formatTooltip(sensor, liveData);
          this.tooltip.visible = true;
        }
      } else {
        this.tooltip.visible = false;
      }
    },

    formatTooltip(sensor, liveData) {
      let text = `${sensor.friendly_name}\n${sensor.model}`;

      if (liveData) {
        if (liveData.temperature !== undefined) {
          text += `\n${liveData.temperature.toFixed(1)}°C`;
        }
        if (liveData.humidity !== undefined) {
          text += ` ${liveData.humidity.toFixed(0)}%`;
        }
        if (liveData.co2 !== undefined) {
          text += `\n${liveData.co2} ppm`;
        }
        if (liveData.occupancy !== undefined) {
          text += `\n${liveData.occupancy ? 'Motion detected' : 'Clear'}`;
        }
        if (liveData.contact !== undefined) {
          text += `\n${liveData.contact ? 'Closed' : 'Open'}`;
        }
      }

      return text;
    },

    validatePlacement(x, z, sensorType) {
      const errors = [];
      const sensorsStore = Alpine.store('sensors');

      // Check apartment bounds
      const halfW = FLOOR_PLAN_CONFIG.apartmentWidth / 2;
      const halfD = FLOOR_PLAN_CONFIG.apartmentDepth / 2;
      if (Math.abs(x) > halfW || Math.abs(z) > halfD) {
        errors.push('Outside apartment bounds');
      }

      // Detect room
      const roomId = this.detectRoom(x, z);
      if (!roomId) {
        errors.push('Must be placed in a room');
      }

      // Contact sensors must be near door/window
      if (sensorType === 'contact') {
        const nearDoor = this.isNearDoorOrWindow(x, z);
        if (!nearDoor) {
          errors.push('Contact sensor must be near a door or window');
        }
      }

      // Check minimum separation
      const MIN_SEP = 0.3;
      for (const [id, pos] of Object.entries(sensorsStore.positions)) {
        if (id === dragState.draggedSensor) continue;
        const dist = Math.hypot(x - pos.x, z - pos.z);
        if (dist < MIN_SEP) {
          errors.push('Too close to another sensor');
          break;
        }
      }

      return { valid: errors.length === 0, errors, roomId };
    },

    detectRoom(x, z) {
      // Convert from scene coords to config coords
      const absX = x + centerX;
      const absZ = z + centerZ;

      for (const room of FLOOR_PLAN_CONFIG.rooms) {
        const halfW = room.width / 2;
        const halfD = room.depth / 2;

        if (absX >= room.x - halfW && absX <= room.x + halfW &&
            absZ >= room.z - halfD && absZ <= room.z + halfD) {
          return room.id;
        }
      }

      // Check hallway
      const hw = FLOOR_PLAN_CONFIG.hallway;
      if (absX >= hw.x - hw.width/2 && absX <= hw.x + hw.width/2 &&
          absZ >= hw.z - hw.depth/2 && absZ <= hw.z + hw.depth/2) {
        return 'hallway';
      }

      // Check balcony
      const bal = FLOOR_PLAN_CONFIG.balcony;
      if (absX >= bal.x - bal.width/2 && absX <= bal.x + bal.width/2 &&
          absZ >= bal.z - bal.depth/2 && absZ <= bal.z + bal.depth/2) {
        return 'balcony';
      }

      return null;
    },

    isNearDoorOrWindow(x, z) {
      const absX = x + centerX;
      const absZ = z + centerZ;
      const threshold = 1.0; // 1 meter

      for (const door of FLOOR_PLAN_CONFIG.doors) {
        const dist = Math.hypot(absX - door.x, absZ - door.z);
        if (dist < threshold) return true;
      }

      for (const win of FLOOR_PLAN_CONFIG.windows) {
        const dist = Math.hypot(absX - win.x, absZ - win.z);
        if (dist < threshold) return true;
      }

      return false;
    },

    resetDragState() {
      if (dragState.draggedMesh) {
        // Reset material
        const sensor = Alpine.store('sensors').getSensor(dragState.draggedSensor);
        const visuals = sensor ? SENSOR_VISUALS[sensor.sensorType] : SENSOR_VISUALS.climate;
        dragState.draggedMesh.material.emissive.setHex(visuals.emissive);
        dragState.draggedMesh.material.emissiveIntensity = visuals.emissiveIntensity;
      }

      dragState.isDragging = false;
      dragState.draggedSensor = null;
      dragState.draggedMesh = null;
      dragState.startPosition = null;
      dragState.isValid = true;
      dragState.validationErrors = [];

      configThreeState.controls.enabled = true;
      this.tooltip.visible = false;
    },

    /**
     * Create 3D mesh for a sensor
     */
    createSensorMesh(sensor, position) {
      const visuals = SENSOR_VISUALS[sensor.sensorType] || SENSOR_VISUALS.climate;
      let geometry;

      switch (visuals.shape) {
        case 'cube':
          geometry = new THREE.BoxGeometry(visuals.size.width, visuals.size.height, visuals.size.depth);
          break;
        case 'cylinder':
          geometry = new THREE.CylinderGeometry(visuals.size.radius, visuals.size.radius, visuals.size.height, 16);
          break;
        case 'sphere':
          geometry = new THREE.SphereGeometry(visuals.size.radius, 16, 16);
          break;
        case 'box':
          geometry = new THREE.BoxGeometry(visuals.size.width, visuals.size.height, visuals.size.depth);
          break;
        default:
          geometry = new THREE.BoxGeometry(0.1, 0.05, 0.1);
      }

      const material = new THREE.MeshStandardMaterial({
        color: visuals.color,
        emissive: visuals.emissive,
        emissiveIntensity: visuals.emissiveIntensity,
        metalness: 0.3,
        roughness: 0.4
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(position.x, position.y || visuals.heightAboveFloor, position.z);
      mesh.castShadow = true;
      mesh.userData.ieeeAddress = sensor.ieee_address;
      mesh.userData.sensorType = sensor.sensorType;

      return mesh;
    },

    /**
     * Create motion sensor coverage cone
     */
    createCoverageCone(sensor, position) {
      const visuals = SENSOR_VISUALS.motion;
      const halfAngle = (visuals.fov / 2) * (Math.PI / 180);
      const radius = Math.tan(halfAngle) * visuals.range;

      const geometry = new THREE.ConeGeometry(radius, visuals.range, 32);
      const material = new THREE.MeshBasicMaterial({
        color: visuals.color,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide
      });

      const cone = new THREE.Mesh(geometry, material);
      cone.rotation.x = Math.PI; // Point downward
      cone.position.set(position.x, visuals.heightAboveFloor - visuals.range/2, position.z);
      cone.visible = this.showMotionCoverage;

      return cone;
    },

    /**
     * Update sensor meshes from store
     */
    updateSensorMeshes() {
      const sensorsStore = Alpine.store('sensors');
      if (!sensorsStore) return;

      // Remove meshes for sensors no longer positioned
      for (const [ieee, mesh] of Object.entries(configThreeState.sensorMeshes)) {
        if (!sensorsStore.positions[ieee]) {
          configThreeState.scene.remove(mesh);
          delete configThreeState.sensorMeshes[ieee];

          // Remove coverage cone if exists
          if (configThreeState.coverageMeshes[ieee]) {
            configThreeState.scene.remove(configThreeState.coverageMeshes[ieee]);
            delete configThreeState.coverageMeshes[ieee];
          }
        }
      }

      // Add/update meshes for positioned sensors
      for (const [ieee, pos] of Object.entries(sensorsStore.positions)) {
        const sensor = sensorsStore.getSensor(ieee);
        if (!sensor) continue;

        if (!configThreeState.sensorMeshes[ieee]) {
          // Create new mesh
          const mesh = this.createSensorMesh(sensor, pos);
          configThreeState.scene.add(mesh);
          configThreeState.sensorMeshes[ieee] = mesh;

          // Add coverage cone for motion sensors
          if (sensor.sensorType === 'motion') {
            const cone = this.createCoverageCone(sensor, pos);
            configThreeState.scene.add(cone);
            configThreeState.coverageMeshes[ieee] = cone;
          }
        } else {
          // Update position if changed externally (multi-device sync)
          const mesh = configThreeState.sensorMeshes[ieee];
          if (mesh !== dragState.draggedMesh) {
            mesh.position.set(pos.x, pos.y, pos.z);
          }

          // Update coverage cone position
          const cone = configThreeState.coverageMeshes[ieee];
          if (cone) {
            cone.position.set(pos.x, SENSOR_VISUALS.motion.heightAboveFloor - SENSOR_VISUALS.motion.range/2, pos.z);
          }
        }
      }
    },

    /**
     * Toggle motion coverage visibility
     */
    toggleCoverage() {
      this.showMotionCoverage = !this.showMotionCoverage;

      for (const cone of Object.values(configThreeState.coverageMeshes)) {
        cone.visible = this.showMotionCoverage;
      }
    },

    /**
     * Handle keyboard shortcuts
     */
    handleKeydown(event) {
      if (event.key === 'Escape') {
        if (dragState.isDragging) {
          // Cancel drag
          if (dragState.startPosition) {
            dragState.draggedMesh.position.copy(dragState.startPosition);
          }
          this.resetDragState();
        }
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        if (this.selectedSensor && !dragState.isDragging) {
          Alpine.store('sensors').removePosition(this.selectedSensor);
          this.selectedSensor = null;
        }
      }
    },

    /**
     * Start drag from palette
     */
    startDragFromPalette(ieeeAddress) {
      const sensorsStore = Alpine.store('sensors');
      const sensor = sensorsStore.getSensor(ieeeAddress);
      if (!sensor) return;

      // Create preview mesh if not exists
      if (!configThreeState.sensorMeshes[ieeeAddress]) {
        const visuals = SENSOR_VISUALS[sensor.sensorType] || SENSOR_VISUALS.climate;
        const mesh = this.createSensorMesh(sensor, { x: 0, y: visuals.heightAboveFloor, z: 0 });
        mesh.material.transparent = true;
        mesh.material.opacity = 0.6;
        configThreeState.scene.add(mesh);
        configThreeState.sensorMeshes[ieeeAddress] = mesh;

        // Add coverage cone if motion sensor
        if (sensor.sensorType === 'motion') {
          const cone = this.createCoverageCone(sensor, { x: 0, z: 0 });
          configThreeState.scene.add(cone);
          configThreeState.coverageMeshes[ieeeAddress] = cone;
        }
      }

      // Start drag
      dragState.isDragging = true;
      dragState.draggedSensor = ieeeAddress;
      dragState.draggedMesh = configThreeState.sensorMeshes[ieeeAddress];
      dragState.startPosition = null; // New placement, no revert

      configThreeState.controls.enabled = false;
      this.selectedSensor = ieeeAddress;
    },

    onResize() {
      const container = this.$refs.configCanvas;
      if (!container || !configThreeState.camera || !configThreeState.renderer) return;

      const aspect = container.clientWidth / container.clientHeight;
      configThreeState.camera.aspect = aspect;
      configThreeState.camera.updateProjectionMatrix();
      configThreeState.renderer.setSize(container.clientWidth, container.clientHeight);
    },

    animate() {
      const self = this;
      function loop() {
        configThreeState.animationId = requestAnimationFrame(loop);

        if (configThreeState.controls) {
          configThreeState.controls.update();
        }

        self.updateSensorMeshes();

        if (configThreeState.renderer && configThreeState.scene && configThreeState.camera) {
          configThreeState.renderer.render(configThreeState.scene, configThreeState.camera);
        }
      }
      loop();
    },

    // Getters for template
    get sensors() {
      return Alpine.store('sensors')?.devices || [];
    },

    get positions() {
      return Alpine.store('sensors')?.positions || {};
    },

    get placedCount() {
      return Alpine.store('sensors')?.placedCount || 0;
    },

    get totalCount() {
      return Alpine.store('sensors')?.totalCount || 0;
    },

    get loading() {
      return Alpine.store('sensors')?.loading ?? true;
    },

    // Alias for template compatibility
    get showCoverage() {
      return this.showMotionCoverage;
    },

    set showCoverage(value) {
      this.showMotionCoverage = value;
      // Update visibility of all coverage cones
      Object.values(configThreeState.coverageMeshes).forEach(cone => {
        if (cone) cone.visible = value;
      });
    },

    // Sensors grouped by type for palette display
    get sensorsByType() {
      const sensors = this.sensors;
      const grouped = {
        climate: [],
        co2: [],
        motion: [],
        contact: []
      };

      sensors.forEach(sensor => {
        const type = sensor.sensorType || 'climate';
        if (grouped[type]) {
          // Filter by search query if present
          if (!this.searchQuery ||
              sensor.friendly_name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
              type.includes(this.searchQuery.toLowerCase())) {
            grouped[type].push(sensor);
          }
        }
      });

      return grouped;
    },

    // Check if there are motion sensors to show toggle
    get hasCoverageToggle() {
      return this.sensors.some(s => s.sensorType === 'motion');
    },

    // Currently hovered/selected room
    get selectedRoom() {
      if (!this.selectedSensor) return null;
      const pos = Alpine.store('sensors')?.getPosition(this.selectedSensor.ieee_address);
      return pos?.roomId || null;
    },

    // Type helpers for display
    getTypeIcon(type) {
      const icons = {
        climate: '🌡️',
        co2: '💨',
        motion: '👁️',
        contact: '🚪'
      };
      return icons[type] || '📡';
    },

    getTypeLabel(type) {
      const labels = {
        climate: 'Temperature & Humidity',
        co2: 'CO₂ Sensors',
        motion: 'Motion Sensors',
        contact: 'Contact Sensors'
      };
      return labels[type] || 'Unknown';
    },

    getTypeColor(type) {
      const colors = {
        climate: '#34d399',
        co2: '#ff6b6b',
        motion: '#ffd93d',
        contact: '#38bdf8'
      };
      return colors[type] || '#888888';
    },

    // Format live sensor value for display
    formatLiveValue(sensor) {
      const data = Alpine.store('sensors')?.getLiveData(sensor.ieee_address);
      if (!data) return '--';

      switch (sensor.sensorType) {
        case 'climate':
          const temp = data.temperature !== undefined ? `${data.temperature.toFixed(1)}°` : '--';
          const hum = data.humidity !== undefined ? `${Math.round(data.humidity)}%` : '';
          return `${temp} ${hum}`.trim();
        case 'co2':
          return data.co2 !== undefined ? `${data.co2} ppm` : '--';
        case 'motion':
          if (data.occupancy === undefined) return '--';
          return data.occupancy ? '🔴 Motion' : '⚪ Clear';
        case 'contact':
          if (data.contact === undefined) return '--';
          return data.contact ? '🔒 Closed' : '🔓 Open';
        default:
          return '--';
      }
    },

    // Check if sensor is placed on map
    isPlaced(ieeeAddress) {
      return Alpine.store('sensors')?.isPlaced(ieeeAddress) || false;
    },

    // Check if sensor data is stale
    isStale(ieeeAddress) {
      return Alpine.store('sensors')?.isStale(ieeeAddress) || false;
    },

    // Select a sensor in the palette
    selectSensor(sensor) {
      this.selectedSensor = this.selectedSensor?.ieee_address === sensor.ieee_address ? null : sensor;

      // Highlight the mesh if placed
      if (sensor && configThreeState.sensorMeshes[sensor.ieee_address]) {
        // Reset all highlights
        Object.values(configThreeState.sensorMeshes).forEach(mesh => {
          if (mesh && mesh.material) {
            mesh.material.emissive?.setHex(0x000000);
          }
        });

        // Highlight selected
        const mesh = configThreeState.sensorMeshes[sensor.ieee_address];
        if (mesh && mesh.material && mesh.material.emissive) {
          mesh.material.emissive.setHex(0x333333);
        }
      }
    },

    // Start drag from palette card
    startDrag(event, sensor) {
      event.dataTransfer.setData('sensor-ieee', sensor.ieee_address);
      event.dataTransfer.effectAllowed = 'move';
      this.selectedSensor = sensor;
    },

    // Drag over the 3D canvas
    onDragOver(event) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';

      // Update preview position if dragging
      if (dragState.previewMesh) {
        const container = this.$refs.configCanvas;
        if (container) {
          const rect = container.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          this.updatePreviewPosition(x, y);
        }
      }
    },

    // Drop sensor on 3D canvas
    onDrop(event) {
      event.preventDefault();
      const ieeeAddress = event.dataTransfer.getData('sensor-ieee');
      if (!ieeeAddress) return;

      const sensor = Alpine.store('sensors')?.getSensor(ieeeAddress);
      if (!sensor) return;

      const container = this.$refs.configCanvas;
      if (!container) return;

      // Get drop position via raycasting
      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      configThreeState.mouse.set(x, y);
      configThreeState.raycaster.setFromCamera(configThreeState.mouse, configThreeState.camera);

      const intersects = configThreeState.raycaster.intersectObject(configThreeState.floorPlane);
      if (intersects.length > 0) {
        const point = intersects[0].point;
        const visuals = SENSOR_VISUALS[sensor.sensorType] || SENSOR_VISUALS.climate;

        const position = {
          x: point.x,
          y: visuals.heightAboveFloor || 1.5,
          z: point.z
        };

        // Validate placement
        const validation = this.validatePlacement(position.x, position.z, sensor.sensorType);
        if (validation.valid) {
          // Save position
          Alpine.store('sensors')?.savePosition(ieeeAddress, position, validation.roomId);

          // Create or update mesh
          this.createOrUpdateSensorMesh(sensor, position);
        } else {
          // Show error
          this.tooltip = {
            text: validation.errors.join('\n'),
            visible: true,
            x: event.clientX,
            y: event.clientY - 40
          };
          setTimeout(() => { this.tooltip.visible = false; }, 3000);
        }
      }

      // Clean up preview
      if (dragState.previewMesh) {
        configThreeState.scene.remove(dragState.previewMesh);
        dragState.previewMesh = null;
      }
    },

    // Update preview mesh position during drag
    updatePreviewPosition(mouseX, mouseY) {
      if (!configThreeState.raycaster || !configThreeState.camera) return;

      configThreeState.mouse.set(mouseX, mouseY);
      configThreeState.raycaster.setFromCamera(configThreeState.mouse, configThreeState.camera);

      const intersects = configThreeState.raycaster.intersectObject(configThreeState.floorPlane);
      if (intersects.length > 0 && dragState.previewMesh) {
        const point = intersects[0].point;
        dragState.previewMesh.position.set(point.x, 1.5, point.z);
      }
    },

    // Camera controls
    resetView() {
      if (!configThreeState.camera || !configThreeState.controls) return;

      configThreeState.camera.position.set(0, 12, 8);
      configThreeState.controls.target.set(0, 0, 0);
      configThreeState.controls.update();
      this.isTopView = false;
    },

    toggleTopView() {
      if (!configThreeState.camera || !configThreeState.controls) return;

      this.isTopView = !this.isTopView;

      if (this.isTopView) {
        configThreeState.camera.position.set(0, 20, 0.01);
        configThreeState.controls.target.set(0, 0, 0);
      } else {
        configThreeState.camera.position.set(0, 12, 8);
        configThreeState.controls.target.set(0, 0, 0);
      }
      configThreeState.controls.update();
    },

    zoomIn() {
      if (!configThreeState.camera) return;
      const pos = configThreeState.camera.position;
      const factor = 0.8;
      configThreeState.camera.position.set(pos.x * factor, pos.y * factor, pos.z * factor);
    },

    zoomOut() {
      if (!configThreeState.camera) return;
      const pos = configThreeState.camera.position;
      const factor = 1.25;
      configThreeState.camera.position.set(pos.x * factor, pos.y * factor, pos.z * factor);
    },

    // Reset all sensor positions
    resetAllPositions() {
      if (!confirm('Are you sure you want to remove all sensor placements?')) return;

      // Remove all meshes from scene
      Object.values(configThreeState.sensorMeshes).forEach(mesh => {
        if (mesh) configThreeState.scene.remove(mesh);
      });
      Object.values(configThreeState.coverageMeshes).forEach(mesh => {
        if (mesh) configThreeState.scene.remove(mesh);
      });

      configThreeState.sensorMeshes = {};
      configThreeState.coverageMeshes = {};

      // Clear positions in store
      Alpine.store('sensors')?.resetAllPositions();
    },

    // Create or update a sensor mesh in the 3D scene
    createOrUpdateSensorMesh(sensor, position) {
      const existing = configThreeState.sensorMeshes[sensor.ieee_address];
      if (existing) {
        existing.position.set(position.x, position.y, position.z);
        return;
      }

      // Create new mesh based on sensor type
      const visuals = SENSOR_VISUALS[sensor.sensorType] || SENSOR_VISUALS.climate;
      let geometry;

      switch (visuals.shape) {
        case 'sphere':
          geometry = new THREE.SphereGeometry(visuals.size.radius || 0.1, 16, 16);
          break;
        case 'cylinder':
          geometry = new THREE.CylinderGeometry(
            visuals.size.radius || 0.1,
            visuals.size.radius || 0.1,
            visuals.size.height || 0.2,
            16
          );
          break;
        case 'box':
        case 'cube':
        default:
          geometry = new THREE.BoxGeometry(
            visuals.size.width || 0.15,
            visuals.size.height || 0.08,
            visuals.size.depth || 0.15
          );
      }

      const material = new THREE.MeshStandardMaterial({
        color: visuals.color,
        metalness: 0.3,
        roughness: 0.6,
        emissive: 0x000000
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(position.x, position.y, position.z);
      mesh.userData = { ieeeAddress: sensor.ieee_address, sensorType: sensor.sensorType };

      configThreeState.scene.add(mesh);
      configThreeState.sensorMeshes[sensor.ieee_address] = mesh;

      // Add coverage cone for motion sensors
      if (sensor.sensorType === 'motion' && visuals.fov && visuals.range) {
        const halfAngle = (visuals.fov / 2) * (Math.PI / 180);
        const coneRadius = Math.tan(halfAngle) * visuals.range;
        const coneGeom = new THREE.ConeGeometry(coneRadius, visuals.range, 32);
        const coneMat = new THREE.MeshBasicMaterial({
          color: visuals.color,
          transparent: true,
          opacity: 0.15,
          side: THREE.DoubleSide
        });
        const cone = new THREE.Mesh(coneGeom, coneMat);
        cone.position.set(position.x, position.y - visuals.range / 2, position.z);
        cone.rotation.x = Math.PI;
        cone.visible = this.showMotionCoverage;

        configThreeState.scene.add(cone);
        configThreeState.coverageMeshes[sensor.ieee_address] = cone;
      }
    }
  };
}
