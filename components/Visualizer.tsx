"use client";
import { useFrame } from '@react-three/fiber';
import { useRef, useEffect } from 'react';
import { Mesh } from 'three';

export function Visualizer({ audioElement }: { audioElement: HTMLAudioElement }) {
  const meshRef = useRef<Mesh>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaElementSource(audioElement);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;
    source.connect(analyser);
    analyser.connect(audioContext.destination);
  }, [audioElement]);

  useFrame(() => {
    if (!analyserRef.current || !meshRef.current) return;
    
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const avg = data.reduce((sum, value) => sum + value, 0) / data.length;
    
    meshRef.current.scale.y = avg / 50;
    meshRef.current.rotation.x += 0.01;
    meshRef.current.rotation.y += 0.01;
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  );
}
