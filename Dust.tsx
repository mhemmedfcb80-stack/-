import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';

const dustVertexShader = `
uniform float time;
uniform float timeScale;
attribute vec3 customColor;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vColor = customColor;
  vec3 pos = position;
  
  float dist = length(pos.xz);
  float angle = atan(pos.z, pos.x);
  
  // Match the star velocity: v = sqrt((GM*r)/(r^2 + softening)). GM = 40000, softening = 1000
  // Angular velocity omega = v / r
  float omega = sqrt((40000.0 * dist) / (dist * dist + 1000.0)) / max(dist, 1.0);
  
  // Apply rotation over time
  angle += time * omega;
  
  pos.x = cos(angle) * dist;
  pos.z = sin(angle) * dist;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  // Size attenuation and noise
  float noise = sin(dist * 0.05 + time * 0.5) * 0.5 + 0.5;
  // Massive point size to overlap and look like continuous gas
  gl_PointSize = (3000.0 * (1.0 + noise * 0.8)) / -mvPosition.z;
  
  // Fade out at edges, very low alpha for volumetric blending
  vAlpha = clamp(1.0 - (dist / 1500.0), 0.0, 1.0) * 0.04;
}
`;

const dustFragmentShader = `
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  if (dist > 0.5) discard;
  
  // Gaussian falloff for a volumetric gas look
  float alpha = exp(-dist * dist * 16.0);
  gl_FragColor = vec4(vColor, alpha * vAlpha);
}
`;

export function Dust() {
  const timeScale = useStore((state) => state.timeScale);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const accumulatedTime = useRef(0);

  const { positions, colors } = useMemo(() => {
    const count = 60000; // Massive count for volumetric gas effect
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const colorPalette = [
      new THREE.Color('#ff2a6d'), // Vibrant Pink (H-alpha)
      new THREE.Color('#05d9e8'), // Cyan/Teal (O-III)
      new THREE.Color('#4d94ff'), // Bright Blue
      new THREE.Color('#9d4edd'), // Deep Purple
      new THREE.Color('#ff9e00'), // Orange/Gold
    ];

    for (let i = 0; i < count; i++) {
      const r_rand = Math.random();
      let x, y, z, radius;
      
      if (r_rand < 0.05) { // Bulge dust (Irregular)
        radius = 5 + Math.pow(Math.random(), 2) * 90;
        const theta = Math.random() * Math.PI * 2;
        x = radius * Math.cos(theta);
        y = (Math.random() - 0.5) * 80;
        z = radius * Math.sin(theta);
      } else if (r_rand < 0.15) { // Bar dust (Scattered)
        const barLength = 280 + (Math.random() - 0.5) * 60;
        const barWidth = 50 + (Math.random() - 0.5) * 30;
        const t = (Math.random() - 0.5) * 2.0;
        x = t * barLength + (Math.random() - 0.5) * barWidth;
        y = (Math.random() - 0.5) * 25;
        z = (Math.random() - 0.5) * barWidth;
        radius = Math.sqrt(x*x + z*z);
      } else if (r_rand < 0.70) { // Spiral Arms dust (Clumpy and broken)
        const numArms = 2;
        const arm = Math.floor(Math.random() * numArms);
        const armOffset = (arm * Math.PI * 2) / numArms + (Math.random() - 0.5) * 0.6;
        const minR = 200;
        const maxR = 1500;
        radius = minR + Math.pow(Math.random(), 1.2) * (maxR - minR); // More dust inner
        const b = 0.25 + (Math.random() - 0.5) * 0.1;
        let theta = (1/b) * Math.log(radius / minR) + armOffset;
        
        // Huge dispersion for dust clouds
        const dispersion = (Math.random() - 0.5) * 180;
        theta += (Math.random() - 0.5) * 0.4;
        
        x = radius * Math.cos(theta) + dispersion * Math.cos(theta + Math.PI/2);
        y = (Math.random() - 0.5) * 40 * (radius / minR);
        z = radius * Math.sin(theta) + dispersion * Math.sin(theta + Math.PI/2);
      } else { // Background scattered dust
        radius = 200 + Math.random() * 1400;
        const theta = Math.random() * Math.PI * 2;
        x = radius * Math.cos(theta);
        y = (Math.random() - 0.5) * 120;
        z = radius * Math.sin(theta);
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Assign colors based on radius and random selection
      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      
      // Mix with a base dark blue/purple for depth
      const finalColor = new THREE.Color('#0f051d').lerp(color, 0.5 + Math.random() * 0.5);

      colors[i * 3] = finalColor.r;
      colors[i * 3 + 1] = finalColor.g;
      colors[i * 3 + 2] = finalColor.b;
    }

    return { positions, colors };
  }, []);

  useFrame((state, delta) => {
    if (materialRef.current) {
      accumulatedTime.current += delta * timeScale;
      materialRef.current.uniforms.time.value = accumulatedTime.current;
      materialRef.current.uniforms.timeScale.value = timeScale;
    }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-customColor"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={dustVertexShader}
        fragmentShader={dustFragmentShader}
        uniforms={{
          time: { value: 0 },
          timeScale: { value: 1.0 }
        }}
        transparent={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
