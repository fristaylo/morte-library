import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const GLASS_T = 2.6;
const INK_LEVEL = 27.5;
const MENISCUS = 1.3;
const PIVOT_Y = 17;
const REST_TILT = 10;
const K = 48 / 26;
const TAU = Math.PI * 2;
const REST_LIFT = -6;
const UP_LIFT = 20;
const RISE_MS = 400;
const FALL_MS = 300;
const INK_SURFACE = "#2f3d50";
const INK_DEEP = "#0c1016";
const JAR_N = 8;
const JAR_PHASE = Math.PI / 8;
const DISC_N = 48;
const JAR_STRIPS: number[][][] = [
    [
        [0, 0],
        [27, 0],
    ],
    [
        [27, 0],
        [31, 4],
    ],
    [
        [31, 4],
        [31, 39],
    ],
    [
        [31, 39],
        [21, 47],
    ],
    [
        [21, 47],
        [20, 54],
    ],
];

export function legacyLighting(sh: { fragmentShader: string }) {
    const chunk = THREE.ShaderChunk.lights_physical_pars_fragment
        .replace(" * material.multiScatteringCompensation", "")
        .replace(" * ( 1.0 - F )", "")
        .replace(" * ( 1.0 - singleScattering - multiScattering )", "")
        .split("0.5 / max( gv + gl, EPSILON )")
        .join("saturate( 0.5 / ( gv + gl ) )");
    sh.fragmentShader = sh.fragmentShader.replace(
        "#include <lights_physical_pars_fragment>",
        chunk,
    );
}

export interface Inkwell3D {
    group: THREE.Group;
    box: THREE.Box3;
    setHover(on: boolean): void;
    step(now: number): boolean;
    reset(): void;
    dispose(): void;
}

interface Tween {
    t0: number;
    from: number;
    to: number;
}

interface Ripple {
    t0: number;
    x: number;
    z: number;
    amp: number;
}

interface Slosh {
    t0: number;
    amp: number;
}

export function createInkwell(
    position: THREE.Vector3,
    reduceMotion: MediaQueryList,
    env: THREE.Texture,
): Inkwell3D {
    const U = {
        uMen: { value: MENISCUS },
        uSl: { value: 0 },
        uRl: { value: 26 },
        uRp: { value: new THREE.Vector4(0, 0, 9, 0) },
    };

    const glass = new THREE.MeshStandardMaterial({
        color: 0xd4e3f2,
        roughness: 0.04,
        metalness: 0,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        envMap: env,
        envMapIntensity: 0.6,
    });
    glass.customProgramCacheKey = () => "glass-cheap";
    glass.onBeforeCompile = (sh) => {
        legacyLighting(sh);
        sh.fragmentShader = sh.fragmentShader.replace(
            "#include <opaque_fragment>",
            FRESNEL,
        );
    };
    const inkWallMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.35,
        envMap: env,
        envMapIntensity: 0.12,
    });
    inkWallMat.onBeforeCompile = legacyLighting;
    const inkSurfMat = new THREE.MeshStandardMaterial({
        color: INK_SURFACE,
        roughness: 0.1,
        envMap: env,
        envMapIntensity: 0.45,
    });
    inkSurfMat.customProgramCacheKey = () => "ink-surface";
    inkSurfMat.onBeforeCompile = (sh) => {
        legacyLighting(sh);
        Object.assign(sh.uniforms, U);
        sh.vertexShader = sh.vertexShader
            .replace("#include <common>", INK_VS_PRE)
            .replace("#include <beginnormal_vertex>", INK_VS_NORMAL)
            .replace(
                "#include <begin_vertex>",
                "vec3 transformed = vec3(position.x, position.y + inkHt, position.z);",
            );
    };

    const group = new THREE.Group();
    group.position.copy(position);
    const jar = new THREE.Mesh(new THREE.BufferGeometry(), glass);
    const inkWall = new THREE.Mesh(new THREE.BufferGeometry(), inkWallMat);
    const inkSurf = new THREE.Mesh(new THREE.BufferGeometry(), inkSurfMat);
    const qp = new THREE.Group();
    jar.renderOrder = 2;
    inkWall.castShadow = true;
    jar.castShadow = true;
    qp.position.y = PIVOT_Y + REST_LIFT;
    qp.rotation.z = (-REST_TILT * Math.PI) / 180;
    group.add(jar, inkWall, inkSurf, qp);

    const rL = buildJar(jar, inkWall, inkSurf, inkSurfMat);
    U.uRl.value = rL;
    const quill = buildQuill(qp, env);

    const box = new THREE.Box3(
        new THREE.Vector3(-52, 0, -40),
        new THREE.Vector3(52, 235, 40),
    );

    let lift = REST_LIFT;
    let hover = false;
    let tw: Tween | null = null;
    let rip: Ripple | null = null;
    let slosh: Slosh | null = null;

    function setHover(on: boolean) {
        if (on === hover) return;
        hover = on;
        const to = on ? UP_LIFT : REST_LIFT;
        if (reduceMotion.matches) {
            lift = to;
            return;
        }
        tw = { t0: performance.now(), from: lift, to };
    }

    function step(now: number): boolean {
        let busy = false;
        if (tw) {
            const prevY = tipAt(quill.tip, lift)[1];
            const up = tw.to > tw.from;
            const k = (now - tw.t0) / (up ? RISE_MS : FALL_MS);
            if (k >= 1) {
                lift = tw.to;
                tw = null;
            } else {
                const e = up ? 1 - (1 - k) * (1 - k) : k * k;
                lift = tw.from + (tw.to - tw.from) * e;
                busy = true;
            }
            const t = tipAt(quill.tip, lift);
            if (prevY < INK_LEVEL !== t[1] < INK_LEVEL) {
                if (Math.abs(t[0]) < rL) {
                    rip = { t0: now, x: t[0], z: t[2], amp: 0.9 };
                }
                slosh = { t0: now, amp: 1.1 };
            }
        }
        let ripple = [0, 0, 9, 0];
        let sl = 0;
        if (rip) {
            const age = (now - rip.t0) / 1000;
            if (age > 1.6) {
                rip = null;
            } else {
                ripple = [rip.x, rip.z, age, rip.amp * Math.exp(-1.8 * age)];
                busy = true;
            }
        }
        if (slosh) {
            const age = (now - slosh.t0) / 1000;
            if (age > 1.4) {
                slosh = null;
            } else {
                sl = slosh.amp * Math.exp(-2.4 * age) * Math.sin(age * 11);
                busy = true;
            }
        }
        qp.position.y = PIVOT_Y + lift;
        U.uRp.value.set(ripple[0], ripple[1], ripple[2], ripple[3]);
        U.uSl.value = sl;
        return busy;
    }

    function reset() {
        tw = null;
        rip = null;
        slosh = null;
        lift = hover ? UP_LIFT : REST_LIFT;
        step(performance.now());
    }

    function dispose() {
        group.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            o.geometry.dispose();
            (o.material as THREE.Material).dispose();
        });
    }

    return { group, box, setHover, step, reset, dispose };
}

function buildJar(
    jar: THREE.Mesh,
    inkWall: THREE.Mesh,
    inkSurf: THREE.Mesh,
    inkSurfMat: THREE.MeshStandardMaterial,
): number {
    const t = GLASS_T;
    const inner = JAR_STRIPS.map((s) =>
        s.map(([r, y]) => [Math.max(0, r - t), y === 0 ? t : y, 0]),
    );
    const strip = (pts: number[][]) => {
        const g = sweep(pts, JAR_N, () => 1, JAR_PHASE).toNonIndexed();
        g.computeVertexNormals();
        return g;
    };
    const lastOut = JAR_STRIPS[JAR_STRIPS.length - 1];
    const lastIn = inner[inner.length - 1];
    const parts = JAR_STRIPS.map(strip);
    parts.push(strip([lastOut[lastOut.length - 1], lastIn[lastIn.length - 1]]));
    for (let k = inner.length - 1; k >= 0; k--) {
        parts.push(strip(inner[k].slice().reverse()));
    }
    swapGeometry(jar, mergeGeometries(parts));
    for (const g of parts) g.dispose();

    const topY = INK_LEVEL + MENISCUS;
    const shrink = inner.map((s) =>
        s.map(([r, y, c]) => [
            Math.max(0, r - 0.25),
            y <= t + 0.01 ? y + 0.25 : y,
            c,
        ]),
    );
    const wall = clipStrips(shrink, topY);
    const rim = wall[wall.length - 1][wall[wall.length - 1].length - 1];
    const rL = rim[0];
    const wallParts = wall.map(strip);
    swapGeometry(inkWall, mergeGeometries(wallParts));
    for (const g of wallParts) g.dispose();

    const RINGS = 14;
    const discPts = Array.from({ length: RINGS + 1 }, (_, j) => [
        rL * (1 - j / RINGS),
        INK_LEVEL,
    ]);
    const disc = sweep(discPts, DISC_N, octagon, 0);
    disc.computeVertexNormals();
    const rho = new Float32Array(disc.attributes.position.count);
    for (let k = 0; k < rho.length; k++) {
        rho[k] = 1 - Math.floor(k / DISC_N) / RINGS;
    }
    disc.setAttribute("aRho", new THREE.BufferAttribute(rho, 1));
    swapGeometry(inkSurf, disc);

    const surf = new THREE.Color(INK_SURFACE);
    const deep = new THREE.Color(INK_DEEP);
    const pos = inkWall.geometry.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        const k = THREE.MathUtils.smoothstep(
            pos.getY(i),
            4,
            INK_LEVEL + MENISCUS,
        );
        c.copy(deep).lerp(surf, k);
        col.set([c.r, c.g, c.b], i * 3);
    }
    inkWall.geometry.setAttribute("color", new THREE.BufferAttribute(col, 3));
    inkSurfMat.color.copy(surf);
    return rL;
}

function buildQuill(qp: THREE.Group, env: THREE.Texture): { tip: number[] } {
    const mat = (color: string) => {
        const m = new THREE.MeshStandardMaterial({
            color,
            roughness: 0.6,
            envMap: env,
            envMapIntensity: 0.5,
        });
        m.onBeforeCompile = legacyLighting;
        return m;
    };
    const path = new THREE.CurvePath<THREE.Vector3>();
    path.add(
        bezier3(
            [
                [22.5, 5],
                [22.5, 5],
                [6, 22],
                [4, 52],
            ],
            0.9,
        ),
    );
    path.add(
        bezier3(
            [
                [4, 52],
                [3, 69],
                [6, 81],
                [9.5, 89],
            ],
            0.9,
        ),
    );
    const meshes: THREE.Mesh[] = [
        new THREE.Mesh(
            new THREE.TubeGeometry(path, 60, 1.85, 6),
            mat("#4b5870"),
        ),
    ];
    const vanes: [number[], string][] = [
        [
            [21.5, 8, 13, 16, 6, 30, 4, 48, 11.5, 42, 18, 27, 21.5, 13],
            "#8fa6bd",
        ],
        [[19, 24, 11, 32, 5.5, 45, 3.5, 60, 11, 54, 16, 41, 19, 29], "#a8bacc"],
        [
            [16, 39, 9, 47, 4.5, 58, 3.5, 71, 9.5, 65, 13.5, 54, 16, 43],
            "#c6d3e1",
        ],
    ];
    vanes.forEach(([n, color], i) => {
        meshes.push(extrude(vaneShape(n), i * 0.9, mat(color)));
    });
    meshes.push(nibMesh(0.4, env));
    for (const m of meshes) {
        m.castShadow = true;
        qp.add(m);
    }
    return { tip: [...pp(12.4, 96.4), 0.5] };
}

function nibMesh(z: number, env: THREE.Texture): THREE.Mesh {
    const s = new THREE.Shape();
    s.moveTo(...pp(8.5, 89.4));
    s.bezierCurveTo(...pp(9.2, 88.4), ...pp(10, 88.2), ...pp(10.6, 88.6));
    s.lineTo(...pp(12.4, 96.4));
    s.closePath();
    const m = new THREE.MeshStandardMaterial({
        color: "#2f3a52",
        roughness: 0.4,
        metalness: 0.3,
        envMap: env,
    });
    m.onBeforeCompile = legacyLighting;
    return extrude(s, z, m);
}

function vaneShape(n: number[]): THREE.Shape {
    const s = new THREE.Shape();
    s.moveTo(...pp(n[0], n[1]));
    for (const k of [2, 8]) {
        s.bezierCurveTo(
            ...pp(n[k], n[k + 1]),
            ...pp(n[k + 2], n[k + 3]),
            ...pp(n[k + 4], n[k + 5]),
        );
    }
    s.closePath();
    return s;
}

function extrude(
    shape: THREE.Shape,
    z: number,
    material: THREE.Material,
): THREE.Mesh {
    const g = new THREE.ExtrudeGeometry(shape, {
        depth: 0.8,
        bevelEnabled: false,
        curveSegments: 14,
    });
    g.translate(0, 0, z - 0.4);
    return new THREE.Mesh(g, material);
}

function bezier3(q: number[][], z: number): THREE.CubicBezierCurve3 {
    const [a, b, c, d] = q.map(([x, y]) => new THREE.Vector3(...pp(x, y), z));
    return new THREE.CubicBezierCurve3(a, b, c, d);
}

function tipAt(tip: number[], lift: number): number[] {
    const th = (REST_TILT * Math.PI) / 180;
    const [tx, ty, tz] = tip;
    return [
        tx * Math.cos(th) + ty * Math.sin(th),
        -tx * Math.sin(th) + ty * Math.cos(th) + PIVOT_Y + lift,
        tz,
    ];
}

function octagon(t: number): number {
    const a = Math.PI / 4;
    const m = ((((t + Math.PI / 8) % a) + a) % a) - Math.PI / 8;
    return Math.cos(Math.PI / 8) / Math.cos(m);
}

function sweep(
    pts: number[][],
    N: number,
    shape: (t: number) => number,
    phase: number,
): THREE.BufferGeometry {
    return grid(N, pts.length - 1, (i, j) => {
        const [r, y] = pts[j];
        const th = phase + (i / N) * TAU;
        const s = r * shape(th);
        return [s * Math.cos(th), y, s * Math.sin(th)];
    });
}

function grid(
    nu: number,
    nv: number,
    fn: (i: number, j: number) => number[],
): THREE.BufferGeometry {
    const cols = nu;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j <= nv; j++) {
        for (let i = 0; i < cols; i++) {
            pos.push(...fn(i, j));
            uv.push(i / nu, j / nv);
        }
    }
    for (let j = 0; j < nv; j++) {
        for (let i = 0; i < nu; i++) {
            const a = j * cols + i;
            const b = j * cols + ((i + 1) % cols);
            const c = (j + 1) * cols + i;
            const d = (j + 1) * cols + ((i + 1) % cols);
            idx.push(a, c, b, b, c, d);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
}

function clipStrips(strips: number[][][], yMax: number): number[][][] {
    const out: number[][][] = [];
    for (const s of strips) {
        if (s[0][1] > yMax) break;
        const k = s.findIndex((p) => p[1] > yMax);
        if (k < 0) {
            out.push(s);
            continue;
        }
        const a = s[k - 1];
        const b = s[k];
        const f = (yMax - a[1]) / (b[1] - a[1]);
        out.push([...s.slice(0, k), a.map((v, i) => v + (b[i] - v) * f)]);
        break;
    }
    return out;
}

function swapGeometry(mesh: THREE.Mesh, geo: THREE.BufferGeometry) {
    mesh.geometry.dispose();
    mesh.geometry = geo;
}

function pp(x: number, y: number): [number, number] {
    return [(x - 13) * K, (100 - y) * K];
}

const FRESNEL = `
vec3 specOnly = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
vec3 bodyRgb = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
float fr = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);
float ga = clamp(diffuseColor.a + fr * 0.6, 0.0, 1.0);
gl_FragColor = vec4(bodyRgb * 0.25 + specOnly / max(ga, 0.08), ga);
`;

const INK_VS_PRE = `
#include <common>
uniform float uMen;
uniform float uSl;
uniform float uRl;
uniform vec4 uRp;
attribute float aRho;
float inkField(vec2 q, float rho) {
  float h = uMen * pow(clamp(rho, 0.0, 1.0), 6.0);
  h += uSl * (q.x * 0.8 + q.y * 0.6) / uRl;
  float f = length(q - uRp.xy) - 45.0 * uRp.z;
  h += uRp.w * cos(f * 0.5) * exp(-f * f / 50.0) * (1.0 - smoothstep(0.75, 1.0, rho));
  return h;
}
`;

const INK_VS_NORMAL = `
vec2 q0 = position.xz;
float rs = aRho / max(length(q0), 0.001);
float inkHt = inkField(q0, aRho);
float hx = inkField(q0 + vec2(0.8, 0.0), length(q0 + vec2(0.8, 0.0)) * rs);
float hz = inkField(q0 + vec2(0.0, 0.8), length(q0 + vec2(0.0, 0.8)) * rs);
vec3 objectNormal = normalize(vec3(-(hx - inkHt) / 0.8, 1.0, -(hz - inkHt) / 0.8));
#ifdef USE_TANGENT
vec3 objectTangent = vec3(tangent.xyz);
#endif
`;
