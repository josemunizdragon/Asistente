import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import {
  FilamentScene,
  FilamentView,
  Model,
  Camera,
  Animator,
  Light,
} from 'react-native-filament';
import type { AnimationItem } from 'react-native-filament';
import type { AvatarSource } from '../types/avatar';

// =============================================================================
// ORIENTACIÓN BASE — Frente visible confirmado: front_neg_z ([0,0,-1]).
// Con rotation Y = 0 el avatar muestra la cara que ilumina front_neg_z = frente a cámara.
// Espalda = viewRotationYRad = Math.PI.
// =============================================================================
const MODEL_FACING_ROTATION_Y = 0; // radianes; 0 = frente mirando a cámara, coherente con front_neg_z.

// =============================================================================
// PRESETS DE LUZ — Sin EnvironmentLight. Direcciones en espacio mundo.
// =============================================================================

type LightDef = {
  direction: [number, number, number];
  intensity: number;
  castShadows: boolean;
};

export type LightPresetName =
  | 'best_visible'       // default: basado en front_neg_z (Z negativo = frente visible)
  | 'front_soft'
  | 'front_strong'
  | 'three_point'
  | 'top_fill'
  | 'sides_only'
  | 'no_lights'
  // Light direction debug mode (una luz, direcciones cardinales)
  | 'front_pos_z'
  | 'front_neg_z'
  | 'front_pos_x'
  | 'front_neg_x'
  | 'top_down'
  | 'back_pos_z'
  | 'back_neg_z'
  // Intensidad sola (misma dirección, niveles)
  | 'debug_single_light_low'
  | 'debug_single_light_mid'
  | 'debug_single_light_high';

const CARDINAL_INTENSITY = 60_000;
const DEBUG_LOW = 20_000;
const DEBUG_MID = 55_000;
const DEBUG_HIGH = 100_000;

const ALL_PRESETS: Record<LightPresetName, LightDef[]> = {
  // Basado en front_neg_z: main desde -Z (frente visible), fill arriba-frontal, rim lateral suave.
  best_visible: [
    { direction: [0, 0, -1], intensity: 60_000, castShadows: true },
    { direction: [0, -0.6, -0.8], intensity: 22_000, castShadows: false },
    { direction: [0.8, 0, -0.2], intensity: 8_000, castShadows: false },
  ],
  front_soft: [
    { direction: [0, 0, 1], intensity: 60_000, castShadows: true },
    { direction: [0, -0.5, 0.9], intensity: 25_000, castShadows: false },
    { direction: [0.7, 0, 0.6], intensity: 12_000, castShadows: false },
  ],
  front_strong: [
    { direction: [0, 0, 1], intensity: 120_000, castShadows: true },
    { direction: [0, -0.5, 0.9], intensity: 50_000, castShadows: false },
    { direction: [0.7, 0, 0.6], intensity: 25_000, castShadows: false },
  ],
  three_point: [
    { direction: [0, 0, 1], intensity: 80_000, castShadows: true },
    { direction: [0.5, -0.5, 0.7], intensity: 30_000, castShadows: false },
    { direction: [0, 0.2, -0.95], intensity: 20_000, castShadows: false },
  ],
  top_fill: [
    { direction: [0, -1, 0.3], intensity: 70_000, castShadows: true },
    { direction: [0, 0, 1], intensity: 35_000, castShadows: false },
  ],
  sides_only: [
    { direction: [1, 0, 0.5], intensity: 40_000, castShadows: false },
    { direction: [-1, 0, 0.5], intensity: 40_000, castShadows: false },
  ],
  no_lights: [],
  // Cardinales: una sola luz por preset.
  front_pos_z: [{ direction: [0, 0, 1], intensity: CARDINAL_INTENSITY, castShadows: false }],
  front_neg_z: [{ direction: [0, 0, -1], intensity: CARDINAL_INTENSITY, castShadows: false }],
  front_pos_x: [{ direction: [1, 0, 0], intensity: CARDINAL_INTENSITY, castShadows: false }],
  front_neg_x: [{ direction: [-1, 0, 0], intensity: CARDINAL_INTENSITY, castShadows: false }],
  top_down: [{ direction: [0, -1, 0], intensity: CARDINAL_INTENSITY, castShadows: false }],
  back_pos_z: [{ direction: [0, 0, -1], intensity: CARDINAL_INTENSITY, castShadows: false }],
  back_neg_z: [{ direction: [0, 0, 1], intensity: CARDINAL_INTENSITY, castShadows: false }],
  // Debug intensidad (misma dirección que best_visible main = front_neg_z).
  debug_single_light_low: [{ direction: [0, 0, -1], intensity: DEBUG_LOW, castShadows: false }],
  debug_single_light_mid: [{ direction: [0, 0, -1], intensity: DEBUG_MID, castShadows: false }],
  debug_single_light_high: [{ direction: [0, 0, -1], intensity: DEBUG_HIGH, castShadows: false }],
};

const DEFAULT_PRESET: LightPresetName = 'debug_single_light_high'; // Intensity High + frente = Usar FrontNegZ
const FALLBACK_PRESET: LightPresetName = 'debug_single_light_high';

const AUTO_DIAG_PRESETS: LightPresetName[] = [
  'front_pos_z',
  'front_neg_z',
  'front_pos_x',
  'front_neg_x',
  'top_down',
];
// Todos los estados (presets) para ciclo completo tipo AutoDiag.
const AUTO_DIAG_ALL_PRESETS: LightPresetName[] = [
  'best_visible',
  'front_neg_z',
  'debug_single_light_high', // mejor vista: front_neg_z + intensity high
  'debug_single_light_mid',
  'debug_single_light_low',
  'front_pos_z',
  'front_pos_x',
  'front_neg_x',
  'top_down',
  'back_pos_z',
  'back_neg_z',
  'front_soft',
  'front_strong',
  'three_point',
  'top_fill',
  'sides_only',
  'no_lights',
];
const AUTO_DIAG_INTERVAL_MS = 1200;
const BEST_VIEW_PRESET: LightPresetName = 'debug_single_light_high'; // front_neg_z + intensity high

// Cámara y encuadre — más aire, cuerpo completo, cabeza sin cortar.
const CAMERA_NEAR = 0.05;
const CAMERA_FAR = 100;
const CAMERA_BASE_POSITION: [number, number, number] = [0, 0.18, 8];
const CAMERA_TARGET: [number, number, number] = [0, 0.04, 0];
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.4;
const ZOOM_DEFAULT = 0.95;
const ZOOM_STEP = 0.1;
const MODEL_SCALE: [number, number, number] = [0.56, 0.56, 0.56];

const DIAG_BG = '#14141e';
const DIAG_TEXT = '#9090a0';
const DIAG_BUTTON = '#222236';
const DIAG_BUTTON_ACTIVE = '#323252';
const DIAG_OPACITY = 0.88;

const ENABLE_AVATAR_ANIMATION = true;
const IDLE_PATTERN = /idle/i;

export type AvatarStateType = 'idle' | 'wave' | 'talk' | 'thinking';

export type AnimationIndicesByState = {
  idle: number;
  wave?: number;
  talk?: number;
  thinking?: number;
};

function safeFindIdleIndex(list: AnimationItem[]): number {
  if (!Array.isArray(list) || list.length === 0) return -1;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a != null && typeof a.name === 'string' && IDLE_PATTERN.test(a.name)) {
      return i;
    }
  }
  return -1;
}

function buildIndicesByState(list: AnimationItem[]): AnimationIndicesByState {
  const getIndex = (pattern: RegExp) => {
    const i = list.findIndex((a) => a != null && typeof a.name === 'string' && pattern.test(a.name));
    return i >= 0 ? i : undefined;
  };
  return {
    idle: getIndex(IDLE_PATTERN) ?? 0,
    wave: getIndex(/wave/i),
    talk: getIndex(/talk/i),
    thinking: getIndex(/thinking/i),
  };
}

type Props = { source: AvatarSource; style?: object; suggestedAnimation?: string };

const LOG_KEY = '[AvatarFilamentScene]';

function logPresetFull(
  preset: LightPresetName,
  cameraPosition: [number, number, number],
  modelFacingRotationY: number,
  effectiveRotationY: number
) {
  try {
    const lights = ALL_PRESETS[preset] ?? [];
    console.log(
      LOG_KEY,
      'preset=' + preset +
      ' modelFacingRotationY=' + modelFacingRotationY.toFixed(3) +
      ' effectiveRotationY=' + effectiveRotationY.toFixed(3) +
      ' cam=' + JSON.stringify(cameraPosition) +
      ' target=' + JSON.stringify(CAMERA_TARGET)
    );
    lights.forEach((l, i) => {
      console.log(LOG_KEY, 'light' + (i + 1) + ' dir=' + JSON.stringify(l.direction) + ' intensity=' + l.intensity);
    });
    if (lights.length === 0) console.log(LOG_KEY, 'no lights');
  } catch (e) {
    console.warn(LOG_KEY, 'logPresetFull', e);
  }
}

// Mapeo backend suggestedAnimation -> nombre de animación en el GLB (fallback: idle).
function mapSuggestedToAnimationName(suggested: string): string {
  const s = (suggested ?? '').toLowerCase().trim();
  if (/idle/i.test(s)) return 'idle';
  if (/walk/i.test(s)) return 'walk';
  if (/jump/i.test(s)) return 'jump';
  if (/wave/i.test(s)) return 'wave';
  if (/yes/i.test(s)) return 'yes';
  if (/no\b/i.test(s)) return 'no';
  if (/thumbs/i.test(s)) return 'thumbsUp';
  if (/celebrate/i.test(s)) return 'celebrate';
  return 'idle';
}

function findAnimationIndexByName(list: AnimationItem[], name: string): number {
  if (!Array.isArray(list) || list.length === 0) return -1;
  const target = name.toLowerCase();
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    const animName = (a != null && typeof (a as { name?: string }).name === 'string')
      ? (a as { name: string }).name
      : '';
    if (animName.toLowerCase().includes(target) || target.includes(animName.toLowerCase())) {
      const idx = typeof (a as { index?: number }).index === 'number' ? (a as { index: number }).index : i;
      return idx >= 0 ? idx : i;
    }
  }
  return -1;
}

export function AvatarFilamentScene({ source, style, suggestedAnimation }: Props) {
  const isMounted = useRef(true);
  const presetLogRef = useRef<string | null>(null);
  const autoDiagIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoDiagAllIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [availableAnimations, setAvailableAnimations] = useState<AnimationItem[]>([]);
  const [selectedAnimationIndex, setSelectedAnimationIndex] = useState<number>(-1);
  const [selectedAnimationName, setSelectedAnimationName] = useState<string>('');
  const [hasNoAnimations, setHasNoAnimations] = useState(false);
  const [idleActivationFailed, setIdleActivationFailed] = useState(false);
  const [animationLoadError, setAnimationLoadError] = useState<string | null>(null);
  const [indicesByState, setIndicesByState] = useState<AnimationIndicesByState>({ idle: 0 });
  const [animationsUnknown, setAnimationsUnknown] = useState(true);

  const [lightPreset, setLightPreset] = useState<LightPresetName>(DEFAULT_PRESET);
  const [showDebugPanel, setShowDebugPanel] = useState(true);
  const [viewRotationYRad, setViewRotationYRad] = useState(0); // 0 = frente, PI = espalda
  const [zoomFactor, setZoomFactor] = useState(ZOOM_DEFAULT);
  const [autoDiagRunning, setAutoDiagRunning] = useState(false);
  const [autoDiagAllRunning, setAutoDiagAllRunning] = useState(false);

  const effectiveRotationY = MODEL_FACING_ROTATION_Y + viewRotationYRad;
  const cameraPosition: [number, number, number] = [
    CAMERA_BASE_POSITION[0],
    CAMERA_BASE_POSITION[1],
    CAMERA_BASE_POSITION[2] * zoomFactor,
  ];

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (autoDiagIntervalRef.current) {
        clearInterval(autoDiagIntervalRef.current);
        autoDiagIntervalRef.current = null;
      }
      if (autoDiagAllIntervalRef.current) {
        clearInterval(autoDiagAllIntervalRef.current);
        autoDiagAllIntervalRef.current = null;
      }
    };
  }, []);

  // Log inicial al cargar la escena.
  const initLogDone = useRef(false);
  useEffect(() => {
    if (initLogDone.current) return;
    initLogDone.current = true;
    try {
      const preset = DEFAULT_PRESET;
      const lights = ALL_PRESETS[preset] ?? [];
      const camInit: [number, number, number] = [CAMERA_BASE_POSITION[0], CAMERA_BASE_POSITION[1], CAMERA_BASE_POSITION[2] * ZOOM_DEFAULT];
      console.log(LOG_KEY, 'init preset=' + preset + ' modelFacingRotationY=' + MODEL_FACING_ROTATION_Y.toFixed(3) + ' effectiveRotationY(0)=' + (MODEL_FACING_ROTATION_Y + 0).toFixed(3));
      lights.forEach((l, i) => {
        console.log(LOG_KEY, 'init light' + (i + 1) + ' dir=' + JSON.stringify(l.direction) + ' intensity=' + l.intensity);
      });
      console.log(LOG_KEY, 'init cam=' + JSON.stringify(camInit) + ' target=' + JSON.stringify(CAMERA_TARGET) + ' zoom=' + ZOOM_DEFAULT.toFixed(2) + ' scale=' + MODEL_SCALE[0]);
    } catch (e) {
      console.warn(LOG_KEY, 'init log', e);
    }
  }, []);

  useEffect(() => {
    const key = lightPreset + '_' + cameraPosition[2].toFixed(2) + '_' + effectiveRotationY.toFixed(3);
    if (presetLogRef.current === key) return;
    presetLogRef.current = key;
    logPresetFull(lightPreset, cameraPosition, MODEL_FACING_ROTATION_Y, effectiveRotationY);
  }, [lightPreset, cameraPosition, effectiveRotationY]);

  const setAnimationByIndex = useCallback((index: number, name: string) => {
    try {
      if (index >= 0 && availableAnimations.length > 0) {
        setSelectedAnimationIndex(index);
        setSelectedAnimationName(name);
      }
    } catch (e) {
      console.warn(LOG_KEY, 'setAnimationByIndex', e);
    }
  }, [availableAnimations.length]);

  // Aplicar suggestedAnimation del backend (chat): mapear nombre -> índice; fallback idle.
  useEffect(() => {
    if (!ENABLE_AVATAR_ANIMATION || !suggestedAnimation || availableAnimations.length === 0) return;
    try {
      const name = mapSuggestedToAnimationName(suggestedAnimation);
      const idx = findAnimationIndexByName(availableAnimations, name);
      if (idx >= 0) {
        const anim = availableAnimations.find((a, i) => {
          const ai = (a as { index?: number }).index;
          return (typeof ai === 'number' ? ai : i) === idx;
        }) ?? availableAnimations[0];
        const label = (anim != null && typeof (anim as { name?: string }).name === 'string')
          ? (anim as { name: string }).name
          : name;
        setSelectedAnimationIndex(idx);
        setSelectedAnimationName(label);
      } else {
        const idleIdx = indicesByState.idle ?? 0;
        if (idleIdx >= 0 && idleIdx < availableAnimations.length) {
          setSelectedAnimationIndex(idleIdx);
          setSelectedAnimationName(availableAnimations[idleIdx] != null && typeof (availableAnimations[idleIdx] as { name?: string }).name === 'string'
            ? (availableAnimations[idleIdx] as { name: string }).name
            : 'idle');
        }
        console.warn(LOG_KEY, 'suggestedAnimation not found, using idle', suggestedAnimation, name);
      }
    } catch (e) {
      console.warn(LOG_KEY, 'suggestedAnimation effect', e);
    }
  }, [suggestedAnimation, availableAnimations, indicesByState.idle]);

  const setPresetSafe = useCallback((preset: LightPresetName) => {
    try {
      if (!ALL_PRESETS[preset]) {
        setLightPreset('front_neg_z');
        return;
      }
      setLightPreset(preset);
    } catch (e) {
      console.warn(LOG_KEY, 'setPreset fallback a front_neg_z', e);
      setLightPreset('front_neg_z');
    }
  }, []);

  // Mejor vista: front_neg_z + intensity high + Frente + zoom por defecto.
  const usarFrontNegZ = useCallback(() => {
    try {
      setLightPreset(BEST_VIEW_PRESET);
      setViewRotationYRad(0);
      setZoomFactor(ZOOM_DEFAULT);
    } catch (e) {
      console.warn(LOG_KEY, 'usarFrontNegZ', e);
      setLightPreset(BEST_VIEW_PRESET);
    }
  }, []);

  const toggleFrenteEspalda = useCallback(() => {
    try {
      setViewRotationYRad((prev) => (prev === 0 ? Math.PI : 0));
    } catch (e) {
      console.warn(LOG_KEY, 'toggleFrenteEspalda', e);
    }
  }, []);

  const zoomOut = useCallback(() => {
    try {
      setZoomFactor((prev) => Math.max(ZOOM_MIN, Number(prev) - ZOOM_STEP));
    } catch (e) {
      console.warn(LOG_KEY, 'zoomOut', e);
    }
  }, []);

  const zoomReset = useCallback(() => {
    try {
      setZoomFactor(ZOOM_DEFAULT);
    } catch (e) {
      console.warn(LOG_KEY, 'zoomReset', e);
    }
  }, []);

  const zoomIn = useCallback(() => {
    try {
      setZoomFactor((prev) => Math.min(ZOOM_MAX, Number(prev) + ZOOM_STEP));
    } catch (e) {
      console.warn(LOG_KEY, 'zoomIn', e);
    }
  }, []);

  const startAutoDiag = useCallback(() => {
    try {
      if (autoDiagAllIntervalRef.current) {
        clearInterval(autoDiagAllIntervalRef.current);
        autoDiagAllIntervalRef.current = null;
        setAutoDiagAllRunning(false);
      }
      if (autoDiagIntervalRef.current) {
        clearInterval(autoDiagIntervalRef.current);
        autoDiagIntervalRef.current = null;
      }
      setAutoDiagRunning(true);
      let idx = 0;
      setLightPreset(AUTO_DIAG_PRESETS[0]);
      autoDiagIntervalRef.current = setInterval(() => {
        if (!isMounted.current) return;
        idx = (idx + 1) % AUTO_DIAG_PRESETS.length;
        const next = AUTO_DIAG_PRESETS[idx];
        try {
          setLightPreset(next);
        } catch (e) {
          console.warn(LOG_KEY, 'AutoDiag setPreset', e);
          setLightPreset(BEST_VIEW_PRESET);
          if (autoDiagIntervalRef.current) {
            clearInterval(autoDiagIntervalRef.current);
            autoDiagIntervalRef.current = null;
          }
          setAutoDiagRunning(false);
        }
      }, AUTO_DIAG_INTERVAL_MS);
    } catch (e) {
      console.warn(LOG_KEY, 'startAutoDiag', e);
      setLightPreset(BEST_VIEW_PRESET);
      setAutoDiagRunning(false);
    }
  }, []);

  const stopAutoDiag = useCallback(() => {
    try {
      if (autoDiagIntervalRef.current) {
        clearInterval(autoDiagIntervalRef.current);
        autoDiagIntervalRef.current = null;
      }
      setAutoDiagRunning(false);
      setLightPreset(BEST_VIEW_PRESET);
    } catch (e) {
      console.warn(LOG_KEY, 'stopAutoDiag', e);
    }
  }, []);

  const startAutoDiagAll = useCallback(() => {
    try {
      if (autoDiagIntervalRef.current) {
        clearInterval(autoDiagIntervalRef.current);
        autoDiagIntervalRef.current = null;
        setAutoDiagRunning(false);
      }
      if (autoDiagAllIntervalRef.current) {
        clearInterval(autoDiagAllIntervalRef.current);
        autoDiagAllIntervalRef.current = null;
      }
      setAutoDiagAllRunning(true);
      let idx = 0;
      setLightPreset(AUTO_DIAG_ALL_PRESETS[0]);
      autoDiagAllIntervalRef.current = setInterval(() => {
        if (!isMounted.current) return;
        idx = (idx + 1) % AUTO_DIAG_ALL_PRESETS.length;
        const next = AUTO_DIAG_ALL_PRESETS[idx];
        try {
          setLightPreset(next);
        } catch (e) {
          console.warn(LOG_KEY, 'AutoDiagAll setPreset', e);
          setLightPreset(BEST_VIEW_PRESET);
          if (autoDiagAllIntervalRef.current) {
            clearInterval(autoDiagAllIntervalRef.current);
            autoDiagAllIntervalRef.current = null;
          }
          setAutoDiagAllRunning(false);
        }
      }, AUTO_DIAG_INTERVAL_MS);
    } catch (e) {
      console.warn(LOG_KEY, 'startAutoDiagAll', e);
      setLightPreset(BEST_VIEW_PRESET);
      setAutoDiagAllRunning(false);
    }
  }, []);

  const stopAutoDiagAll = useCallback(() => {
    try {
      if (autoDiagAllIntervalRef.current) {
        clearInterval(autoDiagAllIntervalRef.current);
        autoDiagAllIntervalRef.current = null;
      }
      setAutoDiagAllRunning(false);
      setLightPreset(BEST_VIEW_PRESET);
    } catch (e) {
      console.warn(LOG_KEY, 'stopAutoDiagAll', e);
    }
  }, []);

  const onAnimationsLoaded = useCallback((list: unknown) => {
    if (!ENABLE_AVATAR_ANIMATION) return;
    try {
      if (list == null || !Array.isArray(list)) {
        if (isMounted.current) {
          setHasNoAnimations(true);
          setAvailableAnimations([]);
          setSelectedAnimationIndex(-1);
          setSelectedAnimationName('');
          setAnimationsUnknown(false);
        }
        return;
      }
      if (list.length === 0) {
        if (isMounted.current) {
          setHasNoAnimations(true);
          setAvailableAnimations([]);
          setSelectedAnimationIndex(-1);
          setSelectedAnimationName('');
          setAnimationsUnknown(false);
        }
        return;
      }
      const safeList = list as AnimationItem[];
      if (!isMounted.current) return;
      setHasNoAnimations(false);
      setAvailableAnimations(safeList);
      setIndicesByState(buildIndicesByState(safeList));
      setAnimationsUnknown(false);
      const idleIndex = safeFindIdleIndex(safeList);
      if (idleIndex < 0) {
        if (isMounted.current) {
          setSelectedAnimationIndex(-1);
          setSelectedAnimationName('');
        }
        return;
      }
      const chosen = safeList[idleIndex];
      const animIndex = chosen != null && typeof chosen.index === 'number' && chosen.index >= 0 ? chosen.index : idleIndex;
      if (isMounted.current) {
        setSelectedAnimationIndex(animIndex);
        setSelectedAnimationName(chosen?.name ?? `index ${animIndex}`);
        setIdleActivationFailed(false);
        setAnimationLoadError(null);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isMounted.current) {
        setAnimationLoadError(msg);
        setIdleActivationFailed(true);
        setSelectedAnimationIndex(-1);
        setSelectedAnimationName('');
        setAnimationsUnknown(false);
      }
    }
  }, []);

  const safeToRenderAnimator =
    ENABLE_AVATAR_ANIMATION &&
    (animationsUnknown || selectedAnimationIndex >= 0) &&
    !idleActivationFailed &&
    animationLoadError == null &&
    (animationsUnknown || availableAnimations.length > 0);

  const renderModel = () => {
    if (safeToRenderAnimator) {
      try {
        const animIndex = selectedAnimationIndex >= 0 ? selectedAnimationIndex : 0;
        return (
          <Model source={source} rotate={[0, effectiveRotationY, 0]} scale={MODEL_SCALE}>
            <Animator animationIndex={animIndex} onAnimationsLoaded={onAnimationsLoaded} transitionDuration={0} />
          </Model>
        );
      } catch (e) {
        if (isMounted.current) {
          setIdleActivationFailed(true);
          setAnimationLoadError('Error al activar Animator');
        }
        return <Model source={source} rotate={[0, effectiveRotationY, 0]} scale={MODEL_SCALE} />;
      }
    }
    return <Model source={source} rotate={[0, effectiveRotationY, 0]} scale={MODEL_SCALE} />;
  };

  const renderLight = () => {
    try {
      const lights = ALL_PRESETS[lightPreset];
      if (!Array.isArray(lights) || lights.length === 0) return null;
      return (
        <>
          {lights.map((l, i) => (
            <Light
              key={lightPreset + '_' + i}
              type="directional"
              intensity={l.intensity}
              castShadows={l.castShadows}
              direction={l.direction}
            />
          ))}
        </>
      );
    } catch (e) {
      console.warn(LOG_KEY, 'renderLight fallback a front_neg_z', e);
      setTimeout(() => setLightPreset('front_neg_z'), 0);
      const fallback = ALL_PRESETS['front_neg_z'];
      return (
        <>
          {fallback.map((l, i) => (
            <Light key={'fb_' + i} type="directional" intensity={l.intensity} castShadows={l.castShadows} direction={l.direction} />
          ))}
        </>
      );
    }
  };

  const orientationLabel = viewRotationYRad === 0 ? 'frente' : 'espalda';

  return (
    <View style={[styles.wrapper, style]}>
      <FilamentScene>
        <FilamentView style={styles.view}>
          {renderLight()}
          {renderModel()}
          <Camera near={CAMERA_NEAR} far={CAMERA_FAR} cameraPosition={cameraPosition} cameraTarget={CAMERA_TARGET} />
        </FilamentView>
      </FilamentScene>

      {showDebugPanel && (
        <View style={styles.diagPanel}>
          <Text style={styles.diagTitle} numberOfLines={2}>
            preset={lightPreset} | baseY={MODEL_FACING_ROTATION_Y.toFixed(2)} | {orientationLabel} | zoom={zoomFactor.toFixed(2)} | anim={selectedAnimationName || '—'}
            {autoDiagRunning ? ' | AutoDiag ON' : ''}{autoDiagAllRunning ? ' | AutoDiag All ON' : ''}
          </Text>
          <View style={styles.buttonRow}>
            {(['best_visible', 'sides_only', 'front_soft', 'front_strong', 'no_lights'] as const).map((p) => (
              <Pressable key={p} style={[styles.diagButton, lightPreset === p && styles.diagButtonActive]} onPress={() => setPresetSafe(p)}>
                <Text style={styles.diagButtonText}>{p}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.buttonRow}>
            <Text style={styles.diagLabel}>Cardinal:</Text>
            {(['front_pos_z', 'front_neg_z', 'front_pos_x', 'front_neg_x', 'top_down', 'back_pos_z', 'back_neg_z'] as const).map((p) => (
              <Pressable key={p} style={[styles.diagButton, lightPreset === p && styles.diagButtonActive]} onPress={() => setPresetSafe(p)}>
                <Text style={styles.diagButtonText}>{p}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.buttonRow}>
            <Text style={styles.diagLabel}>Intensity:</Text>
            {(['debug_single_light_low', 'debug_single_light_mid', 'debug_single_light_high'] as const).map((p) => (
              <Pressable key={p} style={[styles.diagButton, lightPreset === p && styles.diagButtonActive]} onPress={() => setPresetSafe(p)}>
                <Text style={styles.diagButtonText}>{p.replace('debug_single_light_', '')}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.buttonRow}>
            <Text style={styles.diagLabel}>Estados:</Text>
            {availableAnimations.map((anim, i) => {
              const idx = anim != null && typeof (anim as { index?: number }).index === 'number' ? (anim as { index: number }).index : i;
              const label = (anim != null && typeof (anim as { name?: string }).name === 'string' ? (anim as { name: string }).name : `Anim ${i}`).replace(/_/g, ' ');
              return (
                <Pressable
                  key={i}
                  style={[styles.diagButton, selectedAnimationIndex === idx && styles.diagButtonActive]}
                  onPress={() => setAnimationByIndex(idx, label)}
                >
                  <Text style={styles.diagButtonText}>{label}</Text>
                </Pressable>
              );
            })}
            {availableAnimations.length === 0 && <Text style={styles.diagButtonText}>—</Text>}
          </View>
          <View style={styles.buttonRow}>
            <Pressable style={[styles.diagButton, styles.diagButtonPrimary]} onPress={usarFrontNegZ}>
              <Text style={styles.diagButtonText}>Usar FrontNegZ</Text>
            </Pressable>
            <Pressable style={[styles.diagButton, autoDiagRunning && styles.diagButtonActive]} onPress={autoDiagRunning ? stopAutoDiag : startAutoDiag}>
              <Text style={styles.diagButtonText}>{autoDiagRunning ? 'Stop AutoDiag' : 'AutoDiag'}</Text>
            </Pressable>
            <Pressable style={[styles.diagButton, autoDiagAllRunning && styles.diagButtonActive]} onPress={autoDiagAllRunning ? stopAutoDiagAll : startAutoDiagAll}>
              <Text style={styles.diagButtonText}>{autoDiagAllRunning ? 'Stop AutoDiag All' : 'AutoDiag All'}</Text>
            </Pressable>
            <Pressable style={styles.diagButton} onPress={toggleFrenteEspalda}>
              <Text style={styles.diagButtonText}>{orientationLabel === 'frente' ? 'Espalda' : 'Frente'}</Text>
            </Pressable>
            <Pressable style={styles.diagButton} onPress={zoomOut}><Text style={styles.diagButtonText}>Zoom −</Text></Pressable>
            <Pressable style={styles.diagButton} onPress={zoomReset}><Text style={styles.diagButtonText}>Reset</Text></Pressable>
            <Pressable style={styles.diagButton} onPress={zoomIn}><Text style={styles.diagButtonText}>Zoom +</Text></Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', flex: 1, minHeight: 280, backgroundColor: DIAG_BG, overflow: 'hidden' },
  view: { flex: 1, minHeight: 280 },
  diagPanel: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: DIAG_BG,
    borderTopWidth: 1,
    borderTopColor: DIAG_BUTTON,
    opacity: DIAG_OPACITY,
  },
  diagTitle: { fontSize: 9, color: DIAG_TEXT, marginBottom: 4 },
  diagLabel: { fontSize: 9, color: DIAG_TEXT, marginRight: 4, alignSelf: 'center' },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 2 },
  diagButton: { paddingVertical: 3, paddingHorizontal: 6, marginRight: 3, marginBottom: 3, backgroundColor: DIAG_BUTTON, borderRadius: 3 },
  diagButtonActive: { backgroundColor: DIAG_BUTTON_ACTIVE },
  diagButtonPrimary: { backgroundColor: DIAG_BUTTON_ACTIVE },
  diagButtonText: { fontSize: 9, color: DIAG_TEXT },
});
