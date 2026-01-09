"use client"

import { useRef, useMemo } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { PerspectiveCamera, Environment, ContactShadows, Float, Stars, Trail } from "@react-three/drei"
import * as THREE from "three"
import { Suspense } from "react"

function Core() {
    const meshRef = useRef<THREE.Mesh>(null)
    const glowRef = useRef<THREE.Mesh>(null)

    useFrame((state, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.5
            meshRef.current.rotation.x += delta * 0.2
        }
        if (glowRef.current) {
            glowRef.current.rotation.y -= delta * 0.5
            // Pulsating glow
            const t = state.clock.getElapsedTime()
            const scale = 1.2 + Math.sin(t * 2) * 0.05
            glowRef.current.scale.set(scale, scale, scale)
        }
    })

    return (
        <group>
            {/* Inner Core */}
            <mesh ref={meshRef}>
                <icosahedronGeometry args={[1, 0]} />
                <meshStandardMaterial
                    color="#ffffff"
                    emissive="#4f46e5"
                    emissiveIntensity={2}
                    roughness={0.1}
                    metalness={1}
                />
            </mesh>

            {/* Outer Glow Shell */}
            <mesh ref={glowRef} scale={[1.2, 1.2, 1.2]}>
                <icosahedronGeometry args={[1, 1]} />
                <meshStandardMaterial
                    color="#6366f1"
                    transparent
                    opacity={0.15}
                    wireframe
                    side={THREE.DoubleSide}
                />
            </mesh>
        </group>
    )
}

function ShieldRing({ radius, speed, axis = 'x', color = '#818cf8', thickness = 0.05 }: { radius: number, speed: number, axis?: 'x' | 'y' | 'z', color?: string, thickness?: number }) {
    const ref = useRef<THREE.Mesh>(null)

    useFrame((state, delta) => {
        if (ref.current) {
            if (axis === 'x') ref.current.rotation.x += delta * speed
            if (axis === 'y') ref.current.rotation.y += delta * speed
            if (axis === 'z') ref.current.rotation.z += delta * speed

            // Wobble
            ref.current.rotation.z += Math.sin(state.clock.elapsedTime * 0.5) * 0.002
        }
    })

    return (
        <mesh ref={ref}>
            <torusGeometry args={[radius, thickness, 32, 100]} />
            <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.5}
                roughness={0.1}
                metalness={0.8}
                transparent
                opacity={0.8}
            />
        </mesh>
    )
}

function MovingParticles() {
    const count = 200
    const mesh = useRef<THREE.InstancedMesh>(null)

    const particles = useMemo(() => {
        const temp = []
        for (let i = 0; i < count; i++) {
            const t = Math.random() * 100
            const factor = 20 + Math.random() * 100
            const speed = 0.01 + Math.random() / 200
            const xFactor = -50 + Math.random() * 100
            const yFactor = -50 + Math.random() * 100
            const zFactor = -50 + Math.random() * 100
            temp.push({ t, factor, speed, xFactor, yFactor, zFactor, mx: 0, my: 0 })
        }
        return temp
    }, [count])

    const dummy = useMemo(() => new THREE.Object3D(), [])

    useFrame((state) => {
        if (!mesh.current) return

        particles.forEach((particle, i) => {
            let { t, factor, speed, xFactor, yFactor, zFactor } = particle
            t = particle.t += speed / 2
            const a = Math.cos(t) + Math.sin(t * 1) / 10
            const b = Math.sin(t) + Math.cos(t * 2) / 10
            const s = Math.cos(t)

            dummy.position.set(
                (particle.mx / 10) * a + xFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 1) * factor) / 10,
                (particle.my / 10) * b + yFactor + Math.sin((t / 10) * factor) + (Math.cos(t * 2) * factor) / 10,
                (particle.my / 10) * b + zFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 3) * factor) / 10
            )
            dummy.scale.set(s, s, s)
            dummy.rotation.set(s * 5, s * 5, s * 5)
            dummy.updateMatrix()

            mesh.current!.setMatrixAt(i, dummy.matrix)
        })
        mesh.current.instanceMatrix.needsUpdate = true
    })

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
            <dodecahedronGeometry args={[0.2, 0]} />
            <meshStandardMaterial color="#4f46e5" roughness={0.5} opacity={0.5} transparent />
        </instancedMesh>
    )
}

function CameraController() {
    const { camera } = useThree()

    useFrame(() => {
        const scrollY = window.scrollY
        const height = document.documentElement.scrollHeight - window.innerHeight
        const scrollProgress = Math.min(scrollY / height, 1)

        // Subtle camera rotation based on scroll
        const targetY = scrollProgress * 2

        camera.position.y += (targetY - camera.position.y) * 0.05
        camera.lookAt(0, 0, 0)
    })

    return null
}

function SceneObjects() {
    const { size } = useThree()
    const groupRef = useRef<THREE.Group>(null)
    const isMobile = size.width < 768

    useFrame(() => {
        if (!groupRef.current) return

        const scrollY = window.scrollY
        const height = document.documentElement.scrollHeight - window.innerHeight
        const scrollProgress = Math.min(scrollY / height, 1)

        // Animate position: right (4) -> center (0) as we scroll
        // Animate scale: normal (1) -> larger (1.3) as we scroll

        if (isMobile) {
            // On mobile, keep centered
            groupRef.current.position.x = 0
            groupRef.current.scale.setScalar(1)
        } else {
            // On desktop, animate from right to center
            const targetX = THREE.MathUtils.lerp(4, 0, scrollProgress * 1) // Move to center by 50% scroll
            const targetScale = THREE.MathUtils.lerp(1, 1.3, scrollProgress * 2) // Grow by 50% scroll

            groupRef.current.position.x += (targetX - groupRef.current.position.x) * 0.05
            const currentScale = groupRef.current.scale.x
            const newScale = currentScale + (targetScale - currentScale) * 0.05
            groupRef.current.scale.setScalar(newScale)
        }
    })

    return (
        <group ref={groupRef} position={[isMobile ? 0 : 4, 0, 0]}>
            <Core />
            <ShieldRing radius={2} speed={0.2} axis="x" color="#4f46e5" thickness={0.05} />
            <ShieldRing radius={2.5} speed={0.15} axis="y" color="#818cf8" thickness={0.03} />
            <ShieldRing radius={3} speed={0.1} axis="z" color="#c084fc" thickness={0.02} />
        </group>
    )
}

export function Scene() {
    return (
        <div className="fixed inset-0 h-screen w-screen -z-10">
            <Canvas>
                <PerspectiveCamera makeDefault position={[0, 0, 12]} />
                <Suspense fallback={
                    <mesh>
                        <sphereGeometry args={[0.5, 32, 32]} />
                        <meshBasicMaterial color="#4f46e5" opacity={0.1} transparent />
                    </mesh>
                }>
                    <Environment preset="city" />

                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} intensity={1.5} color="#4f46e5" />
                    <pointLight position={[-10, -10, -10]} intensity={1} color="#ec4899" />

                    <SceneObjects />

                    <MovingParticles />
                    <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
                    <CameraController />
                </Suspense>
            </Canvas>
        </div>
    )
}
