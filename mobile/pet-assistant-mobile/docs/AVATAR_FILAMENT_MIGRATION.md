# Migración del avatar a render nativo (react-native-filament)

## 1. Diagnóstico de compatibilidad

### ¿Qué es react-native-filament?
- Motor 3D **nativo** (Filament de Google), sin `document` ni `window`.
- Soporta **solo `.glb`** (glTF binario).
- API declarativa: `FilamentScene`, `FilamentView`, `Model`, `Camera`, `DefaultLight`.
- Documentación: [React Native Filament](https://margelo.github.io/react-native-filament/docs/guides).

### ¿Funciona con este proyecto?
| Requisito | Estado |
|-----------|--------|
| Expo managed | ✅ Compatible usando **development build** (`npx expo run:ios` / `run:android`). |
| Expo Go | ❌ **No**: el módulo nativo no está en Expo Go. En Go se muestra el fallback actual. |
| .glb en Metro | ✅ Ya configurado (`metro.config.js` con `glb`). |
| Código nativo (pods, etc.) | ✅ Se genera con `npx expo prebuild`; luego `pod install` (iOS). |

### Limitaciones conocidas
- **Expo SDK 54 + New Architecture**: [crash con FilamentView](https://github.com/margelo/react-native-filament/issues/322). Workaround: SDK 53 o desactivar New Architecture. En SDK 55 conviene probar; si crashea, desactivar New Architecture en `app.json`.
- **iOS**: URIs `file://` con espacios (ej. `Application%20Support`) pueden fallar; [issue #335](https://github.com/margelo/react-native-filament/issues/335). Workaround: decodificar la URI antes de pasarla a `<Model source={{ uri }} />`.

---

## 2. Escenario A — Migración mínima (mantener app actual)

Objetivo: seguir en Expo, añadir Filament solo para la parte avatar, sin romper nada.

### Pasos

1. **Development build (obligatorio)**  
   En tu máquina ya usas algo tipo `npx expo run:ios`. Sigue usándolo para probar el avatar con Filament. En Expo Go el avatar seguirá en modo fallback (verificación de asset + escena WebGL mínima).

2. **Dependencias**
   - Añadir: `react-native-filament`, `react-native-worklets-core`.
   - Opcional para reducir tamaño: quitar `three`, `@types/three`, `expo-gl` si ya no usas la escena WebGL mínima (el fallback puede quedarse solo en “asset detectado + mensaje”).

3. **Configuración**
   - **Babel**: crear `babel.config.js` en la raíz del proyecto con el plugin de worklets (ver sección 5).
   - **Metro**: ya tienes `assetExts` con `glb`/`gltf`.
   - **app.json**: si en SDK 55 aparece el crash de Filament con New Architecture, añadir `"newArchEnabled": false` en `expo` (o en `ios`/`android` según docs de Expo).

4. **Código**
   - **Nuevos**: `src/types/avatar.ts`, `src/data/avatarCatalog.ts`, `src/components/AvatarFilamentScene.tsx`.
   - **Modificados**: `AvatarViewer.tsx` (detección Expo Go vs development build; si no es Go, montar `AvatarFilamentScene` dentro de un ErrorBoundary; si es Go o hay error, mostrar fallback actual).
   - **AvatarScreen**: no hace falta tocarla; solo renderiza `AvatarViewer`.

5. **Riesgo para Expo**
   - **Bajo** si:
     - Solo usas Filament en pantallas que montan `AvatarFilamentScene`.
     - En Expo Go nunca se importa `react-native-filament` (se usa `expo-constants` para detectar Go y no cargar la escena Filament).
   - **Medio** si usas SDK 55 + New Architecture: puede hacer falta desactivar New Architecture hasta que Filament lo soporte.

---

## 3. Escenario B — Si el setup actual no basta

Si algo de lo anterior falla (p. ej. crash en iOS o Android al abrir la pantalla del avatar):

1. **Asegurar development build**
   - Ejecutar: `npx expo prebuild --clean`.
   - iOS: `cd ios && pod install`.
   - Levantar con `npx expo run:ios` (o `run:android`), **no** con Expo Go.

2. **New Architecture**
   - En `app.json`, dentro de `expo`, añadir: `"newArchEnabled": false`.
   - Volver a hacer prebuild y `pod install` si cambias esto.

3. **Versión de Expo**
   - Si el crash persiste con SDK 55, valorar bajar a **Expo SDK 53** (React Native 0.79.5) como en el workaround del issue #322.

4. **URIs en iOS**
   - Si el modelo no carga y la URI tiene `%20` o similares, pasar por `decodeURIComponent` (o el equivalente seguro) antes de `source={{ uri: localUri }}`.

5. **No usar Expo Go para el avatar**
   - El avatar con modelo 3D real solo está soportado en development build; en Expo Go se mantiene el fallback por diseño.

---

## 4. Estructura para múltiples avatares

### Tipos (`src/types/avatar.ts`)
- `AvatarEntry`: `id`, `name`, `file` (require del .glb o URI), `thumbnail` (opcional, URI o require de imagen).
- `AvatarCatalog`: array de `AvatarEntry` o fuente remota (API) que devuelva ese formato.

### Catálogo
- **Local**: `src/data/avatarCatalog.ts` exporta un array con el avatar actual (`assets/models/avatar.glb`) y, en el futuro, más entradas (cada una con `id`, `name`, `file`, `thumbnail`).
- **Remoto**: más adelante se puede sustituir o complementar con una API que devuelva `{ id, name, file: url, thumbnail: url }` y usar `<Model source={{ uri: file }} />` para URLs.

### Cambio de modelo
- `AvatarViewer` (o la pantalla) recibe `avatarId` o `avatar: AvatarEntry`.
- Se elige la entrada del catálogo y se pasa a `AvatarFilamentScene` como `source` (número de asset o `{ uri }`).
- Así se deja preparado para un selector (lista/grid) que solo cambie `avatarId` / `avatar`.

---

## 5. Dependencias y configuración concretas

### Añadir
```bash
npm i react-native-filament react-native-worklets-core
```

### Quitar (opcional, cuando Filament funcione)
- `three`, `@types/three` (ya no se usan para el avatar).
- `expo-gl` (opcional; se puede mantener si quieres conservar la escena WebGL mínima en el fallback).

### Babel
Crear `babel.config.js` en la raíz del proyecto (si no existe):

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['react-native-worklets-core/plugin', { processNestedWorklets: true }],
    ],
  };
};
```

Si ya tienes `babel.config.js`, solo añade el plugin `react-native-worklets-core/plugin`.

### Metro
Tu `metro.config.js` ya incluye `glb`/`gltf`; no hace falta cambiarlo.

---

## 6. Resumen de archivos

| Acción | Archivo |
|--------|--------|
| Crear | `docs/AVATAR_FILAMENT_MIGRATION.md` (este documento) |
| Crear | `src/types/avatar.ts` (tipos del catálogo) |
| Crear | `src/data/avatarCatalog.ts` (catálogo local con avatar actual) |
| Crear | `src/components/AvatarFilamentScene.tsx` (FilamentScene + FilamentView + Model + Camera + DefaultLight) |
| Crear | `babel.config.js` (plugin worklets) |
| Modificar | `src/components/AvatarViewer.tsx` (detección Expo Go, render Filament o fallback) |
| No tocar | `AvatarScreen.tsx`, backend, navegación |

---

## 7. Ruta recomendada para ver el avatar de verdad

1. **Implementar** Escenario A en el repo (tipos, catálogo, `AvatarFilamentScene`, `AvatarViewer` con detección Expo Go + ErrorBoundary).
2. **Añadir** dependencias y `babel.config.js`; ejecutar `npx expo prebuild` y `pod install` (iOS).
3. **Probar** con `npx expo run:ios` (o `run:android`), no con Expo Go.
4. Si hay **crash** con New Architecture, desactivar en `app.json` y repetir.
5. Cuando el **modelo se vea** en Filament, opcionalmente quitar `three`/`expo-gl` y simplificar el fallback a solo texto/thumbnail.
6. **Múltiples avatares**: rellenar el catálogo y que la UI pase `avatarId`/`avatar` a `AvatarViewer`; en Filament solo cambiar el `source` de `<Model>` según la entrada elegida.

Con esto tienes un plan accionable, sin soluciones web y con fallback seguro hasta que Filament funcione en tu build nativo.

---

## 8. Comandos a ejecutar (Escenario A)

```bash
cd mobile/pet-assistant-mobile
npm install
npx expo install expo-constants
npx expo prebuild
cd ios && pod install && cd ..
npx expo run:ios
```

Para Android: `npx expo run:android` (tras `prebuild`).

**Importante:** El avatar con modelo 3D real solo se verá al abrir la app con `npx expo run:ios` (o `run:android`), no en Expo Go. En Expo Go se muestra el fallback (verificación de asset + mensaje).
