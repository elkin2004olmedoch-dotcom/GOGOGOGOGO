# GPS PUCE · Quito

## Dos páginas
- `celular.html`: nombre del celular, iniciar/detener GPS, precisión y mapa de su recorrido propio.
- `monitoreo.html` (también `index.html`): posiciones y recorridos de todos los celulares de la sala; no captura GPS del monitor.

Desde Monitoreo pulsa **Compartir sala** y envía ese enlace a los celulares.
Los botones Para celular y Monitoreo conservan el parámetro `room`; abrir las dos
direcciones por separado sin ese parámetro crea salas diferentes. En el celular,
Monitoreo se abre en otra pestaña para mantener activa la captura GPS.

React + Google Maps JavaScript API + Firebase Realtime Database. Cada celular obtiene
su ubicación con el GPS del navegador y publica la última lectura como máximo cada
1000 ms. Firebase sincroniza marcadores, precisión y recorridos entre los dispositivos
que abren el mismo enlace de sala. No se generan ubicaciones simuladas.

## Configurar
1. Copia `.env.example` a `.env.local` y reemplaza los valores.
2. En Google Cloud habilita **Maps JavaScript API**, configura la facturación del
   proyecto y crea una clave restringida a tus dominios HTTPS y a esta API.
3. En Firebase crea una **Realtime Database** (no Firestore).
4. En Authentication → Sign-in method habilita **Anonymous**.
5. Publica el contenido de `database.rules.json` en Realtime Database → Rules.
6. En Authentication → Settings → Authorized domains agrega el dominio donde
   publicarás la aplicación si tu configuración de Firebase lo requiere.
7. Ejecuta `npm ci`, `npm run build` y publica `dist/` en un hosting HTTPS.
   Las variables VITE se incorporan durante la compilación; recompila al cambiarlas.
   Nunca subas archivos de credenciales de cuentas de servicio.

## Probar en sus celulares
1. Abre el sitio HTTPS en el primer celular y pulsa **Compartir sala**.
2. Abre ese mismo enlace en el segundo celular y en la computadora del monitor.
3. En cada celular escribe un nombre, pulsa **Compartir mi GPS** y permite ubicación.
4. Selecciona un dispositivo para seguirlo. Camina al aire libre y comprueba cómo
   cambia el marcador y se pinta la línea del recorrido en ambos dispositivos.
5. **Detener ubicación** apaga el GPS y elimina el marcador y su recorrido de la sala.
   Al perder la conexión Firebase elimina el registro; al reconectar se registra otra vez.
6. Denegar ubicación muestra un error sin inventar coordenadas. Sin Firebase se
   muestra el estado de configuración y no aparecen celulares simulados.

El enlace lleva un identificador aleatorio de sala: quien tenga el enlace y se
autentique anónimamente puede ver sus ubicaciones. No lo publiques. Las reglas
impiden modificar dispositivos de otros usuarios. Para un sistema institucional,
sustituye la sala por membresías verificadas y autenticación institucional.

## Precisión y alcance
El centro de referencia de la PUCE Quito y la zona aproximada para la vista están
en `src/data/campus.js`; no representan límites oficiales ni un plano interior.
Google dibuja la cartografía real y la aplicación superpone el recorrido registrado.
La línea es el camino recorrido, no una ruta calculada para llegar a un destino.
No se requiere Directions API ni Google Geolocation API: el navegador obtiene el GPS.

El círculo representa la precisión reportada. Lecturas de más de 80 m no se agregan
a la línea y se corta el recorrido tras pausas de más de 30 s. Se conservan hasta
500 puntos durante la sesión. El sensor decide cuándo entrega lecturas; el envío
cada segundo no garantiza que haya una coordenada nueva cada segundo.
Mantén la página abierta: los navegadores pueden suspender el GPS en segundo plano
o al bloquear el teléfono. En computadoras la ubicación puede ser menos precisa.
HTTP en una IP de la red local no basta para probar GPS en celulares: usa HTTPS.

## Desarrollo y validación
```sh
npm ci
npm run test
npm run lint
npm run build
npm run dev
```

Documentación:
- https://developers.google.com/maps/documentation/javascript/geolocation
- https://firebase.google.com/docs/database/web/read-and-write
- https://firebase.google.com/docs/database/web/offline-capabilities
- https://firebase.google.com/docs/auth/web/anonymous-auth

## GitHub Pages
La publicación automática está en `.github/workflows/pages.yml`.
En Settings → Pages selecciona **GitHub Actions** como Source.
Cada push a main compila, verifica y publica el sitio:
https://elkin2004olmedoch-dotcom.github.io/GOGOGOGOGO/

En Settings → Secrets and variables → Actions agrega estos secretos:
- VITE_GOOGLE_MAPS_API_KEY
- VITE_FIREBASE_API_KEY

Agrega estas variables:
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_DATABASE_URL
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_APP_ID

Configura la clave de Maps para permitir `https://elkin2004olmedoch-dotcom.github.io/*`
y restringirla a Maps JavaScript API. Las claves de SDK web se incorporan al
JavaScript público; las restricciones y las reglas de Firebase protegen el acceso.
Después de cambiar secretos o variables, vuelve a ejecutar el workflow Publish GPS.
GitHub Pages proporciona HTTPS, pero no crea las claves de Google ni una base Firebase.

La clave de Maps del navegador puede cargarse desde `public/maps-config.js` cuando no hay un secreto de Actions configurado. Este archivo se sirve públicamente, igual que cualquier clave de Maps usada en JavaScript. Restríngela a Maps JavaScript API y a `https://elkin2004olmedoch-dotcom.github.io/*`; no uses este archivo para credenciales privadas ni claves de cuentas de servicio.

El GPS del celular funciona de forma local aunque falte Firebase o falle la autenticación. El estado distingue GPS local de envío confirmado a Firebase. El monitor solo recibe ubicaciones cuando Firebase está configurado, Anonymous Authentication está habilitado y las reglas permiten el acceso. Puede añadirse el objeto de configuración del SDK web como `firebase` dentro de `window.PUCE_CONFIG` en `public/maps-config.js`.
