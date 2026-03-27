import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { useStore } from '../store';

const WIDTH = 128;
const HEIGHT = 64;
const PARTICLES = WIDTH * HEIGHT;

const computeVelocityShader = `
uniform float delta;
uniform float timeScale;
uniform float softening;
uniform float G;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 posMass = texture2D(texturePosition, uv);
    vec4 velAge = texture2D(textureVelocity, uv);

    vec3 pos = posMass.xyz;
    float mass = posMass.w;
    vec3 vel = velAge.xyz;
    float age = velAge.w;

    if (mass > 10000.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, age + delta * timeScale);
        return;
    }

    vec3 acceleration = vec3(0.0);
    float lifespan = 1000.0 / mass;

    for (float y = 0.0; y < resolution.y; y++) {
        for (float x = 0.0; x < resolution.x; x++) {
            vec2 refUV = vec2(x + 0.5, y + 0.5) / resolution.xy;
            vec4 refPosMass = texture2D(texturePosition, refUV);
            vec4 refVelAge = texture2D(textureVelocity, refUV);

            vec3 dPos = refPosMass.xyz - pos;
            float distSq = dot(dPos, dPos);
            float refMass = refPosMass.w;

            if (distSq > 0.001) {
                float dist = sqrt(distSq);
                float f = (G * refMass) / (distSq + softening);
                acceleration += f * (dPos / dist);

                float refLifespan = 1000.0 / refMass;
                if (refMass > 10.0 && refVelAge.w > refLifespan && refVelAge.w < refLifespan + 2.0) {
                    if (dist < 50.0) {
                        acceleration -= (dPos / dist) * 500.0 / (distSq + 1.0);
                    }
                }
            }
        }
    }

    vel += acceleration * delta * timeScale;
    age += delta * timeScale;

    gl_FragColor = vec4(vel, age);
}
`;

const computePositionShader = `
uniform float delta;
uniform float timeScale;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 posMass = texture2D(texturePosition, uv);
    vec4 velAge = texture2D(textureVelocity, uv);

    vec3 pos = posMass.xyz;
    float mass = posMass.w;
    vec3 vel = velAge.xyz;

    if (mass > 10000.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, mass);
        return;
    }

    pos += vel * delta * timeScale;
    
    // Accretion: Stars slowly gain mass over time (accreting gas/dust)
    // Scientifically, crossing ~8 solar masses leads to a core-collapse supernova.
    if (mass < 25.0) {
        mass += 0.05 * delta * timeScale; // Faster accretion to see evolution
    }

    gl_FragColor = vec4(pos, mass);
}
`;

const particleVertexShader = `
uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;

varying vec3 vColor;
varying float vLife;
varying float vMass;

vec3 getStarColor(float mass) {
    if (mass > 15.0) return vec3(0.6, 0.7, 1.0); // O
    if (mass > 10.0) return vec3(0.7, 0.8, 1.0); // B
    if (mass > 5.0) return vec3(1.0, 1.0, 1.0); // A
    if (mass > 2.0) return vec3(1.0, 1.0, 0.8); // F
    if (mass > 1.0) return vec3(1.0, 0.9, 0.6); // G
    if (mass > 0.5) return vec3(1.0, 0.6, 0.4); // K
    return vec3(1.0, 0.3, 0.2); // M
}

void main() {
    vec4 posMass = texture2D(texturePosition, position.xy);
    vec4 velAge = texture2D(textureVelocity, position.xy);

    vec3 pos = posMass.xyz;
    float mass = posMass.w;
    float age = velAge.w;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float lifespan = 1000.0 / mass;
    vLife = age / lifespan;
    vMass = mass;

    if (mass > 10000.0) {
        gl_PointSize = 0.0;
        vColor = vec3(0.0);
    } else if (mass >= 20.0) {
        if (mass < 20.2) {
            // Very subtle galactic explosion (Supernova)
            float flashSize = mass * 100.0; 
            gl_PointSize = clamp(flashSize / -mvPosition.z, 2.0, 8.0);
            vColor = vec3(2.0, 2.2, 3.5); // Subtle white-blue flash
        } else {
            // Remnant (Neutron star / Black hole)
            gl_PointSize = clamp(2.0 / -mvPosition.z, 1.0, 2.0);
            vColor = vec3(0.01, 0.01, 0.02); 
        }
    } else if (mass > 8.0 && age > lifespan) {
        if (age < lifespan + 0.5) {
            // Very subtle galactic explosion (Supernova)
            float flashSize = mass * 100.0;
            gl_PointSize = clamp(flashSize / -mvPosition.z, 2.0, 8.0);
            vColor = vec3(2.0, 2.2, 3.5); // Subtle white-blue flash
        } else {
            // Remnant (Neutron star / Black hole)
            gl_PointSize = clamp(2.0 / -mvPosition.z, 1.0, 2.0);
            vColor = vec3(0.01, 0.01, 0.02); 
        }
    } else {
        vec3 baseColor = getStarColor(mass);
        float sizeBase = mass * 50.0;
        
        if (vLife > 0.9 && mass <= 8.0) {
            float rgFactor = (vLife - 0.9) * 10.0;
            baseColor = mix(baseColor, vec3(1.0, 0.2, 0.05), rgFactor);
            sizeBase *= (1.0 + rgFactor * 2.0);
        } else if (vLife > 0.9 && mass > 8.0) {
            float rgFactor = (vLife - 0.9) * 10.0;
            baseColor = mix(baseColor, vec3(1.0, 0.1, 0.0), rgFactor);
            sizeBase *= (1.0 + rgFactor * 4.0);
        }
        
        if (age > lifespan && mass <= 8.0) {
            baseColor = vec3(0.8, 0.9, 1.0);
            sizeBase = mass * 10.0;
        }

        gl_PointSize = clamp(sizeBase / -mvPosition.z, 2.0, 30.0);
        vColor = baseColor;
    }
}
`;

const particleFragmentShader = `
varying vec3 vColor;
varying float vLife;
varying float vMass;

void main() {
    if (vMass > 10000.0) discard;

    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    float alpha = 1.0 - (dist * 2.0);
    alpha = pow(alpha, 1.5);

    gl_FragColor = vec4(vColor, alpha);
}
`;

export function Simulation() {
  const { gl, camera } = useThree();
  const timeScale = useStore((state) => state.timeScale);
  const isPaused = useStore((state) => state.isPaused);
  
  const gpuComputeRef = useRef<GPUComputationRenderer | null>(null);
  const positionVariableRef = useRef<any>(null);
  const velocityVariableRef = useRef<any>(null);
  const uniformsRef = useRef({
    texturePosition: { value: null },
    textureVelocity: { value: null },
  });

  const [initialized, setInitialized] = useState(false);

  const particlesGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLES * 3);

    let p = 0;
    for (let j = 0; j < WIDTH; j++) {
      for (let i = 0; i < HEIGHT; i++) {
        positions[p++] = j / (WIDTH - 1);
        positions[p++] = i / (HEIGHT - 1);
        positions[p++] = 0;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, []);

  useEffect(() => {
    const gpuCompute = new GPUComputationRenderer(WIDTH, HEIGHT, gl);

    const dtPosition = gpuCompute.createTexture();
    const dtVelocity = gpuCompute.createTexture();

    const posArray = dtPosition.image.data;
    const velArray = dtVelocity.image.data;

    for (let k = 0, kl = posArray.length; k < kl; k += 4) {
      if (k === 0) {
        posArray[k + 0] = 0;
        posArray[k + 1] = 0;
        posArray[k + 2] = 0;
        posArray[k + 3] = 800000; // Massive central black hole for stable circular orbits

        velArray[k + 0] = 0;
        velArray[k + 1] = 0;
        velArray[k + 2] = 0;
        velArray[k + 3] = 0;
        continue;
      }

      const r = Math.random();
      let x, y, z, vMag, vDir;
      const G = 0.05;
      const M = 800000; // Match central mass

      if (r < 0.08) { // Central Bulge (Irregular & Scattered)
        const radius = 5 + Math.pow(Math.random(), 2) * 100;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        x = radius * Math.sin(phi) * Math.cos(theta);
        y = radius * Math.sin(phi) * Math.sin(theta) * 0.7;
        z = radius * Math.cos(phi);
        vMag = Math.sqrt((G * M * radius) / (radius * radius + 1000.0));
        vDir = new THREE.Vector3(-z, 0, x).normalize(); // Circular orbit
      } else if (r < 0.20) { // The Bar (Messy & Broken)
        const barLength = 300 + (Math.random() - 0.5) * 80;
        const barWidth = 70 + (Math.random() - 0.5) * 40;
        const t = (Math.random() - 0.5) * 2.0;
        x = t * barLength + (Math.random() - 0.5) * barWidth;
        y = (Math.random() - 0.5) * 30;
        z = (Math.random() - 0.5) * barWidth;
        const radius = Math.max(Math.sqrt(x*x + z*z), 10);
        vMag = Math.sqrt((G * M * radius) / (radius * radius + 1000.0));
        vDir = new THREE.Vector3(-z, 0, x).normalize();
      } else if (r < 0.65) { // Spiral Arms (Broken and Irregular)
        const numArms = 2;
        const arm = Math.floor(Math.random() * numArms);
        // Add random offset to break perfect symmetry
        const armOffset = (arm * Math.PI * 2) / numArms + (Math.random() - 0.5) * 0.8;
        const minR = 200;
        const maxR = 1500;
        const radius = minR + Math.random() * (maxR - minR);
        // Variable winding
        const b = 0.25 + (Math.random() - 0.5) * 0.1;
        let theta = (1/b) * Math.log(radius / minR) + armOffset;
        
        // Huge dispersion to make it look like a real, messy galaxy
        const dispersion = (Math.random() - 0.5) * 250 * (radius / 600);
        theta += (Math.random() - 0.5) * 0.6;
        
        x = radius * Math.cos(theta) + dispersion * Math.cos(theta + Math.PI/2);
        y = (Math.random() - 0.5) * 60 * (radius / minR);
        z = radius * Math.sin(theta) + dispersion * Math.sin(theta + Math.PI/2);
        vMag = Math.sqrt((G * M * radius) / (radius * radius + 1000.0));
        vDir = new THREE.Vector3(-z, 0, x).normalize();
      } else { // Background Disk / Halo (Fills the gaps irregularly)
        const radius = 150 + Math.random() * 1600;
        const theta = Math.random() * Math.PI * 2;
        x = radius * Math.cos(theta);
        y = (Math.random() - 0.5) * 100 * Math.exp(-radius/800); // Thicker in middle
        z = radius * Math.sin(theta);
        vMag = Math.sqrt((G * M * radius) / (radius * radius + 1000.0));
        vDir = new THREE.Vector3(-z, 0, x).normalize();
      }

      // 0.1% chance to be a massive star near explosion so they happen rarely and naturally
      const mass = Math.random() > 0.999 ? 19.8 + Math.random() * 0.2 : Math.pow(Math.random(), 4) * 19 + 0.1;

      posArray[k + 0] = x;
      posArray[k + 1] = y;
      posArray[k + 2] = z;
      posArray[k + 3] = mass;

      velArray[k + 0] = vDir.x * vMag; // Pure circular velocity
      velArray[k + 1] = vDir.y * vMag;
      velArray[k + 2] = vDir.z * vMag;
      velArray[k + 3] = Math.random() * 100;
    }

    const velocityVariable = gpuCompute.addVariable('textureVelocity', computeVelocityShader, dtVelocity);
    const positionVariable = gpuCompute.addVariable('texturePosition', computePositionShader, dtPosition);

    gpuCompute.setVariableDependencies(velocityVariable, [positionVariable, velocityVariable]);
    gpuCompute.setVariableDependencies(positionVariable, [positionVariable, velocityVariable]);

    velocityVariable.material.uniforms.delta = { value: 0.0 };
    velocityVariable.material.uniforms.timeScale = { value: 1.0 };
    velocityVariable.material.uniforms.softening = { value: 1000.0 }; // Increased softening for stable orbits
    velocityVariable.material.uniforms.G = { value: 0.05 };

    positionVariable.material.uniforms.delta = { value: 0.0 };
    positionVariable.material.uniforms.timeScale = { value: 1.0 };

    const error = gpuCompute.init();
    if (error !== null) {
      console.error(error);
    }

    gpuComputeRef.current = gpuCompute;
    positionVariableRef.current = positionVariable;
    velocityVariableRef.current = velocityVariable;
    setInitialized(true);
  }, [gl]);

  const setSelectedStar = useStore((state) => state.setSelectedStar);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).tagName !== 'CANVAS') return;
      if (!initialized || !gpuComputeRef.current || !positionVariableRef.current || !velocityVariableRef.current) return;

      const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );

      const posRenderTarget = gpuComputeRef.current.getCurrentRenderTarget(positionVariableRef.current);
      const velRenderTarget = gpuComputeRef.current.getCurrentRenderTarget(velocityVariableRef.current);

      const posBuffer = new Float32Array(PARTICLES * 4);
      const velBuffer = new Float32Array(PARTICLES * 4);

      gl.readRenderTargetPixels(posRenderTarget, 0, 0, WIDTH, HEIGHT, posBuffer);
      gl.readRenderTargetPixels(velRenderTarget, 0, 0, WIDTH, HEIGHT, velBuffer);

      let closestDist = Infinity;
      let closestIdx = -1;

      const vec = new THREE.Vector3();

      for (let i = 0; i < PARTICLES; i++) {
        const idx = i * 4;
        vec.set(posBuffer[idx], posBuffer[idx + 1], posBuffer[idx + 2]);
        vec.project(camera);

        const dist = vec.distanceTo(new THREE.Vector3(mouse.x, mouse.y, vec.z));
        
        // Only select if it's in front of camera and close to mouse
        if (vec.z < 1 && dist < closestDist && dist < 0.05) {
          closestDist = dist;
          closestIdx = i;
        }
      }

      if (closestIdx !== -1) {
        const idx = closestIdx * 4;
        const mass = posBuffer[idx + 3];
        const age = velBuffer[idx + 3];
        
        let spectralClass = 'M';
        if (mass > 15) spectralClass = 'O';
        else if (mass > 10) spectralClass = 'B';
        else if (mass > 5) spectralClass = 'A';
        else if (mass > 2) spectralClass = 'F';
        else if (mass > 1) spectralClass = 'G';
        else if (mass > 0.5) spectralClass = 'K';

        setSelectedStar({
          id: closestIdx,
          mass,
          temp: mass * 1000 + 3000,
          spectralClass,
          age,
          velocity: Math.sqrt(velBuffer[idx]*velBuffer[idx] + velBuffer[idx+1]*velBuffer[idx+1] + velBuffer[idx+2]*velBuffer[idx+2]),
          position: [posBuffer[idx], posBuffer[idx+1], posBuffer[idx+2]]
        });
      } else {
        setSelectedStar(null);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [initialized, gl, camera]);

  const selectedStar = useStore((state) => state.selectedStar);
  const cameraMode = useStore((state) => state.cameraMode);
  const setSelectedStarPos = useStore((state) => state.setSelectedStarPos);
  const setSelectedStarAge = useStore((state) => state.setSelectedStarAge);
  const setSelectedStarMass = useStore((state) => state.setSelectedStarMass);
  const pixelBufferPos = useMemo(() => new Float32Array(4), []);
  const pixelBufferVel = useMemo(() => new Float32Array(4), []);

  useFrame((state, delta) => {
    if (!initialized || !gpuComputeRef.current) return;

    if (!isPaused) {
      const clampedDelta = Math.min(delta, 0.1);

      velocityVariableRef.current.material.uniforms.delta.value = clampedDelta;
      velocityVariableRef.current.material.uniforms.timeScale.value = timeScale;
      positionVariableRef.current.material.uniforms.delta.value = clampedDelta;
      positionVariableRef.current.material.uniforms.timeScale.value = timeScale;

      gpuComputeRef.current.compute();

      uniformsRef.current.texturePosition.value = gpuComputeRef.current.getCurrentRenderTarget(positionVariableRef.current).texture;
      uniformsRef.current.textureVelocity.value = gpuComputeRef.current.getCurrentRenderTarget(velocityVariableRef.current).texture;
    }

    if (selectedStar) {
      const x = selectedStar.id % WIDTH;
      const y = Math.floor(selectedStar.id / WIDTH);
      const posRenderTarget = gpuComputeRef.current.getCurrentRenderTarget(positionVariableRef.current);
      const velRenderTarget = gpuComputeRef.current.getCurrentRenderTarget(velocityVariableRef.current);
      
      gl.readRenderTargetPixels(posRenderTarget, x, y, 1, 1, pixelBufferPos);
      gl.readRenderTargetPixels(velRenderTarget, x, y, 1, 1, pixelBufferVel);
      
      const targetPos = new THREE.Vector3(pixelBufferPos[0], pixelBufferPos[1], pixelBufferPos[2]);
      setSelectedStarPos([pixelBufferPos[0], pixelBufferPos[1], pixelBufferPos[2]]);
      setSelectedStarMass(pixelBufferPos[3]);
      setSelectedStarAge(pixelBufferVel[3]);
      
      if (cameraMode === 'follow') {
        // Smoothly interpolate camera position and lookAt
        camera.position.lerp(targetPos.clone().add(new THREE.Vector3(0, 10, 30)), 0.05);
        camera.lookAt(targetPos);
      }
    } else {
      setSelectedStarPos(null);
    }
  });

  if (!initialized) return null;

  return (
    <points geometry={particlesGeometry}>
      <shaderMaterial
        uniforms={uniformsRef.current}
        vertexShader={particleVertexShader}
        fragmentShader={particleFragmentShader}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent={true}
      />
    </points>
  );
}
