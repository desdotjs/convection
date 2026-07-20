"use strict";

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

// constants - global settings, or rules

const CONFIG = {

  debug: true,
  version: "1.0.0",
  background: 0x111111,
  modelPath: "/assets/fish.glb",

    attractor: { // hadley attractor values put in CONFIG because it controls behavior, not logic
    a: 0.2,
    b: 4,
    f: 8,
    g: 1,
    dt: 0.01,
    steps: 30000,
  }

};

///////////// CREATING ENVIRONMENT / SCENE ໒꒰ྀི ˶• ༝ •˶ ꒱ྀི১₊˚⊹♡
// typical three.js environments must include: camera, a renderer, lighting, scene meshes / objects, exr file

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.background); // container holding + rendering everything

// CAMERA

const camera = new THREE.PerspectiveCamera(
  // arguments:
  75, // field of view
  window.innerWidth / window.innerHeight, // aspect ratio
  0.1, // near clip
  1000 // far clip
);
camera.position.set(0, 0, 5);

// hadley attractor logic walks through the equations step by step, collecting x,y,z positions
// belongs in OBJECTS section because of physical presence
// each step is a tiny nudge forward in time using dt (aka: delta time, the size of each step forward)

const { a, b, f, g, dt, steps } = CONFIG.attractor; // CONFIG.objectname always pull values out of CONFIG

const next = (x, y, z) => {

  const dx = -Math.pow(y, 2) - Math.pow(z, 2) - a * x + a * f;
  const dy = x * y - b * x * z - y + g;
  const dz = b * x * y + x * z - z;
  return { dx, dy, dz };

};

let x = 0.1, y = 0, z = 0; // starting position of attractor

const points = []; // storing previous position

for (let i = 0; i < steps; i++) {

  const { dx, dy, dz } = next(x, y, z);
  x += dx * dt;
  y += dy * dt;
  z += dz * dt;
  points.push(new THREE.Vector3(x, y, z));

}

// building the line from the collected points
// belongs in OBJECT section because its static - stored positions do NOT update over time, so it doesn't go in RENDER
const attractorGeometry = new THREE.BufferGeometry().setFromPoints(points);
const attractorMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
const attractorLine = new THREE.Line(attractorGeometry, attractorMaterial);
scene.add(attractorLine);

// RENDERING to screen

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio); // ensures good quality on different screens
document.body.appendChild(renderer.domElement); // canvas element

const controls = new OrbitControls(camera, renderer.domElement);
// pan around with mouse
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// LIGHTING the environment

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
// ambientlight evenly and softly lights the 3d scene
scene.add(ambientLight);
// scene.add injects it into the world

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// STATE
// tracks states between frames - made an object to condense into one param

let state = {

  isInitialized: false,
  animationId: null,
  clock: new THREE.Clock(), // internal time clock for three.js
  elapsed: 0,

};

// console / utilities

function log(...args) {

  if (CONFIG.debug) console.log("[App]", ...args);

}

function handleError(error) {

  console.error("[Error]", error);

}

// defining objects in scene (meshes, models, geometries)

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x00aaff });
const cube = new THREE.Mesh(geometry, material);

// MODEL loading

// gltf / glb standard 3D file format for the web
// await pauses execution until its done loading before moving on - avoids crashing this way

async function loadModel() {

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(CONFIG.modelPath);
  
  gltf.scene.scale.set(.1, .1, .1); // scaling model

  gltf.scene.traverse((child) => {

    if (child.isMesh) {

      applyChromeMaterial(child);

    }

  });

  scene.add(gltf.scene);
  log("Model loaded");

}

// HDR FILE loading (high dynamic range image format — gives chrome something to reflect)

async function loadEnvironment() {

  const rgbeLoader = new RGBELoader();
  const texture = await rgbeLoader.loadAsync("/assets/exr-temp.hdr");
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = texture; // lights + reflects off all meshes
  log("Environment loaded");

}

function applyChromeMaterial(mesh) {

  mesh.material = new THREE.MeshStandardMaterial({

    metalness: 1.0,  // fully metallic
    roughness: 0.0,  // perfectly smooth — no diffuse scattering

  });

}

// update state / draw - handling all animation data

function update(state) {

  state.elapsed = state.clock.getElapsedTime();
  // getelapsedtime

  cube.rotation.x = state.elapsed * 0.5;
  cube.rotation.y = state.elapsed * 0.5;

  controls.update();

}

function draw(renderer, scene, camera, state) {

  update(state);
  renderer.render(scene, camera);

}

// ANIMATION loop (calling render every frame)

function tick(renderer, scene, camera, state, draw) { 

  // create current frame
  draw(renderer, scene, camera, state);
  // once the browser is ready to repaint, call tick again
  state.animationId = requestAnimationFrame(() => tick(renderer, scene, camera, state, draw));
  // rAF returns ID stored in state (allows for cancellation / pausing of loop later)

}

function startLoop(renderer, scene, camera, state, draw) {

  if (state.animationId) cancelAnimationFrame(state.animationId);
  tick(renderer, scene, camera, state, draw);

}

function stopLoop(state) {

  cancelAnimationFrame(state.animationId);
  state.animationId = null;

}

///////////// EVENT LISTENERS for DOM ꒰ᐢ. .ᐢ꒱₊˚⊹

function bindEvents() {

  window.addEventListener("resize", () => {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

  });

}

// init

async function init() {

  await loadEnvironment();
  await loadModel();
  bindEvents();
  startLoop(renderer, scene, camera, state, draw);
  state.isInitialized = true;
  log("App initialized");

}

init();