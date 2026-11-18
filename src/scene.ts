import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { Config, Prize } from "./types.js";
import type { Simulation, Toy } from "./simulation.js";
export class CabinetScene {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(32, 1, 0.1, 60);
  claw = new T.Group();
  private fingers: T.Group[] = [];
  private cable: T.Mesh;
  private trolley = new T.Group();
  private aimRing: T.Mesh;
  private toys = new Map<number, T.Group>();

  private geometries = new Set<T.BufferGeometry>();
  private materials = new Set<T.Material>();
  private textures = new Set<T.Texture>();
  private env: T.WebGLRenderTarget;
  private disposed = false;
  private adapted = false;
  private accent: T.MeshStandardMaterial;
  private white: T.MeshStandardMaterial;
  private dark: T.MeshStandardMaterial;
  private metal: T.MeshStandardMaterial;
  private glass: T.MeshPhysicalMaterial;
  private statusLights: T.Mesh[] = [];
  constructor(
    public canvas: HTMLCanvasElement,
    public config: Config,
  ) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, config.maxDPR));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.82;
    const pmrem = new T.PMREMGenerator(this.renderer),
      room = new RoomEnvironment();
    this.env = pmrem.fromScene(room, 0.06);
    this.scene.environment = this.env.texture;
    this.scene.environmentIntensity = 0.55;
    room.dispose();
    pmrem.dispose();
    this.accent = this.mat(config.accent, 0.3, 0.12);
    this.white = this.mat("#fff1d7", 0.4, 0.08);
    this.dark = this.mat("#25262d", 0.5, 0.05);
    this.metal = this.mat("#dce0e2", 0.18, 0.92);
    this.glass = new T.MeshPhysicalMaterial({
      color: "#d8f0f3",
      transparent: true,
      opacity: 0.055,
      roughness: 0.1,
      metalness: 0.15,
      side: T.DoubleSide,
      depthWrite: false,
    });
    this.materials.add(this.glass);
    this.scene.add(new T.HemisphereLight("#fff2dd", "#8c7596", 1.6));
    const light = new T.DirectionalLight("#fff4dc", 2.4);
    light.position.set(-3, 8, 6);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -5;
    light.shadow.camera.right = 5;
    light.shadow.camera.top = 7;
    light.shadow.camera.bottom = -3;
    light.shadow.normalBias = 0.02;
    light.shadow.bias = -0.0004;
    this.scene.add(light);
    const rim = new T.DirectionalLight("#bddbff", 1.4);
    rim.position.set(4, 5, -3);
    this.scene.add(rim);
    this.buildCabinet();
    this.buildClaw();
    const cableGeo = new T.CylinderGeometry(0.018, 0.018, 1, 10);
    this.geometries.add(cableGeo);
    this.cable = new T.Mesh(cableGeo, this.dark);
    this.scene.add(this.cable);
    this.aimRing = this.mesh(
      new T.TorusGeometry(0.28, 0.012, 8, 48),
      this.mat("#db3f45", 0.4, 0),
      this.scene,
      0,
      1.26,
      0,
    );
    this.aimRing.rotation.x = -Math.PI / 2;
    const ground = this.mesh(
      new T.PlaneGeometry(200, 200),
      new T.ShadowMaterial({ opacity: 0.12 }),
      this.scene,
      0,
      -0.04,
      0,
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.camera.position.set(6.6, 5.2, 10);
    this.camera.lookAt(0, 2.65, 0);
  }
  private mat(color: string, roughness = 0.65, metalness = 0) {
    const m = new T.MeshStandardMaterial({ color, roughness, metalness });
    this.materials.add(m);
    return m;
  }
  private mesh(
    g: T.BufferGeometry,
    m: T.Material,
    parent: T.Object3D,
    x = 0,
    y = 0,
    z = 0,
  ) {
    this.geometries.add(g);
    this.materials.add(m);
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  private box(
    w: number,
    h: number,
    d: number,
    m: T.Material,
    parent: T.Object3D,
    x = 0,
    y = 0,
    z = 0,
    r = 0.05,
  ) {
    return this.mesh(new RoundedBoxGeometry(w, h, d, 2, r), m, parent, x, y, z);
  }
  private sphere(
    r: number,
    m: T.Material,
    parent: T.Object3D,
    x = 0,
    y = 0,
    z = 0,
    sx = 1,
    sy = 1,
    sz = 1,
  ) {
    const o = this.mesh(new T.SphereGeometry(r, 20, 14), m, parent, x, y, z);
    o.scale.set(sx, sy, sz);
    return o;
  }
  private label(
    text: string,
    w: number,
    h: number,
    size: number,
    color: string,
    bg: string | undefined,
    parent: T.Object3D,
    x: number,
    y: number,
    z: number,
  ) {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = Math.round((1024 * h) / w);
    const ctx = c.getContext("2d")!;
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, c.width, c.height);
    }
    ctx.fillStyle = color;
    ctx.font = `900 ${size}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 512, c.height / 2, 960);
    const texture = new T.CanvasTexture(c);
    texture.colorSpace = T.SRGBColorSpace;
    this.textures.add(texture);
    return this.mesh(
      new T.PlaneGeometry(w, h),
      new T.MeshBasicMaterial({
        map: texture,
        transparent: !bg,
        side: T.FrontSide,
        depthWrite: false,
      }),
      parent,
      x,
      y,
      z,
    );
  }
  private buildCabinet() {
    const cabinet = new T.Group();
    this.scene.add(cabinet);
    // Enamel body, deep prize bay, inset delivery hatch and soft rounded roof.
    this.box(3.6, 1.2, 2.5, this.accent, cabinet, 0, 0.6, 0, 0.16);
    this.box(3.4, 0.13, 2.3, this.white, cabinet, 0, 1.22, 0, 0.055);
    this.box(3.25, 2.9, 0.1, this.white, cabinet, 0, 2.75, -1.16, 0.035);
    this.label(
      "A LITTLE LUCK. A LITTLE FLURI.",
      2.7,
      0.2,
      46,
      "#aa8f7b",
      undefined,
      cabinet,
      0,
      3.82,
      -1.095,
    );
    for (const x of [-1.7, 1.7])
      for (const z of [-1.13, 1.13]) {
        this.box(0.14, 3.14, 0.14, this.accent, cabinet, x, 2.82, z, 0.04);
        this.box(
          0.045,
          2.8,
          0.035,
          this.metal,
          cabinet,
          x + (x < 0 ? 0.06 : -0.06),
          2.8,
          z + 0.04,
          0.012,
        );
      }
    this.box(3.7, 0.65, 2.58, this.accent, cabinet, 0, 4.62, 0, 0.18);
    this.box(3.35, 0.44, 0.08, this.white, cabinet, 0, 4.62, 1.3, 0.09);
    this.label(
      this.config.title,
      2.9,
      0.34,
      100,
      this.config.accent,
      undefined,
      cabinet,
      0,
      4.62,
      1.35,
    );
    this.box(3.4, 0.11, 2.3, this.white, cabinet, 0, 4.22, 0, 0.04);
    this.label(
      "FLURI  /  COLLECT A LITTLE HAPPINESS",
      2.7,
      0.14,
      36,
      "#fff1d7",
      undefined,
      cabinet,
      0,
      0.27,
      1.26,
    );
    this.box(0.95, 0.5, 0.065, this.dark, cabinet, -1.02, 0.77, 1.27, 0.1);
    this.box(0.87, 0.11, 0.36, this.white, cabinet, -1.02, 0.5, 1.4, 0.035);
    this.label(
      "PRIZE OUT",
      0.65,
      0.1,
      80,
      "#fff1d7",
      undefined,
      cabinet,
      -1.02,
      0.8,
      1.31,
    );
    this.box(1.18, 0.55, 0.065, this.white, cabinet, 0.62, 0.79, 1.27, 0.08);
    this.label(
      "PLAY FOR THE JOY OF IT.",
      0.98,
      0.11,
      55,
      "#765c52",
      undefined,
      cabinet,
      0.62,
      0.92,
      1.31,
    );
    // Raised physical joystick and illuminated grab button on the control deck.
    const stick = this.mesh(
      new T.CylinderGeometry(0.025, 0.025, 0.22, 12),
      this.metal,
      cabinet,
      0.35,
      0.8,
      1.35,
    );
    stick.rotation.x = Math.PI / 2;
    this.sphere(0.1, this.dark, cabinet, 0.35, 0.8, 1.51);
    const button = this.mesh(
      new T.CylinderGeometry(0.14, 0.15, 0.08, 32),
      this.accent,
      cabinet,
      0.9,
      0.77,
      1.36,
    );
    button.rotation.x = Math.PI / 2;
    for (let i = 0; i < 7; i++) {
      const ledMat = this.mat("#ffe9a6", 0.25, 0.1);
      ledMat.emissive.set("#ffe2a1");
      ledMat.emissiveIntensity = 0.45;
      const led = this.sphere(
        0.028,
        ledMat,
        cabinet,
        -1.35 + i * 0.45,
        4.93,
        1.16,
      );
      this.statusLights.push(led);
    }
    const panel = this.mesh(
      new T.PlaneGeometry(3.2, 2.86),
      this.glass,
      cabinet,
      0,
      2.75,
      1.135,
    );
    panel.castShadow = false;
    panel.receiveShadow = false;
    const side = this.mesh(
      new T.PlaneGeometry(2.18, 2.86),
      this.glass,
      cabinet,
      1.69,
      2.75,
      0,
    );
    side.rotation.y = Math.PI / 2;
    side.castShadow = false;
    // Two restrained reflection streaks make the glass read without hiding the toys.
    const reflection = new T.MeshBasicMaterial({
      color: "#fff8ed",
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    for (const x of [-1.45, 1.38]) {
      const streak = this.mesh(
        new T.PlaneGeometry(0.026, 2.6),
        reflection,
        cabinet,
        x,
        2.75,
        1.145,
      );
      streak.rotation.z = -0.06;
    }
    const hatch = this.box(
      0.72,
      0.03,
      0.6,
      this.dark,
      cabinet,
      -1.15,
      1.245,
      0.74,
      0.015,
    );
    hatch.receiveShadow = true;
    // Rails live above the prize compartment, below the illuminated roof.
    for (const z of [-0.86, 0.86])
      this.box(3.1, 0.045, 0.045, this.metal, cabinet, 0, 4.12, z, 0.012);
  }
  private buildClaw() {
    this.scene.add(this.trolley);
    this.box(0.35, 0.1, 1.95, this.dark, this.trolley, 0, 4.14, 0, 0.03);
    this.scene.add(this.claw);
    this.sphere(0.16, this.metal, this.claw, 0, 0, 0, 1, 0.6, 1);
    this.box(0.14, 0.16, 0.14, this.accent, this.claw, 0, 0.11, 0, 0.035);
    for (let i = 0; i < 3; i++) {
      const g = new T.Group();
      g.rotation.y = (i * Math.PI * 2) / 3;
      this.claw.add(g);
      this.fingers.push(g);
      const arm = new T.Group();
      arm.position.set(0.08, -0.025, 0);
      g.add(arm);
      this.box(0.075, 0.32, 0.07, this.metal, arm, 0.07, -0.14, 0, 0.024);
      const end = this.box(
        0.065,
        0.28,
        0.065,
        this.metal,
        arm,
        0.135,
        -0.4,
        0,
        0.022,
      );
      end.rotation.z = -0.48;
      this.sphere(0.045, this.dark, arm, 0.075, -0.51, 0);
      this.sphere(0.045, this.metal, arm, 0.08, -0.27, 0);
    }
  }
  private toy(toy: Toy) {
    const p = toy.prize,
      g = new T.Group();
    this.scene.add(g);
    const c = this.mat(p.color ?? "#f5c76d");
    const cream = this.mat("#fff3dd"),
      black = this.mat("#252632");
    const kind = p.character ?? "custom";
    this.sphere(0.255, c, g, 0, 0, 0, 1, kind === "ghost" ? 1.12 : 1, 1);
    const face = new T.Group();
    g.add(face);
    g.userData.face = face;
    const eyeMat = kind === "cat" ? this.mat("#f5cd67") : black;
    if (kind === "astronaut") {
      this.sphere(
        0.2,
        this.mat("#344454", 0.16, 0.75),
        g,
        0,
        0.05,
        0.16,
        1,
        1,
        0.6,
      );
      this.sphere(
        0.075,
        this.mat("#bde5ec", 0.12, 0.2),
        g,
        -0.07,
        0.1,
        0.285,
        1,
        1,
        0.13,
      );
      this.box(0.19, 0.12, 0.08, this.mat("#e88159"), g, 0, -0.13, 0.23, 0.02);
    } else {
      for (const x of [-0.08, 0.08]) {
        this.sphere(
          kind === "spider" ? 0.061 : 0.043,
          eyeMat,
          face,
          x,
          0.045,
          0.233,
          1,
          1.24,
          0.4,
        );
        this.sphere(0.013, cream, face, x - 0.01, 0.06, 0.252, 1, 1, 0.3);
      }
      this.sphere(0.023, black, g, 0, -0.02, 0.252, 1, 0.6, 0.55);
      if (kind !== "cat")
        for (const x of [-0.14, 0.14])
          this.sphere(
            0.035,
            this.mat("#ed9d9c"),
            g,
            x,
            -0.04,
            0.205,
            1,
            0.5,
            0.3,
          );
    }
    if (kind === "cat") {
      for (const x of [-0.15, 0.15]) {
        const ear = this.mesh(
          new T.ConeGeometry(0.1, 0.2, 3),
          c,
          g,
          x,
          0.24,
          0,
        );
        ear.rotation.z = x < 0 ? 0.3 : -0.3;
        this.sphere(
          0.045,
          this.mat("#c9a0a2"),
          g,
          x,
          0.255,
          0.045,
          0.65,
          1,
          0.4,
        );
      }
      const tail = this.mesh(
        new T.TorusGeometry(0.15, 0.04, 8, 20, Math.PI * 1.5),
        c,
        g,
        0.23,
        -0.06,
        -0.14,
      );
      tail.rotation.x = 0.5;
    }
    if (kind === "yeti") {
      this.sphere(0.2, cream, g, 0, -0.02, 0.12, 1, 1.05, 0.7);
      // Replace the front face after the pale muzzle so the eyes remain visible.
      face.position.z = 0.06;
      for (const x of [-0.16, 0.16]) {
        const horn = this.mesh(
          new T.ConeGeometry(0.055, 0.15, 12),
          cream,
          g,
          x,
          0.24,
          0,
        );
        horn.rotation.z = x < 0 ? 0.5 : -0.5;
      }
      const scarf = this.mesh(
        new T.TorusGeometry(0.205, 0.035, 8, 30),
        this.mat("#e77558"),
        g,
        0,
        -0.15,
        0.02,
      );
      scarf.rotation.x = Math.PI / 2;
    }
    if (kind === "ghost") {
      for (let i = 0; i < 5; i++)
        this.sphere(0.078, c, g, -0.18 + i * 0.09, -0.19, 0, 1, 1, 1.7);
    }
    if (kind === "spider") {
      for (let i = 0; i < 4; i++)
        for (const side of [-1, 1]) {
          const leg = this.box(
            0.22,
            0.045,
            0.045,
            c,
            g,
            side * 0.27,
            -0.1 + (i % 2) * 0.04,
            -0.17 + i * 0.11,
            0.018,
          );
          leg.rotation.z = side * 0.2;
        }
      this.sphere(0.045, black, face, -0.16, 0.02, 0.17);
      this.sphere(0.045, black, face, 0.16, 0.02, 0.17);
    }
    if (kind === "bandit") {
      for (const x of [-0.15, 0.15]) this.sphere(0.08, c, g, x, 0.23, 0);
      const mask = this.sphere(
        0.19,
        this.mat("#314b43"),
        g,
        0,
        0.035,
        0.2,
        1,
        0.48,
        0.3,
      );
      mask.castShadow = false;
      face.position.z = 0.03;
      this.box(0.12, 0.2, 0.04, this.mat("#e4a169"), g, 0, -0.16, 0.21, 0.015);
    }
    if (kind === "custom" && !p.image) {
      this.label(
        p.name.slice(0, 2).toUpperCase(),
        0.25,
        0.18,
        400,
        "#252632",
        undefined,
        g,
        0,
        0,
        0.257,
      );
    }
    if (p.image) {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        if (this.disposed || !this.toys.has(toy.key)) return;
        const texture = new T.Texture(image);
        texture.colorSpace = T.SRGBColorSpace;
        texture.needsUpdate = true;
        this.textures.add(texture);
        this.mesh(
          new T.PlaneGeometry(0.34, 0.34),
          new T.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
          }),
          g,
          0,
          0,
          0.27,
        );
      };
      image.onerror = () => {
        if (!this.disposed && this.toys.has(toy.key))
          this.label(
            p.name.slice(0, 2),
            0.25,
            0.18,
            400,
            "#252632",
            undefined,
            g,
            0,
            0,
            0.27,
          );
      };
      image.src = p.image;
    }
    for (const x of [-0.11, 0.11])
      this.sphere(0.08, c, g, x, -0.23, 0.07, 1, 0.6, 1.2);
    g.scale.setScalar(toy.radius / 0.255);
    return g;
  }
  private releaseToy(group: T.Group) {
    const geometries = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>();
    group.traverse((object) => {
      if (object instanceof T.Mesh) {
        geometries.add(object.geometry);
        for (const mat of Array.isArray(object.material)
          ? object.material
          : [object.material])
          materials.add(mat);
      }
    });
    for (const g of geometries) {
      g.dispose();
      this.geometries.delete(g);
    }
    for (const m of materials) {
      const map = (m as T.MeshBasicMaterial).map;
      if (map) {
        map.dispose();
        this.textures.delete(map);
      }
      m.dispose();
      this.materials.delete(m);
    }
    this.scene.remove(group);
  }
  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.fov = w / h > 1.5 ? 30 : 35;
    const distance = w / h < 0.8 ? 1.12 : 1;
    this.camera.position.set(5.6 * distance, 4.8 * distance, 10.8 * distance);
    this.camera.lookAt(0, 2.53, 0);
    this.camera.updateProjectionMatrix();
  }
  render(sim: Simulation, motion = true) {
    for (const toy of sim.toys) {
      let mesh = this.toys.get(toy.key);
      if (!mesh) {
        mesh = this.toy(toy);
        this.toys.set(toy.key, mesh);
      }
      mesh.visible = !toy.won;
      mesh.position.copy(toy.body.position);
      mesh.quaternion.copy(toy.body.quaternion);
      const face = mesh.userData.face as T.Group | undefined;
      if (face) {
        const blink = motion && Math.sin(sim.time * 0.65 + toy.key) > 0.998;
        face.scale.y = blink ? 0.1 : 1;
      }
    }
    for (const [key, mesh] of this.toys)
      if (!sim.toys.some((t) => t.key === key)) {
        this.releaseToy(mesh);
        this.toys.delete(key);
      }
    const c = sim.claw;
    this.claw.position.set(c.x, c.y, c.z);
    this.claw.rotation.z = motion
      ? Math.sin(sim.time * 3) * 0.025 * (sim.held ? 1 : 0.3)
      : 0;
    for (const g of this.fingers) {
      const arm = g.children[0]!;
      arm.rotation.z = 0.2 + c.open * 0.65;
    }
    this.trolley.position.x = c.x;
    const length = Math.max(0.04, 4.12 - c.y);
    this.cable.scale.y = length;
    this.cable.position.set(c.x, c.y + length / 2 + 0.15, c.z);
    this.aimRing.position.set(c.x, 1.26, c.z);
    this.aimRing.visible = sim.phase === "aiming";
    for (let i = 0; i < this.statusLights.length; i++)
      (
        this.statusLights[i]!.material as T.MeshStandardMaterial
      ).emissiveIntensity = motion
        ? 0.25 + (Math.sin(sim.time * 2 - i * 0.7) + 1) * 0.35
        : 0.35;
    const started = performance.now();
    this.renderer.render(this.scene, this.camera);
    if (!this.adapted && performance.now() - started > 80) {
      this.adapted = true;
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      for (const material of this.materials) material.needsUpdate = true;
    }
  }
  aimAt(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect(),
      ray = new T.Raycaster();
    ray.setFromCamera(
      new T.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        (-(clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    const hit = new T.Vector3();
    return ray.ray.intersectPlane(
      new T.Plane(new T.Vector3(0, 1, 0), -1.5),
      hit,
    )
      ? { x: hit.x / 1.25, z: hit.z / 0.78 }
      : undefined;
  }
  recolor(config: Config) {
    this.config = config;
    this.accent.color.set(config.accent);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, config.maxDPR));
  }
  destroy() {
    this.disposed = true;
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.env.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.toys.clear();
    this.scene.clear();
  }
}
