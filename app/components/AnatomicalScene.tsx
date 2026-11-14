"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

export type OrganId =
  | "heart"
  | "lungs"
  | "liver"
  | "kidneys"
  | "stomach"
  | "intestines";

export function getOrganIdFromMeshName(name: string): OrganId | "torso_shell" | null {
  const lower = name.toLowerCase();
  if (
    lower.includes("heart") ||
    lower.includes("myocardium") ||
    lower.includes("coronary") ||
    lower.includes("aorta") ||
    lower.includes("cardiac") ||
    lower.includes("brachiocephalic") ||
    lower.includes("carotid") ||
    lower.includes("vena cava") ||
    lower.includes("subclavian") ||
    lower.includes("interventricular")
  ) {
    return "heart";
  }
  if (
    lower.includes("lung") ||
    lower.includes("bronch") ||
    lower.includes("trachea") ||
    lower.includes("pulmonary")
  ) {
    return "lungs";
  }
  if (lower.includes("liver")) {
    return "liver";
  }
  if (
    lower.includes("kidney") ||
    lower.includes("renal") ||
    lower.includes("ureter")
  ) {
    return "kidneys";
  }
  if (lower.includes("stomach") || lower.includes("esophag")) {
    return "stomach";
  }
  if (
    lower.includes("intestine") ||
    lower.includes("colon") ||
    lower.includes("bowel") ||
    lower.includes("cecum")
  ) {
    return "intestines";
  }
  if (lower.includes("torso shell") || lower.includes("makehuman")) {
    return "torso_shell";
  }
  return null;
}

type ModelProps = {
  selectedOrgan: OrganId | null;
  onSelectOrgan: (organ: OrganId) => void;
  shellXRay: boolean;
};

function TorsoModel({
  selectedOrgan,
  onSelectOrgan,
  shellXRay,
}: ModelProps) {
  const { scene } = useGLTF("/models/anatomy.glb");
  const [hoveredOrgan, setHoveredOrgan] = useState<OrganId | null>(null);

  // Clone scene & materials so instances and mutations are cleanly isolated
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => m.clone());
        } else if (mesh.material) {
          mesh.material = mesh.material.clone();
        }
      }
    });
    return clone;
  }, [scene]);

  // Update material highlights on hover, selection, and X-ray toggle
  useEffect(() => {
    clonedScene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const organId = getOrganIdFromMeshName(mesh.name);
        const isShell = organId === "torso_shell";
        const isSelected = organId !== null && organId === selectedOrgan;
        const isHovered = organId !== null && organId === hoveredOrgan;

        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];

        materials.forEach((m) => {
          const mat = m as THREE.MeshStandardMaterial;
          if (isShell) {
            mat.transparent = true;
            mat.opacity = shellXRay ? 0.22 : 0.9;
            mat.roughness = 0.35;
            mat.metalness = 0.2;
            if (shellXRay) {
              mat.color.set("#0ea5e9");
            }
          } else if (isSelected) {
            mat.emissive.set("#06b6d4");
            mat.emissiveIntensity = 0.65;
          } else if (isHovered) {
            mat.emissive.set("#38bdf8");
            mat.emissiveIntensity = 0.35;
          } else {
            mat.emissive.set("#000000");
            mat.emissiveIntensity = 0;
          }
        });
      }
    });
  }, [clonedScene, selectedOrgan, hoveredOrgan, shellXRay]);

  return (
    <primitive
      object={clonedScene}
      position={[0, -0.32, 0]}
      onPointerOver={(e: { stopPropagation: () => void; object: THREE.Object3D }) => {
        e.stopPropagation();
        const org = getOrganIdFromMeshName(e.object.name);
        if (org && org !== "torso_shell") {
          setHoveredOrgan(org);
          document.body.style.cursor = "pointer";
        }
      }}
      onPointerOut={() => {
        setHoveredOrgan(null);
        document.body.style.cursor = "auto";
      }}
      onPointerDown={(e: { stopPropagation: () => void; object: THREE.Object3D }) => {
        e.stopPropagation();
        const org = getOrganIdFromMeshName(e.object.name);
        if (org && org !== "torso_shell") {
          onSelectOrgan(org);
        }
      }}
    />
  );
}

useGLTF.preload("/models/anatomy.glb");

export type AnatomicalSceneProps = {
  selectedOrgan: OrganId | null;
  onSelectOrgan: (organ: OrganId) => void;
  shellXRay: boolean;
};

export default function AnatomicalScene({
  selectedOrgan,
  onSelectOrgan,
  shellXRay,
}: AnatomicalSceneProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  return (
    <Canvas
      camera={{ position: [0, 0.05, 1.1], fov: 42 }}
      className="h-full w-full"
    >
      {/* Sci-Fi Lighting: Ambient + Key Light + Cyber Cyan & Blue Rim Lights */}
      <ambientLight intensity={0.9} color="#cbd5e1" />
      <directionalLight position={[2, 4, 3]} intensity={1.4} color="#ffffff" />
      <directionalLight position={[-2, 1, -2]} intensity={0.8} color="#0284c7" />
      <pointLight position={[-1.5, -1, 1]} intensity={2.5} color="#06b6d4" distance={5} />
      <pointLight position={[1.5, 2, -1]} intensity={2.0} color="#3b82f6" distance={5} />

      <TorsoModel
        selectedOrgan={selectedOrgan}
        onSelectOrgan={onSelectOrgan}
        shellXRay={shellXRay}
      />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={0.4}
        maxDistance={2.5}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}
