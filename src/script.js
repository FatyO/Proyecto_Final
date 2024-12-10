import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

/**
 * Enhanced Audio Analysis Setup
 */
class AudioAnalyzer {
    constructor(audio) {
        this.audio = audio;
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.isInitialized = false;
        
        this.bands = {
            bass: { start: 20, end: 250 },
            lowMid: { start: 251, end: 500 },
            mid: { start: 501, end: 2000 },
            highMid: { start: 2001, end: 4000 },
            treble: { start: 4001, end: 12000 }
        };

        this.setupErrorHandling();
    }

    async initialize() {
        if (this.isInitialized) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);
            
            this.source = this.audioContext.createMediaElementSource(this.audio);
            this.source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            
            this.analyser.smoothingTimeConstant = 0.85;
            
            this.isInitialized = true;
            console.log('Audio analyzer initialized successfully');
        } catch (error) {
            console.error('Failed to initialize audio analyzer:', error);
            throw error;
        }
    }

    setupErrorHandling() {
        this.audio.addEventListener('error', (e) => {
            console.error('Audio error:', this.audio.error);
        });

        this.audio.addEventListener('loadeddata', () => {
            console.log('Audio loaded successfully');
        });
    }

    getFrequencyRangeValue(startFreq, endFreq) {
        if (!this.isInitialized || !this.analyser) return 0;
        
        const nyquist = this.audioContext.sampleRate / 2;
        const startIndex = Math.floor(startFreq / nyquist * this.bufferLength);
        const endIndex = Math.floor(endFreq / nyquist * this.bufferLength);
        let total = 0;
        
        this.analyser.getByteFrequencyData(this.dataArray);
        
        for (let i = startIndex; i <= endIndex; i++) {
            total += this.dataArray[i];
        }
        
        return total / (endIndex - startIndex + 1) / 255;
    }

    getAudioData() {
        if (!this.isInitialized || this.audio.paused) {
            return {
                bass: 0,
                lowMid: 0,
                mid: 0,
                highMid: 0,
                treble: 0
            };
        }

        return {
            bass: this.getFrequencyRangeValue(this.bands.bass.start, this.bands.bass.end),
            lowMid: this.getFrequencyRangeValue(this.bands.lowMid.start, this.bands.lowMid.end),
            mid: this.getFrequencyRangeValue(this.bands.mid.start, this.bands.mid.end),
            highMid: this.getFrequencyRangeValue(this.bands.highMid.start, this.bands.highMid.end),
            treble: this.getFrequencyRangeValue(this.bands.treble.start, this.bands.treble.end)
        };
    }
}

/**
 * Canvas and Scene Setup
 */
const canvas = document.querySelector('canvas.webgl');
const scene = new THREE.Scene();

/**
 * Media Setup
 */
const setupVideo = () => {
    const video = document.createElement('video');
    video.src = "../models/CUARTO/freefire.mp4";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    
    video.addEventListener('error', (e) => {
        console.error('Video error:', video.error);
    });

    video.addEventListener('loadeddata', () => {
        console.log('Video loaded successfully');
        video.play().catch(e => {
            console.warn('Initial video autoplay failed:', e);
        });
    });

    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.encoding = THREE.sRGBEncoding;
    videoTexture.flipY = false;
    
    return { video, videoTexture };
};

const { video, videoTexture } = setupVideo();

// Audio setup
const songs = [
    '../sonidos/BillieEilish_BIRDS_OF_A_FEATHER.mp3',
    '../sonidos/ROSE_and_Bruno_Mars_APT_Official_Music_Video.mp3',
    '../sonidos/Dead_Or_Alive_You_Spin_Me_Round_Like a Record.mp3',
    '../sonidos/J.Cole_She Knows.mp3',
    '../sonidos/Natasha_Bedingfield_Unwritten.mp3',
    '../sonidos/NSYNC_Bye_Bye_Bye.mp3',
    '../sonidos/The_Neighbourhoood_Sweater_Weather.mp3'
];

const audio = new Audio();
let currentSongIndex = 0;
audio.src = songs[currentSongIndex];
audio.load();
audio.loop = false;
audio.volume = 0.5;

const audioAnalyzer = new AudioAnalyzer(audio);

/**
 * Texture Setup
 */
const textureLoader = new THREE.TextureLoader();
const imageTexture = textureLoader.load(
    '../models/CUARTO/CONSTELACIONES.png',
    (texture) => {
        console.log('Image texture loaded successfully');
        texture.encoding = THREE.sRGBEncoding;
        texture.flipY = false;
    },
    undefined,
    (error) => {
        console.error('Error loading image texture:', error);
    }
);

/**
 * HDRI Setup
 */
let backgroundMesh;
let rotationSpeed = 0.00055;
let totalRotation = 0;
const maxRotation = Math.PI;

function createBackgroundSphere() {
    const geometry = new THREE.SphereGeometry(50, 32, 32);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    backgroundMesh = new THREE.Mesh(geometry, material);
    scene.add(backgroundMesh);
}

createBackgroundSphere();

const exrs = {
    w: '../HDRI/hdr0.exr',
    a: '../HDRI/hdr1.exr',
    s: '../HDRI/hdr2.exr',
    d: '../HDRI/hdr3.exr',
    q: '../HDRI/hdr4.exr',
    e: '../HDRI/hdr5.exr',
    f: '../HDRI/hdr6.exr',
};

const exrLoader = new EXRLoader();

function changeEXR(key) {
    const exrPath = exrs[key];
    if (!exrPath) return;

    exrLoader.load(
        exrPath,
        (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            if (backgroundMesh) {
                backgroundMesh.material.map = texture;
                backgroundMesh.material.needsUpdate = true;
            }
            scene.environment = texture;
            totalRotation = 0;
            if (backgroundMesh) {
                backgroundMesh.rotation.y = 0;
            }
        },
        undefined,
        (error) => {
            console.error(`Error loading EXR for key ${key}:`, error);
        }
    );
}

/**
 * Camera Setup
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
};

const cameraPositions = {
    1: { position: new THREE.Vector3(5, 8, -10), lookAt: new THREE.Vector3(0, 5, 10) },
    2: { position: new THREE.Vector3(-50, 10, 0), lookAt: new THREE.Vector3(0, 5, 0) },
};

const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 1000);
camera.position.copy(cameraPositions[1].position);
camera.lookAt(cameraPositions[1].lookAt);
scene.add(camera);

/**
 * Lighting Setup
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.far = 5000;
scene.add(directionalLight);

const directionalLightf = new THREE.DirectionalLight(0xffffff, 1);
directionalLightf.position.set(1, 1, 3);
directionalLightf.castShadow = true;
directionalLightf.shadow.mapSize.width = 5000;
directionalLightf.shadow.mapSize.height = 5000;
directionalLightf.shadow.camera.far = 5000;
scene.add(directionalLightf);


const pointLight = new THREE.PointLight(0xffffff, 1, 300);
pointLight.position.set(0, 5, 0);
scene.add(pointLight);

/**
 * Models Setup
 */
const gltfLoader = new GLTFLoader();
const models = [
    { path: '../models/CUARTO/MONITORES_Y_MESA.gltf', name: 'cuarto' },
    { path: '../models/CUARTO/hongo.gltf', name: 'hongo' },
    { path: '../models/CUARTO/teclado.gltf', name: 'teclado' },
    { path: '../models/CUARTO/woofer.gltf', name: 'woofer' },
    { path: '../models/CUARTO/monitores_sin.gltf', name: 'monitores' },
    { path: '../models/CUARTO/monitor izquierdo.gltf', name: 'monitor_left' },
    { path: '../models/CUARTO/monitor_der.gltf', name: 'monitor_right' }
];

let wooferModel = null;
let hongoModel = null;
let hongoLight = null;
let isHongoLightOn = true;
let leftMonitor = null;
let rightMonitor = null;
let monitores_sin = null;





models.forEach((model) => {
    gltfLoader.load(
        model.path,
        (gltf) => {
            const loadedModel = gltf.scene;
            loadedModel.traverse((child) => {
                if (child.isMesh) {
                    child.material.needsUpdate = true;
                    child.material.receiveShadow=true;
                    child.material.castShadow=true;
                    if (model.name === 'monitor_left') {
                        leftMonitor = loadedModel;
                        child.material = new THREE.MeshStandardMaterial({
                            map: imageTexture,
                            emissive: new THREE.Color(0xffffff),
                            emissiveMap: imageTexture,
                            emissiveIntensity: 1.5,
                            metalness: 0,
                            roughness: 0,
                            receiveShadow:true,
                            castShadow:true

                        });
                    } else if (model.name === 'monitor_right') {
                        rightMonitor = loadedModel;
                        child.material = new THREE.MeshStandardMaterial({
                            map: videoTexture,
                            emissive: new THREE.Color(0xffffff),
                            emissiveMap: videoTexture,
                            emissiveIntensity: 1.5,
                            metalness: 0,
                            roughness: 0,
                            receiveShadow:true,
                            castShadow:true
                        });
                    } else if (child.material.isMeshStandardMaterial || child.material.isMeshPhongMaterial) {
                        child.material.metalness = 0;
                        child.material.roughness = 0.7;
                    }
                    
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            scene.add(loadedModel);
            console.log(`Model ${model.name} loaded.`);

            if (model.name === 'woofer') {
                wooferModel = loadedModel;
            }

            
        
            
            if (model.name === 'hongo') {
                hongoModel = loadedModel;
                hongoLight = new THREE.PointLight(0xffffff, 3, 10);
                
                const boundingBox = new THREE.Box3().setFromObject(hongoModel);
                const center = boundingBox.getCenter(new THREE.Vector3());
                hongoLight.position.copy(center);
                
                const hongoAmbient = new THREE.PointLight(0xffffff, 1, 8);
                hongoAmbient.position.copy(center);
                hongoAmbient.position.y += 2;
                
                scene.add(hongoLight);
                scene.add(hongoAmbient);
            }
        },
        undefined,
        (error) => {
            console.error(`Error loading model ${model.name}:`, error);
        }
    );
});

/**
 * Controls Setup
 */
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enableZoom = true;
controls.minDistance = -20;
controls.maxDistance = 20;
controls.enablePan = false;
controls.maxPolarAngle = Math.PI / 2;
controls.minPolarAngle = 0;

/**
 * Renderer Setup
 */
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

/**
 * Event Handlers
 */
window.addEventListener('resize', () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Initialize audio with user interaction
async function initializeAudio(event) {
    try {
        if (!audioAnalyzer.isInitialized) {
            await audioAnalyzer.initialize();
            console.log('Audio system initialized');
        }
    } catch (error) {
        console.error('Failed to initialize audio:', error);
    }
}

// Camera switching function
function switchCamera(number) {
    const newPosition = cameraPositions[number];
    if (newPosition) {
        camera.position.copy(newPosition.position);
        camera.lookAt(newPosition.lookAt);
        controls.target.copy(newPosition.lookAt);
    }
}

// Handle click events
window.addEventListener('click', async (event) => {
    await initializeAudio(event);
    
    mouse.x = (event.clientX / sizes.width) * 2 - 1;
    mouse.y = -(event.clientY / sizes.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // Woofer interaction
    if (wooferModel) {
        const wooferIntersects = raycaster.intersectObject(wooferModel, true);
        if (wooferIntersects.length > 0) {
            try {
                if (audio.paused) {
                    await audio.play();
                } else {
                    audio.pause();
                }
            } catch (error) {
                console.error('Error toggling audio:', error);
            }
        }
    }

    // Hongo interaction
    if (hongoModel && hongoLight) {
        const hongoIntersects = raycaster.intersectObject(hongoModel, true);
        if (hongoIntersects.length > 0) {
            isHongoLightOn = !isHongoLightOn;
            hongoLight.intensity = isHongoLightOn ? 3 : 0;
        }
    }

    // Monitor interactions
    if (leftMonitor) {
        const leftMonitorIntersects = raycaster.intersectObject(leftMonitor, true);
        if (leftMonitorIntersects.length > 0) {
            console.log('Left monitor clicked');
        }
    }

    if (rightMonitor) {
        const rightMonitorIntersects = raycaster.intersectObject(rightMonitor, true);
        if (rightMonitorIntersects.length > 0) {
            try {
                if (video.paused) {
                    await video.play();
                } else {
                    video.pause();
                }
            } catch (error) {
                console.error('Error toggling video:', error);
            }
        }
    }
});

// Handle keyboard controls
window.addEventListener('keydown', async (event) => {
    const key = event.key.toLowerCase();
    
    // Prevent default space bar behavior
    if (key === ' ') {
        event.preventDefault();
    }

    // Camera controls
    if (['1', '2'].includes(event.key)) {
        switchCamera(parseInt(event.key));
    }

    // Audio controls
    if (key === ' ') {
        await initializeAudio(event);
        try {
            if (audio.paused) {
                await audio.play();
            } else {
                audio.pause();
            }
        } catch (error) {
            console.error('Error toggling audio:', error);
        }
    }

    // Song controls with error handling
    const switchSong = async (direction) => {
        try {
            currentSongIndex = direction === 'next' 
                ? (currentSongIndex + 1) % songs.length 
                : (currentSongIndex - 1 + songs.length) % songs.length;
            
            audio.src = songs[currentSongIndex];
            if (!audio.paused) {
                await audio.play();
            }
        } catch (error) {
            console.error('Error switching song:', error);
        }
    };

    if (key === 'arrowright') {
        await switchSong('next');
    } else if (key === 'arrowleft') {
        await switchSong('prev');
    }

    // Video controls
    if (key === 'v') {
        try {
            if (video.paused) {
                await video.play();
            } else {
                video.pause();
            }
        } catch (error) {
            console.error('Error toggling video:', error);
        }
    }

    // HDRI controls
    changeEXR(key);
});

// Handle song ending
audio.addEventListener('ended', async () => {
    try {
        currentSongIndex = (currentSongIndex + 1) % songs.length;
        audio.src = songs[currentSongIndex];
        await audio.play();
    } catch (error) {
        console.error('Error playing next song:', error);
    }
});

/**
 * Animation Functions
 */
function updateHDRIRotation() {
    if (backgroundMesh && backgroundMesh.material.map) {
        if (totalRotation < maxRotation) {
            totalRotation += rotationSpeed;
            backgroundMesh.rotation.y = totalRotation;
        }
    }
}

function updateLighting() {
    if (audioAnalyzer.isInitialized && !audio.paused) {
        const audioData = audioAnalyzer.getAudioData();
        
        // Update point light
        pointLight.intensity = 0.6 + (audioData.bass * 5.0);
        pointLight.color.setHSL(
            audioData.treble * 0.5,
            0.7 + audioData.mid * 0.3,
            0.4 + audioData.highMid * 0.6
        );
        pointLight.distance = 300 + (audioData.lowMid * 150);
        
        // Update ambient light
        ambientLight.intensity = 0.5 + (audioData.mid * 4.0);
        ambientLight.color.setHSL(
            audioData.bass * 0.3,
            0.5 + audioData.lowMid * 0.5,
            0.4 + audioData.mid * 0.6
        );
        
        // Update directional light
        directionalLight.intensity = 0.8 + (audioData.treble * 4.0);
        directionalLight.color.setHSL(
            0.4 + audioData.highMid * 0.6,
            0.6 + audioData.mid * 0.4,
            0.4 + audioData.treble * 0.6
        );
        
        // Update hongo light
        if (hongoLight && isHongoLightOn) {
            hongoLight.intensity = 3 + (audioData.bass * 5);
            hongoLight.color.setHSL(
                audioData.mid * 0.7,
                0.7 + audioData.highMid * 0.3,
                0.4 + audioData.treble * 0.6
            );
            hongoLight.distance = 10 + (audioData.lowMid * 20);
        }

       

        // Update monitor materials
        if (leftMonitor) {
            leftMonitor.traverse((child) => {
                if (child.isMesh && child.material.emissiveIntensity !== undefined) {
                    child.material.emissiveIntensity = 1.5 + (audioData.mid * 0.5);
                }
            });
        }
        if (rightMonitor) {
            rightMonitor.traverse((child) => {
                if (child.isMesh && child.material.emissiveIntensity !== undefined) {
                    child.material.emissiveIntensity = 1.5 + (audioData.mid * 0.5);
                }
            });
        }
    }
}

/**
 * Animation Loop
 */
const tick = () => {
    // Update controls
    controls.update();

    // Update scene elements
    updateHDRIRotation();
    updateLighting();
    
    // Update video texture if video is playing
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        videoTexture.needsUpdate = true;
    }
    
    // Render
    renderer.render(scene, camera);
    
    // Call tick again on the next frame
    window.requestAnimationFrame(tick);
};

// Start the animation loop
tick();