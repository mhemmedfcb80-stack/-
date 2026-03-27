import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

const accretionDiskVertexShader = `
varying vec2 vUv;
varying vec3 vPosition;
void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const accretionDiskFragmentShader = `
varying vec2 vUv;
varying vec3 vPosition;
uniform float time;
uniform float opacity;

// Simplex noise function
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
    float dist = length(vPosition.xy);
    float angle = atan(vPosition.y, vPosition.x);
    
    // Doppler beaming (brighter on one side)
    float doppler = sin(angle) * 0.5 + 0.5; // 0 to 1
    doppler = mix(0.4, 1.5, doppler);
    
    // Swirling noise
    float n = snoise(vec2(dist * 0.3 - time * 3.0, angle * 4.0 + time * 2.0));
    float n2 = snoise(vec2(dist * 0.8 + time, angle * 15.0 - time * 5.0));
    
    float intensity = (n * 0.6 + n2 * 0.4) * 0.5 + 0.5;
    
    // Sharp inner edge, smooth outer edge
    float alpha = smoothstep(18.0, 20.0, dist) * smoothstep(50.0, 25.0, dist);
    
    // Color gradient: hot white/blue inner, orange/red outer
    vec3 hotColor = vec3(1.0, 0.9, 0.8);
    vec3 midColor = vec3(1.0, 0.5, 0.1);
    vec3 coldColor = vec3(0.5, 0.1, 0.0);
    
    float colorMix = smoothstep(20.0, 40.0, dist);
    vec3 color = mix(hotColor, midColor, colorMix);
    color = mix(color, coldColor, smoothstep(35.0, 50.0, dist));
    
    color *= intensity * doppler * 2.0;
    
    gl_FragColor = vec4(color, alpha * opacity * intensity);
}
`;

const lensedHaloVertexShader = `
varying vec3 vNormal;
varying vec3 vViewPosition;
void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
}
`;

const lensedHaloFragmentShader = `
varying vec3 vNormal;
varying vec3 vViewPosition;
uniform float opacity;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    
    // Fresnel effect for the edge halo
    float fresnel = dot(normal, viewDir);
    fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
    fresnel = pow(fresnel, 3.0);
    
    // Make it thicker at the poles (y axis)
    float poleFactor = abs(normal.y);
    poleFactor = pow(poleFactor, 2.0);
    
    float intensity = fresnel * poleFactor * 2.0;
    
    vec3 color = vec3(1.0, 0.6, 0.2); // Orange glow
    
    gl_FragColor = vec4(color * intensity, intensity * opacity);
}
`;

export function BlackHole() {
  const diskMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const haloMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const eventHorizonRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    const dist = state.camera.position.length();
    // Fade in when distance is between 300 and 100
    const alpha = THREE.MathUtils.clamp((300 - dist) / 200, 0, 1);

    if (eventHorizonRef.current) {
      eventHorizonRef.current.opacity = alpha;
    }

    if (diskMaterialRef.current) {
      diskMaterialRef.current.uniforms.time.value = state.clock.elapsedTime;
      diskMaterialRef.current.uniforms.opacity.value = alpha;
    }
    
    if (haloMaterialRef.current) {
      haloMaterialRef.current.uniforms.opacity.value = alpha;
    }
  });

  return (
    <group>
      {/* Event Horizon */}
      <mesh>
        <sphereGeometry args={[15, 64, 64]} />
        <meshBasicMaterial ref={eventHorizonRef} color="black" transparent />
      </mesh>

      {/* Main Accretion Disk */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[18, 50, 128]} />
        <shaderMaterial
          ref={diskMaterialRef}
          vertexShader={accretionDiskVertexShader}
          fragmentShader={accretionDiskFragmentShader}
          uniforms={{ time: { value: 0 }, opacity: { value: 0 } }}
          transparent
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      
      {/* Lensed Halo (Fake Interstellar effect) */}
      <mesh>
        <sphereGeometry args={[17, 64, 64]} />
        <shaderMaterial
          ref={haloMaterialRef}
          vertexShader={lensedHaloVertexShader}
          fragmentShader={lensedHaloFragmentShader}
          uniforms={{ opacity: { value: 0 } }}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
