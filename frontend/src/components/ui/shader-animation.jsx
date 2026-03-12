import { useEffect, useRef } from "react";

/**
 * Same shader as before but using raw WebGL instead of THREE.js.
 * Saves ~2MB of bundle size with identical visual output.
 */
export function ShaderAnimation() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return;

    // Shaders — identical to the original
    const vertSrc = `attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

    const fragSrc = `#define TWO_PI 6.2831853072
#define PI 3.14159265359
precision highp float;
uniform vec2 resolution;
uniform float time;
void main(void) {
  vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
  float t = time * 0.05;
  float lineWidth = 0.002;
  vec3 color = vec3(0.0);
  for(int i = 0; i < 5; i++){
    color.b += lineWidth * float(i*i) / abs(fract(t - 0.01 + float(i) * 0.01) * 5.0 - length(uv) + mod(uv.x + uv.y, 0.2));
  }
  for(int i = 0; i < 5; i++){
    color.g += lineWidth * float(i*i) * 0.5 / abs(fract(t - 0.005 + float(i) * 0.01) * 5.0 - length(uv) + mod(uv.x + uv.y, 0.2));
  }
  for(int i = 0; i < 5; i++){
    color.r += lineWidth * float(i*i) * 0.35 / abs(fract(t + float(i) * 0.01) * 5.0 - length(uv) + mod(uv.x + uv.y, 0.2));
  }
  color *= 0.6;
  gl_FragColor = vec4(color, 1.0);
}`;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vertSrc));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    // Full-screen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "time");
    const uRes = gl.getUniformLocation(prog, "resolution");

    let t = 1.0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    resize();
    window.addEventListener("resize", resize);

    const frame = () => {
      t += 0.05;
      gl.uniform1f(uTime, t);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        inset: 0,
        background: "#060810",
        overflow: "hidden",
      }}
    />
  );
}
