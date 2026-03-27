import { OrbitControls, Stars } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { BlackHole } from './BlackHole';
import { Simulation } from './Simulation';
import { useStore } from '../store';
import { getSpectralColor } from './UI';
import { Dust } from './Dust';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function ActiveStar() {
  const selectedStar = useStore((state) => state.selectedStar);
  const pos = useStore((state) => state.selectedStarPos);
  const age = useStore((state) => state.selectedStarAge);
  const currentMass = useStore((state) => state.selectedStarMass) || selectedStar?.mass || 1;
  
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    if (!selectedStar || !pos || age === null || !meshRef.current || !materialRef.current || !lightRef.current) return;
    
    const lifespan = 1000 / currentMass;
    const lifeRatio = age / lifespan;
    
    let color = new THREE.Color(getSpectralColor(selectedStar.spectralClass));
    let size = Math.max(0.5, currentMass * 0.2);
    let intensity = 2;
    
    if (currentMass >= 20.0) {
      if (currentMass < 20.2) {
        // Supernova (Mass triggered)
        color.setHex(0xffffff);
        size = 10; // Subtle local explosion
        intensity = 10;
      } else {
        // Remnant (Black Hole / Neutron Star)
        color.setHex(0x111122);
        size = 0.1;
        intensity = 0;
      }
    } else if (currentMass > 8 && age > lifespan) {
      if (age < lifespan + 2.0) {
        // Supernova (Age triggered)
        color.setHex(0xffffff);
        size = 50; // Huge local explosion
        intensity = 50;
      } else {
        // Remnant (Black Hole / Neutron Star)
        color.setHex(0x111122);
        size = 0.1;
        intensity = 0;
      }
    } else if (lifeRatio > 0.9) {
      // Red Giant Phase
      const factor = Math.min(1, (lifeRatio - 0.9) * 10);
      color.lerp(new THREE.Color('#ff3300'), factor);
      size *= (1 + factor * 10); // Swell up
    } else if (age > lifespan && currentMass <= 8) {
      // White Dwarf
      color.setHex(0xe0f0ff);
      size *= 0.1;
    }
    
    meshRef.current.position.set(pos[0], pos[1], pos[2]);
    meshRef.current.scale.setScalar(size);
    materialRef.current.color = color;
    lightRef.current.color = color;
    lightRef.current.intensity = intensity;
    lightRef.current.position.set(pos[0], pos[1], pos[2]);
  });

  if (!selectedStar) return null;
  
  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial ref={materialRef} />
      </mesh>
      <pointLight ref={lightRef} distance={500} />
    </group>
  );
}

function Controls() {
  const cameraMode = useStore((state) => state.cameraMode);
  return (
    <OrbitControls 
      makeDefault 
      enableDamping 
      dampingFactor={0.05} 
      maxDistance={3000}
      minDistance={5}
      enabled={cameraMode === 'free'}
    />
  );
}

export function Scene() {
  return (
    <Canvas camera={{ position: [0, 400, 1000], fov: 60, far: 15000 }}>
      <color attach="background" args={['#000005']} />
      
      <ambientLight intensity={0.1} />
      
      <Stars radius={1500} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      
      <Dust />
      <Simulation />
      <BlackHole />
      <ActiveStar />
      
      <Controls />
      
      <EffectComposer>
        <Bloom luminanceThreshold={0.5} mipmapBlur intensity={1.5} />
      </EffectComposer>
    </Canvas>
  );
}
