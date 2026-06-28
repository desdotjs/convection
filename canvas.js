"use strict";

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// constants - global settings, or rules

const CONFIG = {
  debug: true,
  version: "1.0.0",
  background: 0x111111,
  modelPath: "/assets/fish.glb",
};

// create the scene ໒꒰ྀི ˶• ༝ •˶ ꒱ྀི১₊˚⊹♡

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.background); // container holding + rendering everything

// camera - perspectivecamera mimics how the eye sees
const camera = new THREE.PerspectiveCamera(
  // arguments:
  75, // field of view
  window.innerWidth / window.innerHeight, // aspect ratio
  0.1, // near clip
  1000 // far clip
);
camera.position.set(0, 1, 5);

// drawing to screen, aka rendering

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio); // ensures good quality on different screens
document.body.appendChild(renderer.domElement); // canvas element

const controls = new OrbitControls(camera, renderer.domElement);
// pan around with mouse
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// lighting the scene

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
// ambientlight evenly and softly lights the 3d scene
scene.add(ambientLight);
// scene.add injects it into the world
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// state

let state = {
  isInitialized: false,
  animationId: null,
  clock: new THREE.Clock(), // internal time clock for three.js
  elapsed: 0,

  // tracking states between frames

  // making an object allows all the information to be squeezed into one parameter
};

// console / utilities

function log(...args) {
  if (CONFIG.debug) console.log("[App]", ...args);
}

function handleError(error) {
  console.error("[Error]", error);
}

// scene objects

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x00aaff });
const cube = new THREE.Mesh(geometry, material);

// load model

// gltf standard 3D file format for the web
// await pauses execution until its done loading before moving on

async function loadModel() {
  const loader = new GLTFLoader();

  const gltf = await loader.loadAsync(CONFIG.modelPath);
  scene.add(gltf.scene);
  log("Model loaded");
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

// animation loop

function tick(renderer, scene, camera, state, draw) {
  draw(renderer, scene, camera, state);
  state.animationId = requestAnimationFrame(() => tick(renderer, scene, camera, state, draw));
}

function startLoop(renderer, scene, camera, state, draw) {
  if (state.animationId) cancelAnimationFrame(state.animationId);
  tick(renderer, scene, camera, state, draw);
}

function stopLoop(state) {
  cancelAnimationFrame(state.animationId);
  state.animationId = null;
}

// event listeners for DOM

function bindEvents() {
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// init

async function init() {
  try {
    await loadModel();
    bindEvents();
    startLoop(renderer, scene, camera, state, draw);
    state.isInitialized = true;
    log("App initialized");
  } catch (error) {
    handleError(error);
  }
}

init();