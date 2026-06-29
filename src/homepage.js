import * as THREE from "../node_modules/three/build/three.module.min.js";

var root = document.getElementById("app");
if (!root) {
  throw new Error("Missing root mount element");
}

var canvas = document.getElementById("scene");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Missing scene canvas element");
}

var clockEl = document.getElementById("clock");
if (!(clockEl instanceof HTMLDivElement)) {
  throw new Error("Missing clock element");
}

var dateEl = document.getElementById("date");
if (!(dateEl instanceof HTMLDivElement)) {
  throw new Error("Missing date element");
}

var travelBtn = document.getElementById("travelBtn");
if (!(travelBtn instanceof HTMLButtonElement)) {
  throw new Error("Missing travel button element");
}

var textureBtn = document.getElementById("textureBtn");
if (!(textureBtn instanceof HTMLButtonElement)) {
  throw new Error("Missing texture button element");
}

var orbitBtn = document.getElementById("orbitBtn");
if (!(orbitBtn instanceof HTMLButtonElement)) {
  throw new Error("Missing orbit button element");
}

var wireframeBtn = document.getElementById("wireframeBtn");
if (!(wireframeBtn instanceof HTMLButtonElement)) {
  throw new Error("Missing wireframe button element");
}

var lightHelperBtn = document.getElementById("lightHelperBtn");
if (!(lightHelperBtn instanceof HTMLButtonElement)) {
  throw new Error("Missing light helper button element");
}

var renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
  alpha: false,
});
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setSize(root.clientWidth, root.clientHeight);
renderer.setClearColor(0x060a1b, 1);

var scene = new THREE.Scene();
var sky = new THREE.Group();
scene.add(sky);
var world = new THREE.Group();
scene.add(world);

var camera = new THREE.PerspectiveCamera(
  52,
  root.clientWidth / root.clientHeight,
  0.1,
  200
);
camera.position.set(0, 0.1, 8.5);

var starPosition = new THREE.Vector3(-18, 6, 14);
var hardSpotLight = new THREE.SpotLight(0xfff5cf, 220, 500, 0.16, 0.0, 1.8);
hardSpotLight.position.set(-18, 6, 14);
var spotLightHelper = new THREE.SpotLightHelper(hardSpotLight, 0x80d0ff);
spotLightHelper.visible = false;
scene.add(spotLightHelper);

function makeStarField(count, spread, size, colorA, colorB) {
  var positions = new Float32Array(count * 3);
  var colors = new Float32Array(count * 3);
  var colorObjA = new THREE.Color(colorA);
  var colorObjB = new THREE.Color(colorB);

  for (var i = 0; i < count; i += 1) {
    var i3 = i * 3;
    var radius = spread * (0.3 + Math.random() * 0.7);
    var theta = Math.random() * Math.PI * 2;
    var phi = Math.acos(2 * Math.random() - 1);

    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.cos(phi);
    positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

    var mixed = colorObjA.clone().lerp(colorObjB, Math.random());
    var intensity = 0.65 + Math.random() * 0.35;
    colors[i3] = mixed.r * intensity;
    colors[i3 + 1] = mixed.g * intensity;
    colors[i3 + 2] = mixed.b * intensity;
  }

  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  var material = new THREE.PointsMaterial({
    size: size,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

function clearStarLayers() {
  while (sky.children.length > 0) {
    var child = sky.children.pop();
    if (child && child.geometry) {
      child.geometry.dispose();
    }
    if (child && child.material) {
      child.material.dispose();
    }
  }
}

function regenerateStars() {
  clearStarLayers();
  sky.add(makeStarField(520, 60, 0.018, randomHexFromHsl(Math.random(), 0.35, 0.8), randomHexFromHsl(Math.random(), 0.45, 0.86)));
  sky.add(makeStarField(430, 66, 0.036, randomHexFromHsl(Math.random(), 0.4, 0.78), randomHexFromHsl(Math.random(), 0.5, 0.84)));
  sky.add(makeStarField(250, 72, 0.085, randomHexFromHsl(Math.random(), 0.5, 0.82), randomHexFromHsl(Math.random(), 0.6, 0.86)));
  sky.add(makeStarField(90, 78, 0.19, randomHexFromHsl(Math.random(), 0.3, 0.9), randomHexFromHsl(Math.random(), 0.45, 0.92)));
  sky.add(makeStarField(26, 84, 0.34, randomHexFromHsl(Math.random(), 0.3, 0.9), randomHexFromHsl(Math.random(), 0.45, 0.94)));
  sky.add(makeStarField(700, 92, 0.014, randomHexFromHsl(Math.random(), 0.35, 0.74), randomHexFromHsl(Math.random(), 0.55, 0.82)));
  sky.add(makeStarField(420, 102, 0.03, randomHexFromHsl(Math.random(), 0.35, 0.76), randomHexFromHsl(Math.random(), 0.5, 0.84)));
  sky.add(makeStarField(160, 114, 0.07, randomHexFromHsl(Math.random(), 0.35, 0.8), randomHexFromHsl(Math.random(), 0.5, 0.88)));
}

var planetGeometry = new THREE.SphereGeometry(1.8, 16, 12);
var wireframeEnabled = false;

function makePlanetMaterial(seed, landTint, oceanTint) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: seed },
      uColorA: { value: new THREE.Color(landTint) },
      uColorB: { value: new THREE.Color(oceanTint) },
      uLightPos: { value: starPosition.clone() },
      uTextureEnabled: { value: 1.0 },
      uBumpStrength: { value: 1.35 },
    },
    vertexShader: `
    varying vec3 vWorldNormal;
    varying vec3 vWorldPos;
    varying vec3 vObjectPos;
    varying vec2 vUv;
    void main() {
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xyz;
      vObjectPos = position;
      vUv = uv;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
    fragmentShader: `
    varying vec3 vWorldNormal;
    varying vec3 vWorldPos;
    varying vec3 vObjectPos;
    varying vec2 vUv;
    uniform float uTime;
    uniform float uSeed;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform vec3 uLightPos;
    uniform float uTextureEnabled;
    uniform float uBumpStrength;

    float hash(vec3 p) {
      return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
    }

    float noise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);

      float n000 = hash(i + vec3(0.0, 0.0, 0.0));
      float n100 = hash(i + vec3(1.0, 0.0, 0.0));
      float n010 = hash(i + vec3(0.0, 1.0, 0.0));
      float n110 = hash(i + vec3(1.0, 1.0, 0.0));
      float n001 = hash(i + vec3(0.0, 0.0, 1.0));
      float n101 = hash(i + vec3(1.0, 0.0, 1.0));
      float n011 = hash(i + vec3(0.0, 1.0, 1.0));
      float n111 = hash(i + vec3(1.0, 1.0, 1.0));

      float nx00 = mix(n000, n100, f.x);
      float nx10 = mix(n010, n110, f.x);
      float nx01 = mix(n001, n101, f.x);
      float nx11 = mix(n011, n111, f.x);
      float nxy0 = mix(nx00, nx10, f.y);
      float nxy1 = mix(nx01, nx11, f.y);
      return mix(nxy0, nxy1, f.z);
    }

    float fbm(vec3 p) {
      float value = 0.0;
      float amp = 0.55;
      for (int i = 0; i < 5; i++) {
        value += amp * noise(p);
        p *= 2.03;
        amp *= 0.5;
      }
      return value;
    }

    float bumpHeight(vec3 p) {
      float broad = fbm(p * 1.5);
      float medium = fbm(p * 3.8 + vec3(13.7, 2.1, 9.4));
      float fine = noise(p * 10.0 + vec3(1.2, 7.4, 3.6));
      return broad * 0.65 + medium * 0.28 + fine * 0.07;
    }

    vec3 bumpNormal(vec3 normal, vec3 p) {
      float e = 0.03;
      float h = bumpHeight(p);
      float hx = bumpHeight(p + vec3(e, 0.0, 0.0)) - h;
      float hy = bumpHeight(p + vec3(0.0, e, 0.0)) - h;
      float hz = bumpHeight(p + vec3(0.0, 0.0, e)) - h;
      vec3 gradient = vec3(hx, hy, hz) / e;
      return normalize(normal - gradient * uBumpStrength);
    }

    void main() {
      vec3 nBase = normalize(vWorldNormal);
      vec3 p = normalize(vObjectPos) * 3.2 + vec3(uSeed);
      vec3 n = mix(nBase, bumpNormal(nBase, p * 2.0), uTextureEnabled);

      vec3 pn = normalize(vObjectPos);
      float lat = asin(clamp(pn.y, -1.0, 1.0));
      float lon = atan(pn.z, pn.x);
      float warpA = fbm(p * 1.35 + vec3(1.9, 4.3, 2.7));
      float warpB = fbm(p * 2.6 + vec3(7.1, 0.8, 5.2));
      float lineCoord = lat * 18.0 + lon * 2.8 + warpA * 3.4 + warpB * 1.8;
      float lineWave = abs(sin(lineCoord));
      float lineMask = smoothstep(0.70, 0.96, lineWave);
      float secondaryWave = abs(sin(lineCoord * 0.48 + warpB * 4.0));
      float secondaryMask = smoothstep(0.86, 0.985, secondaryWave);
      float combinedLines = clamp(lineMask + secondaryMask * 0.65, 0.0, 1.0);
      vec3 baseColor = mix(uColorA, uColorB, combinedLines);

      vec3 lightDir = normalize(uLightPos - vWorldPos);
      float lightAmount = max(dot(n, lightDir), 0.0);
      vec3 lit = baseColor * (lightAmount * 1.1);
      gl_FragColor = vec4(lit, 1.0);
    }
  `,
  });
}

function createPlanetAt(positionX, seed, landTint, oceanTint) {
  var planet = new THREE.Mesh(
    planetGeometry,
    makePlanetMaterial(seed, landTint, oceanTint)
  );
  var wireframeOverlay = new THREE.Mesh(
    planetGeometry,
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    })
  );
  wireframeOverlay.visible = wireframeEnabled;
  planet.add(wireframeOverlay);
  planet.userData.wireframeOverlay = wireframeOverlay;
  planet.position.set(positionX, 0, 0);
  planet.material.uniforms.uTextureEnabled.value = textureEnabled ? 1.0 : 0.0;
  return planet;
}

function randomHexFromHsl(h, s, l) {
  return new THREE.Color().setHSL(h, s, l).getHex();
}

function randomPlanetPalette() {
  var hueA = Math.random();
  var hueB = (hueA + 0.28 + Math.random() * 0.32) % 1;
  var colorA = randomHexFromHsl(hueA, 0.5 + Math.random() * 0.35, 0.32 + Math.random() * 0.24);
  var colorB = randomHexFromHsl(hueB, 0.5 + Math.random() * 0.35, 0.32 + Math.random() * 0.24);
  return { colorA: colorA, colorB: colorB };
}
regenerateStars();

var textureEnabled = true;
var activePlanet = createPlanetAt(-2.8, 0.0, 0x4f7d38, 0x0e4f83);
world.add(activePlanet);

function attachSpotLightToPlanet(planet) {
  if (hardSpotLight.parent) {
    hardSpotLight.parent.remove(hardSpotLight);
  }
  planet.add(hardSpotLight);
  hardSpotLight.target = planet;
}

attachSpotLightToPlanet(activePlanet);

function getScreenCenterWorldX() {
  var z = camera.position.z - activePlanet.position.z;
  var halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * z;
  var halfWidth = halfHeight * camera.aspect;
  return -0.3 * halfWidth;
}

function setViewTargetForActivePlanet() {
  viewTargetOffsetX = getScreenCenterWorldX() - activePlanet.position.x;
}

var viewTargetOffsetX = 0;
var orbitEnabled = false;
var orbitAngle = 0;
var orbitRadius = 0.45;
var pendingPlanetRemoval = null;
var targetCameraZ = camera.position.z;
var minCameraZ = 3.2;
var maxCameraZ = 60;
var lightWorldPos = new THREE.Vector3();
var lightHelperEnabled = false;

function travelToNewPlanet() {
  var originPlanet = activePlanet;
  var newPlanetX = originPlanet.position.x + 120;
  var seed = Math.random() * 1000;
  var palette = randomPlanetPalette();
  var newPlanet = createPlanetAt(newPlanetX, seed, palette.colorA, palette.colorB);
  world.add(newPlanet);

  activePlanet = newPlanet;
  regenerateStars();
  attachSpotLightToPlanet(activePlanet);
  setViewTargetForActivePlanet();
  pendingPlanetRemoval = originPlanet;
  orbitEnabled = true;
  updateOrbitButtonLabel();
}

function updateTextureButtonLabel() {
  textureBtn.textContent = textureEnabled ? "texture: on" : "texture: off";
}

function toggleTexture() {
  textureEnabled = !textureEnabled;
  activePlanet.material.uniforms.uTextureEnabled.value = textureEnabled ? 1.0 : 0.0;
  updateTextureButtonLabel();
}

function updateOrbitButtonLabel() {
  orbitBtn.textContent = orbitEnabled ? "orbit: on" : "orbit: off";
}

function toggleOrbit() {
  orbitEnabled = !orbitEnabled;
  updateOrbitButtonLabel();
}

function updateWireframeButtonLabel() {
  wireframeBtn.textContent = wireframeEnabled ? "wireframe: on" : "wireframe: off";
}

function toggleWireframe() {
  wireframeEnabled = !wireframeEnabled;
  if (activePlanet.userData && activePlanet.userData.wireframeOverlay) {
    activePlanet.userData.wireframeOverlay.visible = wireframeEnabled;
  }
  updateWireframeButtonLabel();
}

function updateLightHelperButtonLabel() {
  lightHelperBtn.textContent = lightHelperEnabled
    ? "light helper: on"
    : "light helper: off";
}

function toggleLightHelper() {
  lightHelperEnabled = !lightHelperEnabled;
  spotLightHelper.visible = lightHelperEnabled;
  updateLightHelperButtonLabel();
}

function disposePlanet(planet) {
  if (!planet) {
    return;
  }
  if (planet.userData && planet.userData.wireframeOverlay) {
    planet.userData.wireframeOverlay.material.dispose();
  }
  planet.material.dispose();
}

var isDragging = false;
var lastPointerX = 0;
var lastPointerY = 0;
var dragTargetX = 0;
var dragTargetY = 0;
var dragCurrentX = 0;
var dragCurrentY = 0;
setViewTargetForActivePlanet();

function onPointerDown(event) {
  isDragging = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  canvas.style.cursor = "grabbing";
}

function onPointerMove(event) {
  if (!isDragging) {
    return;
  }

  var deltaX = event.clientX - lastPointerX;
  var deltaY = event.clientY - lastPointerY;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;

  dragTargetY += deltaX * 0.0055;
  dragTargetX += deltaY * 0.0045;
  dragTargetX = Math.max(-0.8, Math.min(0.8, dragTargetX));
}

function onPointerUp() {
  isDragging = false;
  canvas.style.cursor = "grab";
}

function onWheel(event) {
  event.preventDefault();
  var zoomStep = event.deltaY > 0 ? 1.12 : 0.88;
  targetCameraZ = THREE.MathUtils.clamp(
    targetCameraZ * zoomStep,
    minCameraZ,
    maxCameraZ
  );
}

function formatTime(date) {
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var seconds = date.getSeconds();
  var amPm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) {
    hours = 12;
  }
  var minuteText = String(minutes).padStart(2, "0");
  var secondText = String(seconds).padStart(2, "0");
  return {
    main: String(hours) + ":" + minuteText,
    seconds: ":" + secondText,
    amPm: amPm,
  };
}

function formatDate(date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function updateClock() {
  var now = new Date();
  dateEl.textContent = formatDate(now);
  var formatted = formatTime(now);
  clockEl.innerHTML =
    '<span class="clock-main">' + formatted.main + "</span>" +
    '<span class="clock-seconds">' + formatted.seconds + "</span>" +
    '<span class="clock-ampm">' + formatted.amPm + "</span>";
}

function animate() {
  camera.position.z += (targetCameraZ - camera.position.z) * 0.16;
  setViewTargetForActivePlanet();

  dragCurrentX += (dragTargetX - dragCurrentX) * 0.14;
  dragCurrentY += (dragTargetY - dragCurrentY) * 0.14;
  if (orbitEnabled) {
    orbitAngle += 0.0014;
  }
  var orbitRotationX = dragCurrentX + Math.sin(orbitAngle * 0.8) * orbitRadius * 0.18;
  var orbitRotationY = dragCurrentY + Math.cos(orbitAngle) * orbitRadius;
  sky.rotation.x = orbitRotationX;
  sky.rotation.y = orbitRotationY;
  activePlanet.rotation.x = orbitRotationX;
  activePlanet.rotation.y = orbitRotationY;
  world.position.x += (viewTargetOffsetX - world.position.x) * 0.08;
  sky.position.x = world.position.x + activePlanet.position.x;

  hardSpotLight.getWorldPosition(lightWorldPos);
  activePlanet.material.uniforms.uLightPos.value.copy(lightWorldPos);
  activePlanet.material.uniforms.uTime.value = 0;
  hardSpotLight.updateMatrixWorld();
  hardSpotLight.target.updateMatrixWorld();
  spotLightHelper.update();

  if (pendingPlanetRemoval && Math.abs(world.position.x - viewTargetOffsetX) < 0.12) {
    world.remove(pendingPlanetRemoval);
    disposePlanet(pendingPlanetRemoval);
    pendingPlanetRemoval = null;
  }

  renderer.render(scene, camera);
  window.requestAnimationFrame(animate);
}

function onResize() {
  var width = root.clientWidth;
  var height = root.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  setViewTargetForActivePlanet();
}

window.addEventListener("resize", onResize);
canvas.style.cursor = "grab";
canvas.style.touchAction = "none";
canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointercancel", onPointerUp);
canvas.addEventListener("pointerleave", onPointerUp);
canvas.addEventListener("wheel", onWheel, { passive: false });
travelBtn.addEventListener("click", travelToNewPlanet);
textureBtn.addEventListener("click", toggleTexture);
orbitBtn.addEventListener("click", toggleOrbit);
wireframeBtn.addEventListener("click", toggleWireframe);
lightHelperBtn.addEventListener("click", toggleLightHelper);
updateTextureButtonLabel();
updateOrbitButtonLabel();
updateWireframeButtonLabel();
updateLightHelperButtonLabel();
updateClock();
window.setInterval(updateClock, 250);
animate();
