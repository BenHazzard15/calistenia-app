# Calistenia 45

App de entrenamiento de calistenia de 45 minutos (días A, B y C en superseries), con calentamiento guiado, fotos reales de cada ejercicio, descanso con alarma, bloque final 3/7 y registro de cada serie.

## Descargar el APK

Cada vez que se sube un cambio a `main`, GitHub compila la app sola. El APK queda en **Releases** (columna derecha del repo) como `Calistenia45.apk`. Ábrelo desde el celular e instálalo (Android pedirá permitir instalar apps de esta fuente).

## Estructura

- `www/` — la app (HTML, CSS, JS, fotos). Funciona sin internet.
- `www/data.js` — ejercicios, días, calentamiento. Para cambiar la rutina, se edita aquí.
- `.github/workflows/build-apk.yml` — compila el APK con Capacitor.
- `ci/debug.keystore` — firma fija para que cada versión se instale encima de la anterior sin perder datos.

Fotos de ejercicios: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (dominio público).
