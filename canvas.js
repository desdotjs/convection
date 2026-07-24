"use strict";

// ///////////// IMPORTS

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

// ///////////// CONFIG
// app-wide settings, edit once

const CONFIG = {

  debug: true,
  version: "1.0.0",
  background: 0x111111,
  modelPath: "/assets/fish.glb",
  modelScale: 0.05,

  attractor: { // hadley attractor values put in CONFIG because it controls behavior, not logic
    a: 0.2,
    b: 4,
    f: 8, // amplitude
    g: 1.15,
    dt: 0.01,
    steps: 30000,
    count: 500,   // how many models to place
    speed: 0.2,  // supports decimals — lower = slower, higher = faster
  }

};

// ///////////// WORLD
// the scene, the eye, the screen

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
camera.position.set(0, 0, 5); // pulled back to see the attractor

// RENDERING to screen

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio); // ensures good quality on different screens
document.body.appendChild(renderer.domElement); // canvas element

const controls = new OrbitControls(camera, renderer.domElement);
// pan around with mouse
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// ///////////// LIGHTING
// without it, nothing is visible

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
// ambientlight evenly and softly lights the 3d scene
scene.add(ambientLight);
// scene.add injects it into the world

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// ///////////// STATE
// tracks states between frames - made an object to condense into one param

let state = {

  isInitialized: false,
  animationId: null,
  clock: new THREE.Clock(), // internal time clock for three.js
  elapsed: 0,
  clones: [], // stores each clone + its current index along the path

};

// ///////////// UTILITIES
// log(...args) — prints to console only if CONFIG.debug is true
// handleError(error) — logs errors consistently, called inside try/catch

function log(...args) {
  if (CONFIG.debug) console.log("[App]", ...args);
}

function handleError(error) {
  console.error("[Error]", error);
}

// ///////////// OBJECTS
// meshes, materials, geometries — static things that live in the scene

// hadley attractor — walks through the equations step by step, collecting x,y,z positions
// each step is a tiny nudge forward in time using dt (delta time)
// static — stored positions do NOT update over time, so it doesn't go in DRAW

const { a, b, f, g, dt, steps } = CONFIG.attractor; // pull values out of CONFIG

const next = (x, y, z) => {
  const dx = -Math.pow(y, 2) - Math.pow(z, 2) - a * x + a * f;
  const dy = x * y - b * x * z - y + g;
  const dz = b * x * y + x * z - z;
  return { dx, dy, dz };
};

let x = 0.1, y = 0, z = 0; // starting position of attractor
const points = []; // collecting x,y,z positions

for (let i = 0; i < steps; i++) {

  const { dx, dy, dz } = next(x, y, z);
  x += dx * dt;
  y += dy * dt;
  z += dz * dt;
  points.push(new THREE.Vector3(x, y, z));

}

// build the line from the collected points
const attractorGeometry = new THREE.BufferGeometry().setFromPoints(points);

const attractorMaterial = new THREE.LineBasicMaterial({

  color: 0xffffff,
  transparent: true,
  opacity: 0.0, // 0 = fully transparent, 1 = fully opaque

});

const attractorLine = new THREE.Line(attractorGeometry, attractorMaterial);

scene.add(attractorLine);

// ///////////// LOADING
// loadModel() — loads the glb, creates count clones evenly spaced along the path
// each clone is stored in state.clones with its current path index so update() can move it
// loadEnvironment() — loads the hdr for chrome reflections
// applyChromeMaterial() — applies chrome material to each mesh

async function loadModel() {

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(CONFIG.modelPath);
  const { count } = CONFIG.attractor;

  for (let i = 0; i < count; i++) {

    // stagger starting positions evenly so they don't all pile up at the same point
    const index = Math.floor((i / count) * points.length);
    const point = points[index];
    const nextPoint = points[Math.min(index + 1, points.length - 1)];

    const clone = gltf.scene.clone(true);
    clone.position.copy(point);
    clone.scale.setScalar(CONFIG.modelScale);

    if (nextPoint) clone.lookAt(nextPoint);

    clone.traverse((child) => {
      if (child.isMesh) {
        applyChromeMaterial(child);
      }
    });

    scene.add(clone);

    // store clone + its current float index in state so update() can advance it each frame
    // float index allows sub-point movement for finer speed control
    state.clones.push({ clone, index: index });

  }

  log("Models loaded");

}

// HDR FILE loading (high dynamic range image format — gives chrome something to reflect)

async function loadEnvironment() {

  const rgbeLoader = new RGBELoader();
  const texture = await rgbeLoader.loadAsync("/assets/chrome.hdr");
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

// ///////////// DRAW
// update() — moves things, updates state each frame
// draw() — calls update then renders the frame

function update(state) {

  state.elapsed = state.clock.getElapsedTime();

  // advance each clone backwards along the attractor path every frame
  // float index allows decimal speed values for fine control

for (const fish of state.clones) {
  fish.index = (fish.index - CONFIG.attractor.speed + points.length) % points.length;
  
  const i0 = Math.floor(fish.index);
  const i1 = Math.min(i0 + 1, points.length - 1);
  const t = fish.index - i0; // how far between i0 and i1 we are (0 to 1)

  // smoothly blend between the two neighbouring points using lerp
  const smoothPos = new THREE.Vector3().lerpVectors(points[i0], points[i1], t);
  fish.clone.position.copy(smoothPos);

  const nextPoint = points[i1];
  if (nextPoint) fish.clone.lookAt(nextPoint);
}

  controls.update();

}

function draw(renderer, scene, camera, state) {

  update(state);
  renderer.render(scene, camera);

}

// ///////////// PULSE
// the heartbeat of the app
// tick() — one frame: draw + schedule next frame
// startLoop() — fires the first tick
// stopLoop() — cancels the loop
// bindEvents() — nervous system, reacts to user input

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

// ///////////// INIT

async function init() {

  await loadEnvironment();
  await loadModel();
  bindEvents();
  startLoop(renderer, scene, camera, state, draw);
  state.isInitialized = true;
  log("App initialized");

}

init();