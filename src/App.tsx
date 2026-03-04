import { useState, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useGLTF, Stage } from "@react-three/drei";
import { Mesh, Object3D, MeshStandardMaterial } from "three";
import "./App.css";

// --- INTERFACES Y TIPOS ---
type Finish = "matte" | "glossy" | "metallic";

interface PartConfig {
  color: string;
  finish: Finish;
}

interface Config {
  model: string;
  parts: Record<string, PartConfig>;
}

interface ModelPart {
  name: string;
  color: string;
}

// --- COMPONENTE MODELO ---
function Model({
  onPartClick,
  config,
}: {
  onPartClick: (name: string) => void;
  config: Config;
}) {
  // Asegúrate de que la ruta al GLB sea correcta en tu carpeta /public
  const { scene } = useGLTF("/models/controller.glb");
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (!scene || hasProcessed.current) return;

    const partsData: ModelPart[] = [];

    scene.traverse((child: Object3D) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;

        // Forzamos un nombre si no tiene
        if (!mesh.name)
          mesh.name = `part_${Math.random().toString(36).substring(2, 5)}`;

        // Clonamos materiales para que el cambio de color sea individual por pieza
        if (mesh.material) {
          mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map((m) => m.clone())
            : mesh.material.clone();
        }

        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        let detectedColor = "#cccccc";

        materials.forEach((mat) => {
          if (mat instanceof MeshStandardMaterial) {
            detectedColor =
              "#" + mat.color.getHex().toString(16).padStart(6, "0");
          } else if ((mat as any).color) {
            // Caso para materiales que no sean Standard pero tengan propiedad color
            detectedColor =
              "#" + (mat as any).color.getHex().toString(16).padStart(6, "0");
          }
        });

        partsData.push({ name: mesh.name, color: detectedColor });
      }
    });

    // Despachamos el evento con el tipo ModelPart[]
    window.dispatchEvent(
      new CustomEvent<ModelPart[]>("modelPartsLoaded", { detail: partsData }),
    );
    hasProcessed.current = true;
  }, [scene]);

  // Aplicar cambios de la configuración (Color y Acabado)
  useEffect(() => {
    scene.traverse((child: Object3D) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        const partConfig = config.parts[mesh.name];

        if (partConfig) {
          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          materials.forEach((mat) => {
            if (mat instanceof MeshStandardMaterial) {
              mat.color.set(partConfig.color);

              // Lógica de materiales según acabado
              switch (partConfig.finish) {
                case "matte":
                  mat.roughness = 1;
                  mat.metalness = 0;
                  break;
                case "glossy":
                  mat.roughness = 0.1;
                  mat.metalness = 0.1;
                  break;
                case "metallic":
                  mat.roughness = 0.2;
                  mat.metalness = 0.9;
                  break;
              }
              mat.needsUpdate = true;
            }
          });
        }
      }
    });
  }, [config, scene]);

  return (
    <primitive
      object={scene}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onPartClick(e.object.name);
      }}
    />
  );
}

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [parts, setParts] = useState<ModelPart[]>([]);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);

    // Limpiamos el evento al desmontar el componente
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [config, setConfig] = useState<Config>({
    model: "controller.glb",
    parts: {},
  });
  const [outputJson, setOutputJson] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const handlePartsLoaded = (event: Event) => {
      // Tipamos el evento correctamente para evitar el error de 'any'
      const customEvent = event as CustomEvent<ModelPart[]>;
      const partsInfo = customEvent.detail;

      setParts(partsInfo);

      const initialPartsConfig: Record<string, PartConfig> = {};
      partsInfo.forEach((p: ModelPart) => {
        initialPartsConfig[p.name] = { color: p.color, finish: "matte" };
      });

      setConfig((prev) => ({ ...prev, parts: initialPartsConfig }));
      if (partsInfo.length > 0) setSelectedPart(partsInfo[0].name);
    };

    window.addEventListener("modelPartsLoaded", handlePartsLoaded);
    return () =>
      window.removeEventListener("modelPartsLoaded", handlePartsLoaded);
  }, []);

  const updatePartConfig = (partName: string, updates: Partial<PartConfig>) => {
    setConfig((prev) => ({
      ...prev,
      parts: {
        ...prev.parts,
        [partName]: { ...prev.parts[partName], ...updates },
      },
    }));
  };

  const exportJson = () => {
    setOutputJson(JSON.stringify(config, null, 2));
  };

  return (
    <div
      id="app"
      style={{
        display: "flex",
        height: "100vh",
        background: "#0b1020",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      {/* PANEL LATERAL */}
      <aside
        className="panel"
        style={{
          width: "320px",
          padding: "20px",
          background: "#0f172a",
          borderRight: "1px solid #1e293b",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <div className="brand">
          <h2 style={{ margin: 0, color: "#3b82f6" }}>Config 3D</h2>
          <span style={{ fontSize: "12px", opacity: 0.6 }}>
            Customizer Studio v1.0
          </span>
        </div>

        <div className="card">
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: "bold",
            }}
          >
            Pieza Seleccionada
          </label>
          {/* SELECT CON ESTILOS PARA EVITAR FONDO BLANCO */}
          <select
            style={{
              width: "100%",
              padding: "10px",
              background: "#1e293b",
              color: "white",
              border: "1px solid #334155",
              borderRadius: "6px",
              outline: "none",
            }}
            value={selectedPart || ""}
            onChange={(e) => setSelectedPart(e.target.value)}
          >
            {parts.map((p) => (
              <option
                key={p.name}
                value={p.name}
                style={{ background: "#1e293b" }}
              >
                {p.name}
              </option>
            ))}
          </select>

          {selectedPart && (
            <div
              style={{
                marginTop: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "15px",
              }}
            >
              <div>
                <span
                  style={{
                    display: "block",
                    fontSize: "14px",
                    marginBottom: "5px",
                  }}
                >
                  Color
                </span>
                <input
                  type="color"
                  style={{
                    width: "100%",
                    height: "50px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    background: "none",
                  }}
                  value={config.parts[selectedPart]?.color || "#ffffff"}
                  onChange={(e) =>
                    updatePartConfig(selectedPart, { color: e.target.value })
                  }
                />
              </div>
              <div>
                <span
                  style={{
                    display: "block",
                    fontSize: "14px",
                    marginBottom: "5px",
                  }}
                >
                  Acabado
                </span>
                <select
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "#1e293b",
                    color: "white",
                    border: "1px solid #334155",
                    borderRadius: "6px",
                  }}
                  value={config.parts[selectedPart]?.finish || "matte"}
                  onChange={(e) =>
                    updatePartConfig(selectedPart, {
                      finish: e.target.value as Finish,
                    })
                  }
                >
                  <option value="matte">Mate</option>
                  <option value="glossy">Brillante</option>
                  <option value="metallic">Metálico</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="actions" style={{ marginTop: "auto" }}>
          <button
            onClick={exportJson}
            style={{
              width: "100%",
              padding: "12px",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Exportar Configuración
          </button>
          <textarea
            readOnly
            value={outputJson}
            placeholder="JSON..."
            style={{
              width: "100%",
              height: "120px",
              marginTop: "10px",
              background: "#020617",
              color: "#4ade80",
              border: "1px solid #1e293b",
              borderRadius: "4px",
              fontSize: "11px",
              padding: "10px",
              boxSizing: "border-box",
            }}
          />
        </div>
      </aside>

      {/* ÁREA DEL MODELO 3D */}
      <main style={{ flex: 1, position: "relative" }}>
        <Canvas
          ref={canvasRef}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          // Bajamos la posición en Z de 4 a 2.5 o 3 para que se vea más cerca (más grande)
          camera={{ position: [0, 0, 2.5], fov: 45 }}
        >
          <Stage
            environment="city"
            intensity={0.5}
            shadows={{ type: "contact", opacity: 0.8, blur: 2 }}
            adjustCamera={true} // Esto hace que Three.js re-encuadre el modelo al centro del espacio disponible
          >
            <Model config={config} onPartClick={setSelectedPart} />
          </Stage>
          <OrbitControls makeDefault />
        </Canvas>

        {/* Overlay informativo */}
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            // Si es móvil, se centra con left 50% y transform. Si no, se pega a la derecha.
            left: isMobile ? "43%" : "auto",
            right: isMobile ? "auto" : "20px",
            transform: isMobile ? "translateX(-50%)" : "none",

            background: "rgba(15, 23, 42, 0.8)",
            padding: "8px 15px",
            borderRadius: "30px",
            fontSize: "12px",
            border: "1px solid #334155",
            whiteSpace: "nowrap", // Evita que el texto se rompa en dos líneas
            zIndex: 10,
          }}
        >
          Pieza activa:{" "}
          <span style={{ color: "#3b82f6", fontWeight: "bold" }}>
            {selectedPart || "Ninguna"}
          </span>
        </div>
      </main>
    </div>
  );
}
