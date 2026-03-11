import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { GLView } from 'expo-gl';

type GlContext = WebGL2RenderingContext & { endFrameEXP: () => void };

/**
 * Escena nativa mínima: solo expo-gl + WebGL puro.
 * Sin three.js, sin document/window, sin loaders web.
 * Prueba que el pipeline GL funciona en Expo Native.
 */
export function AvatarNativeScene() {
  const onContextCreate = useCallback((gl: GlContext) => {
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;

    gl.viewport(0, 0, width, height);
    gl.clearColor(0.1, 0.14, 0.2, 1);

    function runClearOnly() {
      function render() {
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.endFrameEXP();
        requestAnimationFrame(render);
      }
      requestAnimationFrame(render);
    }

    // Shaders mínimos para un triángulo
    const vs = `#version 300 es
      in vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;
    const fs = `#version 300 es
      precision mediump float;
      out vec4 outColor;
      void main() {
        outColor = vec4(0.29, 0.62, 1.0, 1.0); // azul primario
      }
    `;

    const vShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vShader) return;
    gl.shaderSource(vShader, vs);
    gl.compileShader(vShader);
    if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
      console.warn('[AvatarNativeScene] VS compile:', gl.getShaderInfoLog(vShader));
      gl.deleteShader(vShader);
      runClearOnly();
      return;
    }

    const fShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fShader) return;
    gl.shaderSource(fShader, fs);
    gl.compileShader(fShader);
    if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
      console.warn('[AvatarNativeScene] FS compile:', gl.getShaderInfoLog(fShader));
      gl.deleteShader(vShader);
      gl.deleteShader(fShader);
      runClearOnly();
      return;
    }

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('[AvatarNativeScene] Program link:', gl.getProgramInfoLog(program));
      runClearOnly();
      return;
    }
    gl.useProgram(program);

    const positionLoc = gl.getAttribLocation(program, 'position');
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const vertices = new Float32Array([0, 0.5, -0.5, -0.5, 0.5, -0.5]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    function render() {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.endFrameEXP();
      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  }, []);

  return <GLView style={styles.glView} onContextCreate={onContextCreate} />;
}

const styles = StyleSheet.create({
  glView: {
    width: '100%',
    minHeight: 200,
  },
});
