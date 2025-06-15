"use client";
import { useFrame } from '@react-three/fiber';
import { useRef, useEffect, useState } from 'react';
import { Mesh, Group } from 'three';

interface VisualizerProps {
  audioElement?: HTMLAudioElement | null;
  demoMode?: boolean;
}

export function Visualizer({ audioElement, demoMode = false }: VisualizerProps) {
  const groupRef = useRef<Group>(null);
  const meshRefs = useRef<Mesh[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [frequencyData, setFrequencyData] = useState<Uint8Array>(new Uint8Array(128));
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (!audioElement || demoMode) {
      // In demo mode or without audio, we'll use synthetic data
      return;
    }

    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaElementSource(audioElement);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      source.connect(analyser);
      analyser.connect(audioContext.destination);

      // Initialize frequency data array
      setFrequencyData(new Uint8Array(analyser.frequencyBinCount));

      return () => {
        audioContext.close();
      };
    } catch (error) {
      console.error("Error setting up audio context:", error);
    }
  }, [audioElement, demoMode]);

  useFrame((state) => {
    if (!groupRef.current) return;
    
    setTime(state.clock.elapsedTime);
    
    let dataArray: Uint8Array;
    let avg = 0;
    
    if (analyserRef.current && !demoMode && audioElement?.src) {
      // Use real audio data
      dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      setFrequencyData(dataArray);
      avg = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    } else {
      // Use demo/synthetic data
      dataArray = new Uint8Array(128);
      for (let i = 0; i < dataArray.length; i++) {
        // Create synthetic frequency data with some randomness and patterns
        const wave1 = Math.sin(time * 2 + i * 0.1) * 30;
        const wave2 = Math.sin(time * 0.5 + i * 0.05) * 50;
        const noise = Math.random() * 20;
        dataArray[i] = Math.max(0, Math.min(255, 80 + wave1 + wave2 + noise));
      }
      setFrequencyData(dataArray);
      avg = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    }
    
    // Rotate the entire group
    groupRef.current.rotation.y += 0.005 + (avg / 10000);
    
    // Update individual meshes
    meshRefs.current.forEach((mesh, index) => {
      if (mesh && dataArray[index] !== undefined) {
        const frequency = dataArray[index] / 255;
        
        // Scale based on frequency
        mesh.scale.y = 0.1 + frequency * 3;
        mesh.scale.x = 0.5 + frequency * 0.5;
        mesh.scale.z = 0.5 + frequency * 0.5;
        
        // Color based on frequency
        if (mesh.material && 'color' in mesh.material && mesh.material.color) {
          const hue = (index / dataArray.length) * 360;
          const saturation = 50 + frequency * 50;
          const lightness = 30 + frequency * 40;
          (mesh.material.color as any).setHSL(hue / 360, saturation / 100, lightness / 100);
        }
        
        // Position
        const angle = (index / dataArray.length) * Math.PI * 2;
        const radius = 2 + frequency;
        mesh.position.x = Math.cos(angle) * radius;
        mesh.position.z = Math.sin(angle) * radius;
        mesh.position.y = frequency * 2 - 1;
        
        // Rotation
        mesh.rotation.x += frequency * 0.1;
        mesh.rotation.z += frequency * 0.05;
      }
    });
  });

  // Create array of meshes for frequency bars
  const createFrequencyBars = () => {
    const bars = [];
    const numBars = 32; // Reduced for better performance
    
    for (let i = 0; i < numBars; i++) {
      bars.push(
        <mesh
          key={i}
          ref={(ref) => {
            if (ref) meshRefs.current[i] = ref;
          }}
          position={[0, 0, 0]}
        >
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshStandardMaterial color="hotpink" />
        </mesh>
      );
    }
    return bars;
  };

  return (
    <group ref={groupRef}>
      {/* Ambient lighting */}
      <ambientLight intensity={0.3} />
      
      {/* Dynamic point lights */}
      <pointLight 
        position={[5, 5, 5]} 
        intensity={1 + (frequencyData[10] || 0) / 255} 
        color="cyan"
      />
      <pointLight 
        position={[-5, -5, 5]} 
        intensity={1 + (frequencyData[20] || 0) / 255} 
        color="magenta"
      />
      
      {/* Central sphere that pulses with bass */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.5 + (frequencyData[2] || 0) / 500, 32, 32]} />
        <meshStandardMaterial 
          color="white" 
          emissive="blue" 
          emissiveIntensity={(frequencyData[2] || 0) / 255 * 0.5}
        />
      </mesh>
      
      {/* Frequency bars */}
      {createFrequencyBars()}
      
      {/* Outer ring */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3, 0.1, 8, 32]} />
        <meshStandardMaterial 
          color="yellow" 
          emissive="orange"
          emissiveIntensity={(frequencyData[15] || 0) / 255 * 0.3}
        />
      </mesh>
    </group>
  );
}
