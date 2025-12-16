import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader, OrbitControls } from 'three-stdlib'
import '../css/Model3DViewer.css'

interface Model3DViewerProps {
  modelPath: string
  isVisible: boolean
  onClose: () => void
}

function Model3DViewer({ modelPath, isVisible, onClose }: Model3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isVisible || !containerRef.current) return

    console.log('3D Model Viewer activated:', modelPath)
    
    // 创建Three.js场景
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    
    // 设置渲染器
    renderer.setSize(800, 800)
    renderer.setClearColor(0x000000, 0)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    containerRef.current.appendChild(renderer.domElement)
    
    // 设置更亮的光源 - 保持黑色主题但增加亮度
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.5)  // 增加环境光
    scene.add(ambientLight)
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 3.5)  // 增强方向光
    directionalLight.position.set(10, 10, 5)
    directionalLight.castShadow = true
    scene.add(directionalLight)
    
    const pointLight1 = new THREE.PointLight(0xffffff, 2.0, 100)  // 增强点光源
    pointLight1.position.set(-10, 10, 10)
    scene.add(pointLight1)
    
    const pointLight2 = new THREE.PointLight(0xffffff, 2.0, 100)  // 增强点光源
    pointLight2.position.set(10, -5, 10)
    scene.add(pointLight2)
    
    const pointLight3 = new THREE.PointLight(0xffffff, 1.8, 100)  // 增强顶部光源
    pointLight3.position.set(0, 15, 0)
    scene.add(pointLight3)
    
    // 设置相机位置 - 更近一些让模型看起来更大
    camera.position.set(0, 1, 5)
    camera.lookAt(0, 0, 0)
    
    // 添加轨道控制器，允许用户交互
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true // 启用阻尼效果，让交互更平滑
    controls.dampingFactor = 0.05 // 阻尼系数
    controls.screenSpacePanning = false // 禁用屏幕空间平移
    
    // 设置缩放限制
    controls.minDistance = 2 // 最小距离 - 可以拉得很近
    controls.maxDistance = 20 // 最大距离 - 可以拉得很远
    
    // 设置垂直旋转限制
    controls.maxPolarAngle = Math.PI // 允许完全垂直旋转
    
    // 启用自动旋转（可选）
    controls.autoRotate = false // 设为true可以自动旋转
    controls.autoRotateSpeed = 2.0
    
    let model: THREE.Group | null = null
    
    // 加载GLB模型
    const loader = new GLTFLoader()
    loader.load(
      modelPath,
      (gltf) => {
        console.log('GLB model loaded successfully')
        model = gltf.scene
        
        // 调整模型大小和位置
        const box = new THREE.Box3().setFromObject(model)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        
        // 居中模型
        model.position.sub(center)
        
        // 缩放模型以适应视图 - 放大一些
        const maxDim = Math.max(size.x, size.y, size.z)
        const scale = 5 / maxDim  // 从3改为5，放大模型
        model.scale.setScalar(scale)
        
        // 设置材质效果 - 更亮的黑色主题
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true
            child.receiveShadow = true
            
            // 为模型设置更亮的黑色主题材质
            if (child.material) {
              const material = child.material as THREE.MeshStandardMaterial
              material.emissive = new THREE.Color(0x000000)  // 黑色，无发光
              material.emissiveIntensity = 0.0  // 无发光强度
              material.metalness = 0.9  // 更高的金属感，增加反射
              material.roughness = 0.1  // 更低的粗糙度，更多反射
              // 调整基础颜色 - 不要太暗
              if (material.color) {
                material.color.multiplyScalar(0.5)  // 从0.3提高到0.5，让颜色稍微亮一些
              }
            }
          }
        })
        
        scene.add(model)
      },
      (progress) => {
        console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%')
      },
      (error) => {
        console.error('Error loading GLB model:', error)
        
        // 如果模型加载失败，显示占位符
        const geometry = new THREE.ConeGeometry(1, 3, 8)
        const material = new THREE.MeshPhongMaterial({ 
          color: 0x00ffff,
          transparent: true,
          opacity: 0.8,
          emissive: 0x004444
        })
        const fallback = new THREE.Mesh(geometry, material)
        fallback.position.y = 1
        scene.add(fallback)
        model = new THREE.Group()
        model.add(fallback)
      }
    )
    
    // 动画循环
    const animate = () => {
      requestAnimationFrame(animate)
      
      // 更新控制器（必须在每帧调用）
      controls.update()
      
      // 可选：如果没有用户交互，可以让模型缓慢自动旋转
      if (!controls.autoRotate && model) {
        model.rotation.y += 0.005 // 减慢自动旋转速度
      }
      
      renderer.render(scene, camera)
    }
    
    animate()
    
    // 清理函数
    return () => {
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement)
      }
      controls.dispose() // 清理控制器
      renderer.dispose()
    }
  }, [isVisible, modelPath])

  if (!isVisible) {
    console.log('3D Model Viewer not visible')
    return null
  }

  console.log('Rendering 3D Model Viewer')

  return (
    <div className="model-3d-container" onClick={(e) => e.stopPropagation()}>
      <button className="close-button" onClick={onClose}>
        ×
      </button>
      <div className="model-3d-scene" ref={containerRef}>
        {/* Three.js canvas will be inserted here */}
      </div>
      <div className="model-3d-text">
        <div className="model-title">OVERFLOW SERAPH</div>
        <div className="model-subtitle">3D HOLOGRAM ACTIVATED</div>
      </div>
    </div>
  )
}

export default Model3DViewer